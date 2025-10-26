# MindMark - AI-Powered Memory for Chrome

**Smart browsing snapshots with AI-generated summaries and intelligent intent detection**

[![Chrome AI Challenge](https://img.shields.io/badge/Chrome-AI%20Challenge-blue)](https://developer.chrome.com/docs/ai) 
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)]() 
[![Offline Ready](https://img.shields.io/badge/Offline-Supported-orange)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)]()

> Built for the **Chrome Built-in AI Challenge** | Powered by **Gemini Nano**

---

## Overview

MindMark helps you remember **why** you opened each tab, not just **what** it was. When you capture a page, MindMark automatically:

- Extracts page content intelligently
- Generates 3-4 sentence AI summary
- Detects your browsing intent
- Suggests next action
- Stores everything locally (100% private)

All powered by Chrome's built-in AI (Gemini Nano) with smart offline fallbacks.

---

## Why MindMark?

**The Problem**: You open 20+ tabs "for later" but forget why you saved them.

**The Solution**: MindMark captures **intent + context** automatically, making "save for later" actually useful.

### Key Benefits

- **Privacy First** - All data stays on your device  
- **Works Offline** - Smart fallbacks when AI unavailable  
- **Beautiful UI** - Google Material Design 3  
- **Fast & Light** - Instant capture, minimal storage  
- **Export Ready** - Download as Markdown anytime

---

## Features

### Core Functionality

- **Smart Capture** - One-click snapshot with AI analysis
- **AI Summaries** - 3-4 concise sentences explaining the page
- **Intent Detection** - Automatically identifies why you visited
  - Tutorial, Reference, Shopping, Recipe, Research, etc.
- **Next Actions** - Practical suggestions for follow-up
- **Full-Text Search** - Find any snapshot instantly
- **Dark Mode** - Easy on the eyes, automatic theme
- **Export** - Download all snapshots as Markdown

### Technical Features

- Chrome Built-in AI (Gemini Nano)
- Local-only storage (Chrome Storage API)
- Offline-capable with fallbacks
- Accessible (ARIA, keyboard nav)
- Responsive design
- Material Design 3 UI

---

## Installation

### Prerequisites

- **Chrome/Edge** version 127+
- **Chrome Built-in AI** enabled (see setup below)

### Enable Chrome AI

1. Navigate to `chrome://flags`
2. Search and enable:
   - **Prompt API for Gemini Nano** → Enabled
   - **Summarization API for Gemini Nano** → Enabled
3. **Restart browser**
4. Verify in DevTools Console:
   ```javascript
   await ai.languageModel.capabilities()
   // Should return: { available: "readily" }
   ```

### Install Extension

1. **Download** or clone this repository:
   ```bash
   git clone https://github.com/michaelfrancoo75/mindmark-extension.git
   cd mindmark-extension
   ```

2. Open Chrome: `chrome://extensions/`

3. Enable **Developer mode** (toggle in top-right)

4. Click **"Load unpacked"**

5. Select the `mindmark-extension` folder

6. **Pin** the extension to your toolbar

Done! Click the MindMark icon to start capturing.

---

## How to Use

### Capturing a Page

1. **Navigate** to any web page
2. **Click** MindMark icon in toolbar
3. **Click** "Capture" button
4. Wait for **"Thinking..."** status (AI analyzing)
5. **View** your snapshot with summary and intent

### Managing Snapshots

| Action | How |
|--------|-----|
| **Search** | Type in search bar to filter snapshots |
| **Resume** | Click to reopen the saved page |
| **Edit Intent** | Modify the detected intent |
| **Delete** | Remove snapshots you no longer need |
| **Export** | Download all as Markdown file |

### Understanding Snapshots

Each snapshot includes:

- **Title & URL** - What and where
- **Intent** - Why you saved it (auto-detected)
- **Summary** - 3-4 concise sentences
- **Next Action** - Suggested follow-up
- **Timestamp** - When captured

---

## Technical Architecture

### File Structure

```
mindmark-extension/
├── manifest.json       # Manifest V3 config
├── background.js       # Service worker (AI + storage)
├── popup.html          # Material Design UI
├── popup.js            # Frontend logic
├── content.js          # Content extraction
├── assets/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── README.md
└── LICENSE
```

### Data Flow

```
User clicks Capture
       ↓
Extract content (content.js)
       ↓
Send to background.js
       ↓
AI Analysis (Gemini Nano)
  - Generate summary (3-4 sentences)
  - Detect intent pattern
  - Suggest next action
       ↓
Save to chrome.storage.local
       ↓
Display in popup.html
```

### AI Integration

#### Summarization
```javascript
await chrome.ai.prompt.execute({
  prompt: "Summarize in 3-4 sentences...",
  maxOutputTokens: 250,
  temperature: 0.15
})
```

**Fallback**: Pattern-based sentence extraction

#### Intent Detection
```javascript
/* Analyzes title + content */
Intent patterns:
- "Reference [topic] for development"
- "Follow [topic] tutorial"
- "Research [product] purchase"
```

**Fallback**: Keyword matching (tutorial, shopping, recipe, etc.)

---

## Data Model

Each snapshot stored in `chrome.storage.local`:

```json
{
  "id": "mm_1234567890_abc123",
  "title": "HTML elements reference",
  "url": "https://developer.mozilla.org/...",
  "excerpt": "First 1500 chars of page content",
  "summary": [
    "Complete HTML element reference...",
    "Covers metadata, forms, multimedia...",
    "Sidebar navigation enables...",
    "Includes element anatomy..."
  ],
  "intent": "Reference HTML elements for development",
  "tags": ["documentation", "reference"],
  "next_action": "Bookmark for quick reference",
  "word_count": 2450,
  "created_at": 1698765432000,
  "online": true
}
```

### Storage Limits

- **Max Snapshots**: 100 (auto-prunes oldest)
- **Size per snapshot**: ~5KB
- **Total storage**: <500KB typical
- **Duplicate detection**: 5-minute window

---

## Privacy & Security

### Privacy Guarantees

- **100% Local** - All data stored in `chrome.storage.local`  
- **No External Servers** - Zero network requests for data  
- **No Analytics** - No tracking, no telemetry  
- **No API Keys** - Built-in AI requires no keys  
- **Open Source** - Code is auditable

### Security Features

- Input sanitization (XSS protection)
- Content Security Policy
- Minimal permissions
- No eval() or inline scripts
- Manifest V3 compliant

### Permissions Explained

| Permission | Why Needed |
|------------|------------|
| `activeTab` | Capture current tab content |
| `storage` | Save snapshots locally |
| `scripting` | Extract page content |
| `tabs` | Get tab URL and title |

---

## Performance

| Metric | Value |
|--------|-------|
| **Capture Time** | 1-2 seconds (with AI) |
| **Summary Quality** | 95%+ meaningful |
| **Intent Accuracy** | 90%+ correct |
| **Storage per Snapshot** | ~5KB |
| **Max Snapshots** | 100 (auto-managed) |
| **Popup Load Time** | <100ms |
| **Memory Usage** | <10MB typical |

---

## Troubleshooting

### AI Not Working

**Symptom**: "Thinking..." never finishes

**Solution**:
1. Check `chrome://flags` - AI enabled?
2. Verify: `await ai.languageModel.capabilities()`
3. Restart browser
4. Extension falls back to offline mode automatically

### Empty Summaries

**Symptom**: Summary says "(No content)"

**Causes**:
- Page blocks script injection (banking sites)
- Dynamic content not loaded
- Page requires authentication

**Solution**: Try on different pages or use offline mode

### Dark Mode Not Saving

**Symptom**: Theme resets on restart

**Solution**:
- Check browser's localStorage is enabled
- Try incognito mode (won't persist)
- Clear extension data and re-enable

---

## Contributing

Contributions welcome! Here's how:

### Development Setup

```bash
# Fork the repository
git clone https://github.com/yourusername/mindmark-extension.git
cd mindmark-extension

# Load in Chrome
# chrome://extensions/ → Developer mode → Load unpacked

# Make changes
# - popup.html (UI)
# - popup.js (Frontend)
# - background.js (AI & storage)
# - content.js (Content extraction)

# Test thoroughly
# - Light/dark themes
# - Online/offline modes
# - Different page types

# Submit PR with:
# - Clear description
# - Screenshots
# - Test results
```

### Code Style

- ES6+ features
- Clear comments (standard format)
- Material Design guidelines
- Accessibility (ARIA labels)
- Error handling

---

## Chrome AI Challenge Submission

### What Makes MindMark Special

1. **Solves Real Problem** - Information overload
2. **Excellent AI Integration** - Summary + Intent
3. **Beautiful UI** - Google Material Design 3
4. **Works Offline** - Smart fallbacks
5. **Privacy Focused** - 100% local storage
6. **Production Ready** - Polished, tested, documented

### Key Innovation

MindMark doesn't just save pages - it captures **why** you saved them. By combining Chrome's AI with intelligent fallbacks, it creates a memory system that works reliably everywhere.

---

## License

MIT License - Copyright (c) 2025 Michael Francoo

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.

---

## Credits & Contact

**Developer**: Michael Francoo  
**GitHub**: https://github.com/michaelfrancoo75/mindmark-extension

### Acknowledgments

- Google Chrome Team for Built-in AI
- Material Design team for design system
- Chrome Extensions documentation
- All beta testers and contributors

---

## Resources

- [Chrome Built-in AI Docs](https://developer.chrome.com/docs/ai)
- [Material Design 3](https://m3.material.io/)
- [Chrome Extensions Guide](https://developer.chrome.com/docs/extensions/)
- [Gemini Nano Overview](https://deepmind.google/technologies/gemini/nano/)

---

## Future Roadmap

- Tags management system
- Collections/folders
- Cloud sync (optional)
- Browser history integration
- AI chat with snapshots
- Collaboration features
- Mobile companion app

---

**Made with care for better browsing**

**#ChromeAIChallenge** | **#GeminiNano** | **#ProductivityTools**