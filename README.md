# MindMark — Intent-Aware Tab Saver

MindMark helps you remember *why* you opened each tab — not just *what* it was. It captures the tab’s content, infers your **intent**, generates a concise **summary**, and suggests the next **action** — all stored **locally** for privacy and offline use.

---

## Overview

Most people keep many tabs open “for later.” MindMark helps you:

* Capture a snapshot of any page (title, excerpt, URL).
* Automatically summarize and infer your intent.
* Resume, edit, or export your saved ideas anytime — even offline.
* Works 100% locally. No external API calls. No tracking.

---

## Features (MVP)

| Feature                | Description                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------- |
| **Intent Capture**     | Infers *why* you opened the page (e.g., Read tutorial, Research purchase).         |
| **AI Summaries**       | Uses Chrome’s built-in `chrome.ai.summarizer` to produce concise bullet summaries. |
| **Offline Support**    | Works without internet: uses fallback summarizer and heuristics.                   |
| **Local-Only Storage** | All snapshots saved via `chrome.storage.local` — never leaves your device.         |
| **Edit & Polish**      | Refine your intent with optional AI text polishing (`chrome.ai.writer`).           |
| **Markdown Export**    | Export all saved sessions to `mindmark_export.md`.                                 |
| **Privacy-First**      | No analytics, servers, or remote APIs.                                             |

---

## Offline Behavior

MindMark gracefully handles offline conditions:

* When **offline**, AI summarization and polishing APIs are unavailable.
* It automatically uses the built-in `fallbackSummarize()` and `fallbackInferIntent()` functions.
* Captured tabs are still saved locally.
* When viewing saved snapshots offline:

  * You can still **read**, **edit**, or **export** them.
  * Attempting to reopen a page will show a toast: *"Offline — cannot open live page"*.

---

## How to Install (Developer Mode)

1. Clone or download the repository:

   ```bash
   git clone https://github.com/michaelfrancoo75/mindmark-extension.git
   ```

2. Open Chrome and navigate to:

   ```
   chrome://extensions
   ```

3. Enable **Developer Mode** (top right corner).

4. Click **Load unpacked** and select the `mindmark-extension` folder.

5. The MindMark icon will appear in the Chrome toolbar.

---

## How to Use

1. Navigate to any web page.
2. Click the **MindMark** icon.
3. Press **Capture Tab** to snapshot the current page.
4. MindMark will summarize and infer your intent.
5. View your saved snapshots, edit intent, delete, or export to Markdown.
6. Works even when offline — your snapshots are always accessible locally.

---

## Technical Details

### Manifest

* Uses **Manifest V3** with service worker (`background.js`).
* `permissions`: `activeTab`, `tabs`, `storage`, `scripting`.
* `host_permissions`: `<all_urls>`.
* Content security: `script-src 'self'`.

### Key Files

| File            | Description                                                            |
| --------------- | ---------------------------------------------------------------------- |
| `manifest.json` | Chrome extension metadata.                                             |
| `background.js` | Service worker handling captures, summaries, AI, storage, and exports. |
| `popup.js`      | UI logic for capturing, editing, and viewing snapshots.                |
| `popup.html`    | Extension popup interface.                                             |
| `content.js`    | Extracts title and readable text from pages.                           |
| `assets/`       | Icons and visuals.                                                     |

### AI Logic

* Uses Chrome’s experimental `chrome.ai` APIs when online.
* Falls back to local summarizer and intent heuristics when offline.
* Offline summary example:

  ```js
  function fallbackSummarize(text, maxBullets = 3) {
    if (!text) return ["(no text)"];

    let clean = text
      .replace(/[\{\}\[\]\+\=\<\>\;\:\(\)\/\\]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/https?:\/\/\S+/g, "")
      .trim();

    const sentences = clean.match(/[^.!?]+[.!?]?/g) || [clean];
    const filtered = sentences.filter(s => s.length > 20);
    const bullets = filtered.slice(0, maxBullets).map(s => s.trim());

    return bullets.length ? bullets : [clean.substring(0, 200)];
  }
  ```

---

## Demo (Optional for Challenge Submission)

To record your demo:

1. Use OBS or SimpleScreenRecorder.
2. Show how to:

   * Open any page.
   * Click **Capture Tab**.
   * See AI summary and intent inference.
   * Disconnect internet (offline mode) and capture again.
   * Export to Markdown.

Include the demo in your submission as `demo.mp4` or upload via challenge portal.

---

## Data Privacy

MindMark is completely local-first:

* No network requests to external servers.
* No API keys or credentials.
* Data is stored using Chrome’s secure local storage.
* You can clear all saved data anytime from extension settings or developer console.

---

## Known Limitations

* Chrome AI APIs (`chrome.ai.summarizer`, `chrome.ai.prompt`) are experimental.
* On older Chrome versions or offline, only fallback logic runs.
* Export is plain Markdown (no formatting beyond bullets and headers).

---

## Future Enhancements

* Add tag-based filtering and search for saved snapshots.
* Enable synchronization via Google Drive (optional, user opt-in).
* Add visual dashboard for timeline-based recall.
* Integrate lightweight text-to-speech for summaries.

---

## License

This project is licensed under the MIT License — see the LICENSE file for details.

---

## Credits

Developed by Michael Francoo for the **Chrome AI Challenge** (2025).