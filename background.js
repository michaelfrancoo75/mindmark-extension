/* background.js - MindMark Background Service Worker (Improved Version) */

console.log('[MindMark] Background service worker initialized');

/* Storage Helpers */
const store = {
  async get(key, fallback = []) {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key] !== undefined ? result[key] : fallback;
    } catch (err) {
      console.error('[MindMark] Storage get error:', err);
      return fallback;
    }
  },

  async set(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
      return true;
    } catch (err) {
      console.error('[MindMark] Storage set error:', err);
      return false;
    }
  }
};

/* Check if device is online with timeout */
async function isOnline(timeoutMs = 2000) {
  if (!navigator.onLine) return false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    await fetch('https://www.gstatic.com/generate_204', {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache',
      signal: controller.signal
    });

    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

/* Generate meaningful summary using Chrome AI API */
async function summarizeText(text) {
  if (!text || typeof text !== 'string') {
    return ['(No content available)'];
  }

  const online = await isOnline();
  const cleanText = text.trim().slice(0, 15000);
  const wordCount = cleanText.split(/\s+/).length;

  const targetSentences = wordCount < 400 ? 3 : 4;

  if (online && chrome.ai?.prompt?.execute) {
    try {
      console.log(`[MindMark] AI summarizing (${wordCount} words → ${targetSentences} sentences)...`);

      const aiPrompt = `You are an expert summarizer. Create ${targetSentences} SHORT sentences that explain WHAT this page is and WHY someone would save it.

CRITICAL RULES:
- Return ONLY a JSON array: ["sentence 1", "sentence 2", "sentence 3"]
- Each sentence: 12-20 words MAXIMUM (very short!)
- NO filler: "This page", "This article", "The author", "In this"
- Answer: WHAT is this? WHY is it useful? WHO needs it?
- Be DIRECT - say it in the simplest way

PERFECT EXAMPLES (Short & Clear):
"Complete HTML element reference with syntax examples and browser compatibility."
"React Hooks enable state management in functional components without classes."
"Build REST APIs using Node.js, Express, and MongoDB with authentication."

Content (${wordCount} words):
"""
${cleanText}
"""

Return ${targetSentences} SHORT sentences as JSON array:`;

      const response = await chrome.ai.prompt.execute({
        prompt: aiPrompt,
        maxOutputTokens: 250,
        temperature: 0.15
      });

      const raw = (response?.text || response?.result || '').trim();

      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          const sentences = parsed
            .map(s => String(s).trim())
            .filter(s => s.length > 20 && s.length < 150)
            .map(s => /[.!?]$/.test(s) ? s : s + '.')
            .slice(0, 4);

          if (sentences.length >= 2) {
            console.log(`[MindMark] AI summary: ${sentences.length} sentences`);
            return sentences;
          }
        }
      } catch (parseErr) {
        const jsonMatch = raw.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed) && parsed.length) {
              const sentences = parsed
                .map(s => String(s).trim())
                .filter(s => s.length > 20 && s.length < 150)
                .map(s => /[.!?]$/.test(s) ? s : s + '.')
                .slice(0, 4);

              if (sentences.length >= 2) {
                console.log(`[MindMark] AI summary (extracted): ${sentences.length} sentences`);
                return sentences;
              }
            }
          } catch (e) {
            console.warn('[MindMark] JSON extraction failed:', e);
          }
        }
      }

      if (raw && raw.length > 30) {
        const sentences = raw
          .split(/(?<=[.!?])\s+/)
          .map(s => s.trim())
          .filter(s => s.length > 20 && s.length < 150)
          .map(s => /[.!?]$/.test(s) ? s : s + '.')
          .slice(0, 4);

        if (sentences.length >= 2) {
          console.log(`[MindMark] AI summary (parsed): ${sentences.length} sentences`);
          return sentences;
        }
      }

    } catch (err) {
      console.warn('[MindMark] AI summarization failed:', err.message);
    }
  }

  console.log('[MindMark] Using offline summarizer');
  return fallbackSummarize(cleanText, targetSentences);
}

/* Offline fallback summarizer with intelligent sentence extraction */
function fallbackSummarize(text, targetCount = 5) {
  if (!text) return ['(No content available)'];

  const clean = String(text)
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[\{\}\[\]\+\=\<\>\;\:\(\)\/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const rawSentences = clean.match(/[^.!?]+[.!?]+/g) || [];

  const sentences = rawSentences
    .map(s => s.trim())
    .filter(s => s.length > 30 && s.length < 180)
    .map(s => /[.!?]$/.test(s) ? s : s + '.');

  if (sentences.length >= 3) {
    return sentences.slice(0, targetCount);
  }

  const chunks = [];
  let i = 0;

  while (i < clean.length && chunks.length < targetCount) {
    let chunk = clean.slice(i, i + 150).trim();

    const lastPeriod = chunk.lastIndexOf('.');
    const lastSpace = chunk.lastIndexOf(' ');

    if (lastPeriod > 100) {
      chunk = chunk.slice(0, lastPeriod + 1);
    } else if (lastSpace > 100) {
      chunk = chunk.slice(0, lastSpace) + '.';
    } else {
      chunk = chunk.endsWith('.') ? chunk : chunk + '.';
    }

    if (chunk.length > 25 && chunk.length < 180) {
      chunks.push(chunk);
    }

    i += 150;
  }

  return chunks.length ? chunks : ['Content summary unavailable.'];
}

/* Detect user intent using AI with smart fallback patterns */
async function inferIntent(title, excerpt = '') {
  const online = await isOnline();

  if (online && chrome.ai?.prompt?.execute) {
    try {
      console.log('[MindMark] AI detecting intent...');

      const prompt = `Analyze this webpage to determine the user's specific intent, relevant tags, and actionable next step.

CRITICAL: Return ONLY valid JSON (no markdown, no explanation):
{
  "intent": "specific action-oriented intent",
  "tags": ["keyword1", "keyword2"],
  "next_action": "concrete helpful action"
}

INTENT PATTERNS (Be SPECIFIC, not generic):
GOOD: "Reference HTML elements for development", "Follow React Hooks tutorial", "Research laptop purchase"
BAD: "Learn about HTML", "Read this page", "Review content"

DOCUMENTATION:
- "Reference [topic] documentation", "Study [topic] API guide", "Understand [topic] syntax"

TUTORIALS:
- "Follow [topic] tutorial", "Learn [skill] fundamentals", "Build [project] step-by-step"

SHOPPING:
- "Research [product] purchase", "Compare [product] options", "Find best [product] deals"

ARTICLES/BLOGS:
- "Understand [concept] deeply", "Explore [topic] insights", "Learn [topic] best practices"

RECIPES:
- "Try [dish] recipe", "Master [cooking technique]", "Cook [meal] for [occasion]"

ACADEMIC:
- "Research [topic] literature", "Study [subject] theory", "Review [topic] paper"

TAGS: 2-4 short lowercase keywords (no hashtags)

NEXT_ACTION: Specific, helpful suggestion
- "Try code examples", "Compare prices", "Practice exercises", "Bookmark for reference", "Install package"

Title: ${title}
Excerpt: ${excerpt.slice(0, 1200)}

Return ONLY the JSON object:`;

      const response = await chrome.ai.prompt.execute({
        prompt,
        maxOutputTokens: 250,
        temperature: 0.2
      });

      const raw = (response?.text || response?.result || '').trim();

      try {
        const parsed = JSON.parse(raw);
        const result = {
          intent: parsed.intent || 'Review this page',
          tags: Array.isArray(parsed.tags) ? parsed.tags : ['general'],
          next_action: parsed.next_action || 'Read later'
        };

        console.log(`[MindMark] AI intent: "${result.intent}"`);
        return result;
      } catch (parseErr) {
        const jsonMatch = raw.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            const result = {
              intent: parsed.intent || 'Review this page',
              tags: Array.isArray(parsed.tags) ? parsed.tags : ['general'],
              next_action: parsed.next_action || 'Read later'
            };

            console.log(`[MindMark] AI intent (extracted): "${result.intent}"`);
            return result;
          } catch (e) {
            console.warn('[MindMark] Intent JSON extraction failed:', e);
          }
        }
      }
    } catch (err) {
      console.warn('[MindMark] AI intent detection failed:', err.message);
    }
  }

  console.log('[MindMark] Using pattern-based intent');
  return fallbackInferIntent(title, excerpt);
}

/* Pattern-based intent detection with smart categorization */
function fallbackInferIntent(title, text = '') {
  const combined = (title + ' ' + text).toLowerCase();
  let intent = 'Review this page';
  let next_action = 'Read and analyze';
  const tags = [];

  const patterns = {
    documentation: /\b(docs?|documentation|api|reference|manual|specification|readme|guide)\b/,
    tutorial: /\b(tutorial|how[\s-]to|walkthrough|step[\s-]by[\s-]step|learn|course|lesson|beginner|introduction)\b/,
    shopping: /\b(buy|price|purchase|order|cart|shop|deal|sale|discount|checkout|product|store|amazon|ebay)\b/,
    recipe: /\b(recipe|cook|bake|ingredient|serving|meal|dish|cuisine|food|preparation)\b/,
    academic: /\b(study|paper|research|journal|thesis|academic|publication|abstract|doi|scholar)\b/,
    news: /\b(news|breaking|update|announcement|press|release|report|latest)\b/,
    programming: /\b(code|programming|javascript|python|java|react|vue|angular|node|function|class|github|npm)\b/,
    entertainment: /\b(movie|film|game|video|music|stream|watch|play|tv|series)\b/,
    tools: /\b(tool|software|app|application|download|install|setup|plugin|extension)\b/
  };

  if (patterns.documentation.test(combined)) {
    const topic = extractTopic(title, ['docs', 'documentation', 'api', 'reference', 'manual']);
    intent = topic ? `Reference ${topic} for development` : 'Reference documentation';
    next_action = 'Bookmark for quick reference';
    tags.push('documentation', 'reference');

  } else if (patterns.tutorial.test(combined)) {
    const topic = extractTopic(title, ['tutorial', 'learn', 'guide', 'how to']);
    intent = topic ? `Follow ${topic} tutorial` : 'Follow tutorial';
    next_action = 'Practice the steps';
    tags.push('tutorial', 'learning');

  } else if (patterns.shopping.test(combined)) {
    const product = extractTopic(title, ['buy', 'price', 'purchase', 'order']);
    intent = product ? `Research ${product} purchase` : 'Research product purchase';
    next_action = 'Compare prices and reviews';
    tags.push('shopping', 'product');

  } else if (patterns.recipe.test(combined)) {
    const dish = extractTopic(title, ['recipe', 'cook', 'bake']);
    intent = dish ? `Try ${dish} recipe` : 'Try recipe';
    next_action = 'Add ingredients to list';
    tags.push('recipe', 'cooking');

  } else if (patterns.academic.test(combined)) {
    const topic = extractTopic(title, ['research', 'study', 'paper']);
    intent = topic ? `Research ${topic} literature` : 'Research academic topic';
    next_action = 'Add to research notes';
    tags.push('academic', 'research');

  } else if (patterns.programming.test(combined)) {
    const topic = extractTopic(title, ['javascript', 'python', 'react', 'node', 'programming']);
    intent = topic ? `Learn ${topic} programming` : 'Learn programming concept';
    next_action = 'Try code examples';
    tags.push('programming', 'code');

  } else if (patterns.news.test(combined)) {
    intent = 'Read news update';
    next_action = 'Stay informed';
    tags.push('news', 'article');

  } else if (patterns.tools.test(combined)) {
    const tool = extractTopic(title, ['tool', 'app', 'software']);
    intent = tool ? `Evaluate ${tool}` : 'Evaluate tool';
    next_action = 'Test features';
    tags.push('tools', 'software');

  } else if (patterns.entertainment.test(combined)) {
    intent = 'Explore entertainment';
    next_action = 'Watch or enjoy later';
    tags.push('entertainment', 'media');

  } else {
    tags.push('general', 'reading');
  }

  return { intent, tags, next_action };
}

/* Extract topic from title for more specific intents */
function extractTopic(title, keywords) {
  const words = title.toLowerCase().split(/\s+/);
  const keywordSet = new Set(keywords.map(k => k.toLowerCase()));

  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^a-z]/g, '');
    if (word.length > 3 && !keywordSet.has(word)) {
      if (i + 1 < words.length) {
        const nextWord = words[i + 1].replace(/[^a-z]/g, '');
        if (nextWord.length > 2) {
          return `${word} ${nextWord}`;
        }
      }
      return word;
    }
  }

  return null;
}

/* Extract content from tab with multiple fallback selectors */
async function extractContentFromTab(tab) {
  if (!tab || !tab.id) {
    return { title: 'Untitled Page', text: '', url: '' };
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const selectors = [
          'article',
          'main',
          '[role="main"]',
          '.content',
          '.post-content',
          '.article-content',
          '#content',
          '.entry-content',
          '.page-content'
        ];

        let mainElement = null;
        for (const selector of selectors) {
          mainElement = document.querySelector(selector);
          if (mainElement && mainElement.innerText.trim().length > 100) {
            break;
          }
        }

        if (!mainElement || mainElement.innerText.trim().length < 100) {
          mainElement = document.body;
        }

        const text = (mainElement?.innerText || '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 6000);

        const metaDesc = document.querySelector('meta[name="description"]')?.content || '';

        return {
          title: document.title || 'Untitled Page',
          text: text || metaDesc || '',
          url: location.href,
          wordCount: text.split(/\s+/).length
        };
      }
    });

    if (results?.[0]?.result) {
      const content = results[0].result;
      console.log(`[MindMark] Extracted ${content.wordCount} words from: ${content.title}`);
      return content;
    }
  } catch (err) {
    console.warn('[MindMark] Content extraction failed:', err.message);
  }

  return {
    title: tab.title || 'Untitled Page',
    text: '',
    url: tab.url || '',
    wordCount: 0
  };
}

/* Save snapshot with duplicate detection */
async function saveSnapshot(snapshot) {
  const key = 'mindmark_snapshots';
  const existing = await store.get(key, []);

  const isDuplicate = existing.some(s =>
    s.url === snapshot.url &&
    (Date.now() - s.created_at) < 300000
  );

  if (isDuplicate) {
    console.log('[MindMark] Duplicate detected (same URL within 5min)');
    return existing;
  }

  existing.unshift(snapshot);

  const limited = existing.slice(0, 100);

  await store.set(key, limited);
  console.log(`[MindMark] Snapshot saved. Total: ${limited.length}`);

  return limited;
}

/* Get all snapshots */
async function getSnapshots() {
  return await store.get('mindmark_snapshots', []);
}

/* Message Listener */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      const action = msg?.action;

      if (!action) {
        sendResponse({ success: false, error: 'No action specified' });
        return;
      }

      console.log(`[MindMark] Action: ${action}`);

      switch (action) {
        case 'capture_current_tab': {
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
          });

          if (!tab || !tab.id) {
            sendResponse({ success: false, error: 'No active tab found' });
            break;
          }

          const content = await extractContentFromTab(tab);

          const [summary, intentObj] = await Promise.all([
            summarizeText(content.text || ''),
            inferIntent(
              content.title || tab.title || 'Untitled Page',
              content.text || ''
            )
          ]);

          const snapshot = {
            id: `mm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: content.title || tab.title || 'Untitled Page',
            url: content.url || tab.url || '',
            excerpt: (content.text || '').slice(0, 1500),
            summary: Array.isArray(summary)
              ? summary.map(s => String(s).trim()).filter(Boolean)
              : [],
            intent: intentObj?.intent || 'Review this page',
            tags: intentObj?.tags || ['general'],
            next_action: intentObj?.next_action || 'Read later',
            word_count: content.wordCount || 0,
            created_at: Date.now(),
            online: await isOnline()
          };

          await saveSnapshot(snapshot);

          console.log(`[MindMark] Captured: "${snapshot.title}" (${snapshot.word_count} words)`);

          sendResponse({ success: true, data: snapshot });
          break;
        }

        case 'get_snapshots': {
          const snapshots = await getSnapshots();
          console.log(`[MindMark] Retrieved ${snapshots.length} snapshots`);

          sendResponse({ success: true, data: snapshots });
          break;
        }

        case 'delete_snapshot': {
          if (!msg.id) {
            sendResponse({ success: false, error: 'Missing snapshot ID' });
            break;
          }

          const snapshots = await getSnapshots();
          const updated = snapshots.filter(s => s.id !== msg.id);

          await store.set('mindmark_snapshots', updated);

          console.log(`[MindMark] Deleted snapshot: ${msg.id}`);

          sendResponse({ success: true, data: updated });
          break;
        }

        case 'update_snapshot_intent': {
          if (!msg.id || !msg.new_intent) {
            sendResponse({ success: false, error: 'Missing ID or intent' });
            break;
          }

          const snapshots = await getSnapshots();
          const updated = snapshots.map(s =>
            s.id === msg.id
              ? { ...s, intent: msg.new_intent.trim() }
              : s
          );

          await store.set('mindmark_snapshots', updated);

          console.log(`[MindMark] Updated intent: ${msg.id}`);

          sendResponse({ success: true, data: updated });
          break;
        }

        case 'export_markdown': {
          const snapshots = await getSnapshots();

          const mdParts = [
            '# MindMark Export',
            `**Generated:** ${new Date().toLocaleString()}`,
            `**Total Snapshots:** ${snapshots.length}`,
            '',
            '---',
            ''
          ];

          for (const s of snapshots) {
            const summaryLines = (s.summary || [])
              .map(line => `- ${line.replace(/\n/g, ' ')}`)
              .join('\n');

            const tags = (s.tags || []).map(t => `\`${t}\``).join(', ');

            mdParts.push(`## ${s.title}`);
            mdParts.push('');
            mdParts.push(`**URL:** ${s.url}`);
            mdParts.push(`**Intent:** ${s.intent || 'N/A'}`);
            mdParts.push(`**Tags:** ${tags || 'N/A'}`);
            mdParts.push(`**Next Action:** ${s.next_action || 'N/A'}`);
            mdParts.push(`**Saved:** ${new Date(s.created_at).toLocaleString()}`);
            mdParts.push('');
            mdParts.push('**Summary:**');
            mdParts.push(summaryLines || '- (No summary)');
            mdParts.push('');
            mdParts.push('---');
            mdParts.push('');
          }

          const markdown = mdParts.join('\n');

          console.log(`[MindMark] Exported ${snapshots.length} snapshots`);

          sendResponse({ success: true, data: markdown });
          break;
        }

        default:
          sendResponse({ success: false, error: `Unknown action: ${action}` });
      }
    } catch (err) {
      console.error('[MindMark] Error:', err);
      sendResponse({
        success: false,
        error: err?.message || String(err)
      });
    }
  })();

  return true;
});

/* Service Worker Lifecycle */
chrome.runtime.onInstalled.addListener((details) => {
  console.log(`[MindMark] Extension ${details.reason}:`, details);

  if (details.reason === 'install') {
    console.log('[MindMark] Welcome to MindMark!');
  } else if (details.reason === 'update') {
    console.log('[MindMark] Updated to:', chrome.runtime.getManifest().version);
  }
});

console.log('[MindMark] All systems ready');