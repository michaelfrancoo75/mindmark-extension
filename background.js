// background.js - MindMark service worker
console.log("[MindMark] Background service worker initialized.");

// Helper: simple fallback summarizer (cleaned + improved)
function fallbackSummarize(text, maxBullets = 3) {
  if (!text) return ["(no text)"];

  // Clean up: remove code-like content and reduce noise
  let clean = text
    .replace(/[\{\}\[\]\+\=\<\>\;\:\(\)\/\\]+/g, " ") // remove code symbols
    .replace(/\s+/g, " ") // collapse spaces
    .replace(/https?:\/\/\S+/g, "") // remove URLs
    .trim();

  // Split by sentence boundaries
  const sentences = clean.match(/[^.!?]+[.!?]?/g) || [clean];
  const filtered = sentences.filter((s) => s.length > 20); // skip short fragments
  const bullets = filtered.slice(0, maxBullets).map((s) => s.trim());

  return bullets.length ? bullets : [clean.substring(0, 200)];
}

// Helper: fallback intent inference (keyword heuristics)
function fallbackInferIntent(title, excerpt) {
  const combined = (title + " " + (excerpt || "")).toLowerCase();
  const tags = [];
  let intent = "Read / Review";
  let next_action = "Read for 10 minutes";

  const match = (regex) => combined.match(regex);

  if (match(/\b(buy|price|order|purchase|shop|cart)\b/)) {
    intent = "Research purchase";
    next_action = "Compare prices and add to wishlist";
    tags.push("purchase");
  } else if (match(/\b(paper|journal|study|research|doi|arxiv)\b/)) {
    intent = "Academic reading";
    next_action = "Add to bibliography";
    tags.push("research");
  } else if (match(/\b(recipe|cook|ingredients)\b/)) {
    intent = "Find recipe";
    next_action = "Save recipe and try cooking";
    tags.push("lifestyle");
  } else if (match(/\b(tutorial|how to|guide)\b/)) {
    intent = "Follow tutorial";
    next_action = "Try the steps and bookmark progress";
    tags.push("learning");
  } else if (match(/\b(video|youtube|watch)\b/)) {
    intent = "Watch video";
    next_action = "Watch and take timestamped notes";
    tags.push("media");
  } else {
    tags.push("misc");
  }

  return { intent, tags: tags.slice(0, 3), next_action };
}

// Storage helpers
async function saveSnapshot(snapshot) {
  const key = "mindmark_snapshots";
  const existing = (await chrome.storage.local.get(key))[key] || [];
  existing.unshift(snapshot);
  await chrome.storage.local.set({ [key]: existing });
  return existing;
}

async function getSnapshots() {
  return (await chrome.storage.local.get("mindmark_snapshots")).mindmark_snapshots || [];
}

// AI summarization (with offline fallback)
async function summarizeText(text) {
  if (!navigator.onLine) {
    console.warn("[MindMark] Offline — using fallback summarizer.");
    return fallbackSummarize(text, 3);
  }

  try {
    if (chrome.ai?.summarizer?.summarize) {
      const apiRes = await chrome.ai.summarizer.summarize({ text, maxOutputTokens: 400 });
      const summary = apiRes?.summary || apiRes?.result?.summary || apiRes;
      if (typeof summary === "string") return [summary];
      if (Array.isArray(summary)) return summary;
    }
  } catch (e) {
    console.warn("[MindMark] summarizer fallback:", e);
  }
  return fallbackSummarize(text, 3);
}

// AI intent inference (with fallback)
async function inferIntent(title, excerpt = "") {
  try {
    if (navigator.onLine && chrome.ai?.prompt?.execute) {
      const prompt = `\nYou are an assistant that infers the user's intent for why they opened a webpage.\nReturn JSON exactly in this shape:\n{"intent":"short sentence","tags":["tag1","tag2"],"next_action":"single practical action"}\nInput Title: ${JSON.stringify(title)}\nInput Excerpt: ${JSON.stringify(excerpt.slice(0, 800))}\n`;
      const apiRes = await chrome.ai.prompt.execute({ prompt, maxOutputTokens: 200 });
      const text = apiRes?.text || apiRes?.result || JSON.stringify(apiRes);
      try {
        const obj = JSON.parse(text);
        return {
          intent: obj.intent || "Review this page",
          tags: obj.tags || [],
          next_action: obj.next_action || "Read and take notes",
        };
      } catch {
        console.warn("[MindMark] prompt.execute returned non-JSON:", text);
      }
    }
  } catch (e) {
    console.warn("[MindMark] intent inference fallback:", e);
  }
  return fallbackInferIntent(title, excerpt);
}

// Optional polish using chrome.ai.writer
async function polishText(text) {
  try {
    if (navigator.onLine && chrome.ai?.writer?.rewrite) {
      const res = await chrome.ai.writer.rewrite({
        text,
        instruction: "Polish for clarity and brevity (single sentence)",
      });
      return res?.text || res?.result || text;
    }
  } catch (e) {
    console.warn("[MindMark] writer.rewrite fallback:", e);
  }
  return text.trim().replace(/\s+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

// Main message router
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.action) {
        case "capture_current_tab": {
          console.log("[MindMark] Capturing current tab...");
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab?.id) return sendResponse({ success: false, error: "No active tab found" });

          const [{ result: page }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const title = document.title || "Untitled Page";
              const main = document.querySelector("article, main, #content, .post, .article");
              let text = main ? main.innerText : document.body.innerText || "";
              text = text.trim().replace(/\s+/g, " ").slice(0, 4000);
              return { title, text, url: location.href };
            },
          });

          const summary = await summarizeText(page.text);
          const intentObj = await inferIntent(page.title, page.text);
          const snapshot = {
            id: `mm_${Date.now()}`,
            title: page.title,
            url: page.url || tab.url,
            excerpt: page.text.slice(0, 1000),
            summary,
            intent: intentObj.intent,
            tags: intentObj.tags,
            next_action: intentObj.next_action,
            created_at: Date.now(),
          };

          await saveSnapshot(snapshot);
          sendResponse({ success: true, data: snapshot });
          setStatus && setStatus("Captured using offline summarizer");
          break;
        }

        case "get_snapshots": {
          const snaps = await getSnapshots();
          sendResponse({ success: true, data: snaps });
          break;
        }

        case "delete_snapshot": {
          const snaps = await getSnapshots();
          const updated = snaps.filter((s) => s.id !== message.id);
          await chrome.storage.local.set({ mindmark_snapshots: updated });
          sendResponse({ success: true, data: updated });
          break;
        }

        case "update_snapshot_intent": {
          const snaps = await getSnapshots();
          const updated = snaps.map((s) => (s.id === message.id ? { ...s, intent: message.new_intent } : s));
          await chrome.storage.local.set({ mindmark_snapshots: updated });
          sendResponse({ success: true, data: updated });
          break;
        }

        case "polish_text": {
          const polished = await polishText(message.text || "");
          sendResponse({ success: true, data: polished });
          break;
        }

        case "export_markdown": {
          const snaps = await getSnapshots();
          const md = snaps
            .map(
              (s) =>
                `### ${s.title}\n**URL:** ${s.url}\n**Saved:** ${new Date(s.created_at).toLocaleString()}\n**Intent:** ${s.intent}\n**Next action:** ${s.next_action}\n**Summary:**\n${(s.summary || []).map((b) => `- ${b}`).join("\n")}\n`
            )
            .join("\n---\n\n");
          sendResponse({ success: true, data: md });
          break;
        }

        default:
          sendResponse({ success: false, error: "Unknown action: " + message.action });
      }
    } catch (err) {
      console.error("[MindMark] background error:", err);
      sendResponse({ success: false, error: err?.message || String(err) });
    }
  })();
  return true; // keep message channel open
});