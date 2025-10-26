/* content.js - MindMark content extractor (improved, robust, fallback-friendly) */
(() => {
  try {
    /* Utility: get first matching element from a list of selectors */
    function firstSelector(root, selectors) {
      for (const sel of selectors) {
        const el = root.querySelector(sel);
        if (el) return el;
      }
      return null;
    }

    /* Title */
    const title = document.title?.trim() || "Untitled Page";

    /* Best "main" candidate: semantic tags, role=main, common container classes, fallback to body */
    const mainSelectors = [
      'main[role="main"]',
      'main',
      'article',
      '[role="main"]',
      '#content',
      '.post',
      '.entry',
      '.article',
      '.page-content',
      '.content',
      'section'
    ];
    let main = firstSelector(document, mainSelectors) || document.body;

    /* If main seems too small or contains nav-like content, try document.body */
    if (main && main.tagName && ['NAV','ASIDE'].includes(main.tagName)) {
      main = document.body;
    }

    /* Text extraction using TreeWalker, but accept only visible text nodes */
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        const tag = parent.tagName.toLowerCase();
        if (["script", "style", "noscript", "iframe", "svg", "canvas"].includes(tag)) {
          return NodeFilter.FILTER_REJECT;
        }

        /* Reject nodes that are clearly hidden */
        if (parent.offsetParent === null && getComputedStyle(parent).position !== 'fixed') {
          return NodeFilter.FILTER_REJECT;
        }

        /* Reject nodes with empty/short text */
        const txt = node.textContent.replace(/\s+/g, " ").trim();
        if (txt.length < 2) return NodeFilter.FILTER_REJECT;

        /* Check if text is inside elements that are visually collapsed (client rects) */
        try {
          const rects = node.parentElement.getClientRects();
          if (!rects || rects.length === 0) {
            return NodeFilter.FILTER_REJECT;
          }
        } catch (e) {
          /* ignore potential cross-origin / access errors and accept node */
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let extracted = "";
    while (walker.nextNode()) {
      extracted += walker.currentNode.textContent + " ";
      if (extracted.length > 4500) break;
    }

    /* Fallback: if extracted text is very small, try meta description / og:description */
    function getMetaDescription() {
      const meta = document.querySelector('meta[name="description"]') ||
                   document.querySelector('meta[property="og:description"]') ||
                   document.querySelector('meta[name="twitter:description"]');
      return meta?.getAttribute('content')?.trim() || "";
    }

    let text = (extracted || "").replace(/\s+/g, " ").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();

    if (!text || text.length < 80) {
      const metaDesc = getMetaDescription();
      if (metaDesc && metaDesc.length > text.length) {
        text = metaDesc;
      }
    }

    /* Final safety limit */
    const excerpt = (text || "").slice(0, 4000);

    /* Language detection (rough) */
    const lang = document.documentElement.lang?.split("-")[0] ||
                 (navigator.language || "en").split("-")[0] ||
                 "en";

    /* Word count (simple) */
    const word_count = excerpt ? excerpt.split(/\s+/).filter(Boolean).length : 0;

    /* Build payload */
    const payload = {
      title,
      text: excerpt,
      url: location.href,
      lang,
      word_count,
      captured_at: new Date().toISOString()
    };

    return payload;
  } catch (err) {
    console.error("[MindMark] content.js extraction failed:", err);
    return {
      title: document.title || "Untitled",
      text: "",
      url: location.href,
      lang: (document.documentElement.lang || (navigator.language || "en")).split("-")[0],
      word_count: 0,
      captured_at: new Date().toISOString()
    };
  }
})();