// content.js - MindMark content extractor
(() => {
  try {
    const title = document.title?.trim() || "Untitled Page";

    // Prefer semantic containers for main content
    const main =
      document.querySelector("article, main, #content, .post, .article") ||
      document.body;

    let text = main?.innerText || "";
    text = text.replace(/\s+/g, " ").trim();

    // Clip to 4000 chars to keep payload small
    const excerpt = text.slice(0, 4000);

    // Return lightweight structured payload
    return {
      title,
      text: excerpt,
      url: location.href
    };
  } catch (err) {
    console.error("[MindMark] content.js extraction failed:", err);
    return {
      title: document.title || "Untitled",
      text: "",
      url: location.href
    };
  }
})();