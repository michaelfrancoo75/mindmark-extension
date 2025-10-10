// popup.js — MindMark UI Controller

// Handle offline notice at startup
window.addEventListener("load", () => {
  const offlineBanner = document.getElementById("offlineBanner");
  if (!navigator.onLine && offlineBanner) {
    offlineBanner.style.display = "block";
  }
});

// Listen for online/offline state changes
window.addEventListener("online", () => {
  const offlineBanner = document.getElementById("offlineBanner");
  if (offlineBanner) offlineBanner.style.display = "none";
});

window.addEventListener("offline", () => {
  const offlineBanner = document.getElementById("offlineBanner");
  if (offlineBanner) offlineBanner.style.display = "block";
});

// UI elements
const statusEl = document.getElementById("status");
const captureBtn = document.getElementById("captureBtn");
const refreshBtn = document.getElementById("refreshBtn");
const exportBtn = document.getElementById("exportBtn");
const snapshotsEl = document.getElementById("snapshots");
const latestEl = document.getElementById("latest");
const latestTitle = document.getElementById("latestTitle");
const latestUrl = document.getElementById("latestUrl");
const latestIntent = document.getElementById("latestIntent");
const latestSummary = document.getElementById("latestSummary");
const openTabBtn = document.getElementById("openTabBtn");
const loader = document.getElementById("loader");
const toast = document.getElementById("toast");

if (!captureBtn || !statusEl) {
  console.warn("[MindMark] popup UI not fully loaded.");
}

// Utility functions
function setStatus(msg) {
  statusEl.textContent = msg;
}

function toggleLoader(show) {
  loader.style.display = show ? "block" : "none";
}

function showToast(msg, color = "#16a34a") {
  if (!toast) return;
  toast.textContent = msg;
  toast.style.background = color;
  toast.style.display = "block";
  setTimeout(() => (toast.style.display = "none"), 2500);
}

function disableButtons(state) {
  [captureBtn, refreshBtn, exportBtn].forEach(btn => {
    if (btn) btn.disabled = state;
  });
}

// Capture current tab
captureBtn.addEventListener("click", async () => {
  setStatus("Capturing tab...");
  toggleLoader(true);
  disableButtons(true);

  chrome.runtime.sendMessage({ action: "capture_current_tab" }, (res) => {
    toggleLoader(false);
    disableButtons(false);

    if (!res) {
      setStatus("No response from background.");
      showToast("Capture failed", "#dc2626");
      return;
    }
    if (!res.success) {
      setStatus("Error: " + (res.error || "Unknown"));
      showToast("Error capturing tab", "#dc2626");
      return;
    }

    if (!navigator.onLine) {
      setStatus("Captured using offline summarizer");
      showToast("Captured offline summary", "#f59e0b");
    } else {
      setStatus("Captured and saved.");
      showToast("Snapshot saved");
    }

    renderLatest(res.data);
    loadSnapshots();
  });
});

// Refresh saved snapshots
refreshBtn.addEventListener("click", () => {
  loadSnapshots();
  setStatus("Refreshed.");
  showToast("Snapshots reloaded");
});

// Export Markdown
exportBtn.addEventListener("click", () => {
  setStatus("Building Markdown export...");
  toggleLoader(true);
  disableButtons(true);

  chrome.runtime.sendMessage({ action: "export_markdown" }, (res) => {
    toggleLoader(false);
    disableButtons(false);

    if (!res || !res.success) {
      setStatus("Export failed.");
      showToast("Export failed", "#dc2626");
      return;
    }

    const md = res.data || "";
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mindmark_export.md";
    a.click();
    URL.revokeObjectURL(url);

    setStatus("Export downloaded.");
    showToast("Markdown exported");
  });
});

// Load and render snapshot list
function loadSnapshots() {
  chrome.runtime.sendMessage({ action: "get_snapshots" }, (res) => {
    const snaps = (res && res.success && res.data) ? res.data : [];
    if (!snaps.length) {
      snapshotsEl.innerHTML = "<div class='muted'>No snapshots yet.</div>";
      return;
    }

    snapshotsEl.innerHTML = "";
    snaps.forEach((s) => {
      const wrapper = document.createElement("div");
      wrapper.className = "card";

      wrapper.innerHTML = `
        <div class="snapshot-title">${s.title}</div>
        <div class="muted small">${s.url}</div>
        <div><strong>Intent:</strong> ${s.intent}</div>
        <div><strong>Summary:</strong><br>${(s.summary || [])
          .map((b) => "- " + b)
          .join("<br>")}</div>
        <div class="actions" style="margin-top:8px;">
          <button data-id="${s.id}" class="openBtn">Resume</button>
          <button data-id="${s.id}" class="editBtn">Edit Intent</button>
          <button data-id="${s.id}" class="delBtn">Delete</button>
        </div>
      `;

      snapshotsEl.appendChild(wrapper);
    });

    attachSnapshotHandlers();
  });
}

// Attach action handlers
function attachSnapshotHandlers() {
  document.querySelectorAll(".openBtn").forEach((b) =>
    b.addEventListener("click", (e) => {
      const id = e.target.getAttribute("data-id");
      openSnapshot(id);
    })
  );

  document.querySelectorAll(".editBtn").forEach((b) =>
    b.addEventListener("click", (e) => {
      const id = e.target.getAttribute("data-id");
      editSnapshotIntent(id);
    })
  );

  document.querySelectorAll(".delBtn").forEach((b) =>
    b.addEventListener("click", (e) => {
      const id = e.target.getAttribute("data-id");
      deleteSnapshot(id);
    })
  );
}

// Open snapshot (offline-aware)
function openSnapshot(id) {
  if (!navigator.onLine) {
    showToast("Offline — cannot open live page", "#f59e0b");
    return;
  }

  chrome.runtime.sendMessage({ action: "get_snapshots" }, (res) => {
    const snaps = res?.data || [];
    const s = snaps.find((x) => x.id === id);
    if (s) {
      chrome.tabs.create({ url: s.url });
      setStatus("Opening tab...");
    } else {
      setStatus("Snapshot not found.");
    }
  });
}

// Edit snapshot intent
function editSnapshotIntent(id) {
  const newIntent = prompt("Edit intent (will overwrite):");
  if (newIntent === null) return;

  setStatus("Saving new intent...");
  toggleLoader(true);

  chrome.runtime.sendMessage({ action: "polish_text", text: newIntent }, (res) => {
    const polished = res?.success && res.data ? res.data : newIntent;

    chrome.runtime.sendMessage(
      { action: "update_snapshot_intent", id, new_intent: polished },
      () => {
        toggleLoader(false);
        setStatus("Intent updated.");
        showToast("Intent updated");
        loadSnapshots();
      }
    );
  });
}

// Delete snapshot
function deleteSnapshot(id) {
  if (!confirm("Delete this snapshot?")) return;
  chrome.runtime.sendMessage({ action: "delete_snapshot", id }, () => {
    setStatus("Snapshot deleted.");
    showToast("Deleted", "#dc2626");
    loadSnapshots();
  });
}

// Render latest captured snapshot
function renderLatest(snapshot) {
  if (!snapshot) {
    latestEl.style.display = "none";
    return;
  }

  latestEl.style.display = "block";
  latestTitle.textContent = snapshot.title;
  latestUrl.textContent = snapshot.url;
  latestIntent.innerHTML = `<strong>Intent:</strong> ${snapshot.intent}`;
  latestSummary.innerHTML = `<strong>Summary:</strong><br>${(snapshot.summary || [])
    .map((b) => "- " + b)
    .join("<br>")}`;
  openTabBtn.onclick = () => openSnapshot(snapshot.id);
}

// Initial load
document.addEventListener("DOMContentLoaded", loadSnapshots);
