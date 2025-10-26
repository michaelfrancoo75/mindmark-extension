/* popup.js - MindMark Frontend Logic (Improved Version) */
(() => {
  'use strict';

  /* DOM Element References */
  const captureBtn = document.getElementById('captureBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const exportBtn = document.getElementById('exportBtn');
  const searchInput = document.getElementById('searchInput');
  const contentArea = document.getElementById('contentArea');
  const emptyState = document.getElementById('emptyState');
  const statusBar = document.getElementById('statusBar');
  const statusText = document.getElementById('statusText');
  const darkToggle = document.getElementById('darkModeToggle');
  const intentModal = document.getElementById('intentModal');
  const deleteModal = document.getElementById('deleteModal');
  const intentInput = document.getElementById('intentInput');
  const cardTemplate = document.getElementById('cardTemplate');

  /* Constants */
  const MAX_SENTENCES = 4;
  const DEBOUNCE_DELAY = 300;
  const TOAST_DURATION = 3000;

  let currentEditId = null;
  let toastTimer = null;

  /* Send message to background script with error handling */
  async function sendMessage(payload) {
    return new Promise((resolve) => {
      try {
        if (!chrome?.runtime?.sendMessage) {
          console.error('[MindMark] Chrome runtime not available');
          resolve({ success: false, error: 'Chrome runtime unavailable' });
          return;
        }

        chrome.runtime.sendMessage(payload, (response) => {
          if (chrome.runtime.lastError) {
            console.error('[MindMark] Runtime error:', chrome.runtime.lastError);
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response || { success: false, error: 'No response' });
          }
        });
      } catch (err) {
        console.error('[MindMark] sendMessage error:', err);
        resolve({ success: false, error: err.message });
      }
    });
  }

  /* HTML escape for security */
  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str || '');
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* Debounce function */
  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /* Update status bar */
  function setStatus(text, type = 'ready') {
    if (!statusText || !statusBar) return;
    
    statusText.textContent = text;
    statusBar.classList.remove('status-loading', 'status-error');
    
    if (type === 'loading') {
      statusBar.classList.add('status-loading');
    } else if (type === 'error') {
      statusBar.classList.add('status-error');
    }
  }

  /* Show toast notification */
  function showToast(message, type = 'success') {
    let toast = document.getElementById('toast-container');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast-container';
      toast.style.cssText = `
        position: fixed;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: var(--on-surface);
        color: var(--surface);
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: var(--elevation-2);
        z-index: 10000;
        transition: transform 300ms var(--easing-emphasized);
        max-width: 90%;
        text-align: center;
      `;
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    if (type === 'error') {
      toast.style.background = 'var(--error)';
      toast.style.color = 'white';
    } else if (type === 'success') {
      toast.style.background = 'var(--success)';
      toast.style.color = 'white';
    } else {
      toast.style.background = 'var(--on-surface)';
      toast.style.color = 'var(--surface)';
    }

    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.style.transform = 'translateX(-50%) translateY(100px)';
    }, TOAST_DURATION);
  }

  /* Disable/enable action buttons */
  function setButtonsDisabled(disabled) {
    [captureBtn, refreshBtn, exportBtn].forEach(btn => {
      if (btn) {
        btn.disabled = disabled;
        btn.style.opacity = disabled ? '0.5' : '1';
        btn.style.pointerEvents = disabled ? 'none' : 'auto';
      }
    });
  }

  /* Dark Mode Management */
  function applyDarkMode(enabled) {
    document.body.classList.toggle('dark', Boolean(enabled));
    
    if (darkToggle) {
      const icon = darkToggle.querySelector('.material-icons-round');
      if (icon) {
        icon.textContent = enabled ? 'light_mode' : 'dark_mode';
      }
      darkToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    }

    try {
      localStorage.setItem('mindmark_dark', enabled ? '1' : '0');
    } catch (e) {
      console.warn('[MindMark] Could not save dark mode:', e);
    }
  }

  function loadDarkMode() {
    try {
      const enabled = localStorage.getItem('mindmark_dark') === '1';
      applyDarkMode(enabled);
    } catch (e) {
      console.warn('[MindMark] Could not load dark mode:', e);
    }
  }

  function toggleDarkMode() {
    const willBeDark = !document.body.classList.contains('dark');
    applyDarkMode(willBeDark);
    showToast(willBeDark ? 'Dark mode enabled' : 'Light mode enabled');
  }

  if (darkToggle) {
    darkToggle.addEventListener('click', toggleDarkMode);
  }

  /* Toggle empty state visibility */
  function toggleEmptyState(isEmpty) {
    if (!emptyState || !contentArea) return;

    if (isEmpty) {
      document.body.classList.add('has-no-snapshots');
      emptyState.classList.add('visible');
      contentArea.innerHTML = '';
    } else {
      document.body.classList.remove('has-no-snapshots');
      emptyState.classList.remove('visible');
    }
  }

  /* Load and display snapshots */
  async function loadSnapshots(options = {}) {
    const { suppressStatus = false, finalStatus = 'Ready to capture' } = options;

    try {
      if (!suppressStatus) {
        setStatus('Loading snapshots...', 'loading');
      }

      const response = await sendMessage({ action: 'get_snapshots' });

      if (!response.success) {
        throw new Error(response.error || 'Failed to load snapshots');
      }

      const snapshots = Array.isArray(response.data) ? response.data : [];
      const query = (searchInput?.value || '').trim().toLowerCase();

      const filtered = query
        ? snapshots.filter(s => {
            const title = (s.title || '').toLowerCase();
            const intent = (s.intent || '').toLowerCase();
            const url = (s.url || '').toLowerCase();
            const summary = Array.isArray(s.summary)
              ? s.summary.join(' ').toLowerCase()
              : String(s.summary || '').toLowerCase();
            
            return title.includes(query) || 
                   intent.includes(query) || 
                   url.includes(query) || 
                   summary.includes(query);
          })
        : snapshots;

      if (contentArea) contentArea.innerHTML = '';

      if (!snapshots.length) {
        if (emptyState) {
          emptyState.innerHTML = `
            <div class="empty-icon">📚</div>
            <div class="empty-title">No snapshots yet</div>
            <div class="empty-description">
              Capture your first page with AI-powered summaries and smart intent detection
            </div>
          `;
        }
        toggleEmptyState(true);
        if (!suppressStatus) setStatus(finalStatus);
        return;
      }

      if (!filtered.length) {
        if (emptyState) {
          emptyState.innerHTML = `
            <div class="empty-icon">🔍</div>
            <div class="empty-title">No matches found</div>
            <div class="empty-description">
              Try a different search term
            </div>
          `;
        }
        toggleEmptyState(true);
        if (!suppressStatus) setStatus(finalStatus);
        return;
      }

      const fragment = document.createDocumentFragment();
      for (const snapshot of filtered) {
        const card = createCard(snapshot);
        if (card) fragment.appendChild(card);
      }

      if (contentArea) contentArea.appendChild(fragment);
      toggleEmptyState(false);
      
      if (!suppressStatus) {
        setStatus(finalStatus);
      }

    } catch (err) {
      console.error('[MindMark] Load snapshots error:', err);
      
      if (emptyState) {
        emptyState.innerHTML = `
          <div class="empty-icon">⚠️</div>
          <div class="empty-title">Error loading snapshots</div>
          <div class="empty-description">${escapeHtml(err.message)}</div>
        `;
      }
      
      toggleEmptyState(true);
      
      if (!suppressStatus) {
        setStatus('Error loading snapshots', 'error');
        showToast('Failed to load snapshots', 'error');
      }
    }
  }

  /* Create snapshot card element */
  function createCard(snapshot) {
    if (!snapshot || !cardTemplate) return null;

    const clone = cardTemplate.content.cloneNode(true);
    const card = clone.querySelector('.snapshot-card');
    
    if (!card) return null;

    const titleEl = clone.querySelector('.card-title');
    if (titleEl) {
      titleEl.textContent = snapshot.title || 'Untitled Page';
    }

    const urlEl = clone.querySelector('.card-url');
    if (urlEl) {
      urlEl.textContent = snapshot.url || '';
    }

    const intentEl = clone.querySelector('.intent-text');
    if (intentEl) {
      intentEl.textContent = snapshot.intent || 'Review this page';
    }

    const summaryEl = clone.querySelector('.summary-content');
    if (summaryEl && snapshot.summary) {
      const summaryArray = Array.isArray(snapshot.summary)
        ? snapshot.summary
        : (typeof snapshot.summary === 'string'
            ? snapshot.summary.split(/(?<=[.!?])\s+/).filter(Boolean)
            : []);

      const displaySentences = summaryArray.slice(0, MAX_SENTENCES);

      summaryEl.innerHTML = displaySentences
        .map(line => `<div class="summary-line">${escapeHtml(line)}</div>`)
        .join('');

      if (summaryArray.length > MAX_SENTENCES) {
        summaryEl.classList.add('expandable');
        summaryEl.title = 'Click to expand';
        summaryEl.dataset.full = JSON.stringify(summaryArray);
        summaryEl.dataset.preview = JSON.stringify(displaySentences);

        summaryEl.addEventListener('click', function toggleExpand() {
          const isExpanded = this.classList.toggle('expanded');
          const full = JSON.parse(this.dataset.full || '[]');
          const preview = JSON.parse(this.dataset.preview || '[]');

          this.innerHTML = (isExpanded ? full : preview)
            .map(line => `<div class="summary-line">${escapeHtml(line)}</div>`)
            .join('');

          this.title = isExpanded ? 'Click to collapse' : 'Click to expand';
        });
      }
    }

    const timestampEl = clone.querySelector('.timestamp');
    if (timestampEl && snapshot.created_at) {
      const date = new Date(snapshot.created_at);
      timestampEl.textContent = date.toLocaleString();
    }

    const resumeBtn = clone.querySelector('.btn-resume');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => {
        if (snapshot.url) {
          try {
            chrome.tabs.create({ url: snapshot.url });
          } catch (e) {
            window.open(snapshot.url, '_blank');
          }
        }
      });
    }

    const editBtn = clone.querySelector('.btn-edit');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        currentEditId = snapshot.id;
        if (intentInput) intentInput.value = snapshot.intent || '';
        openModal(intentModal);
        setTimeout(() => intentInput?.focus(), 100);
      });
    }

    const deleteBtn = clone.querySelector('.btn-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        currentEditId = snapshot.id;
        openModal(deleteModal);
      });
    }

    return clone;
  }

  /* Capture current tab */
  async function captureCurrentTab() {
    try {
      setStatus('Thinking...', 'loading');
      setButtonsDisabled(true);

      const response = await sendMessage({ action: 'capture_current_tab' });

      setButtonsDisabled(false);

      if (!response.success) {
        setStatus('Capture failed', 'error');
        showToast(response.error || 'Failed to capture page', 'error');
        return;
      }

      const snapshot = response.data;
      const intent = snapshot?.intent || 'Review';

      setStatus('Page captured successfully');
      showToast(`Saved: ${intent}`, 'success');

      await loadSnapshots();

    } catch (err) {
      console.error('[MindMark] Capture error:', err);
      setButtonsDisabled(false);
      setStatus('Capture failed', 'error');
      showToast('Failed to capture page', 'error');
    }
  }

  /* Export markdown */
  async function exportMarkdown() {
    try {
      setStatus('Exporting...', 'loading');
      setButtonsDisabled(true);

      const response = await sendMessage({ action: 'export_markdown' });

      setButtonsDisabled(false);

      if (!response.success || !response.data) {
        setStatus('Export failed', 'error');
        showToast('Export failed', 'error');
        return;
      }

      const blob = new Blob([response.data], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mindmark_export_${Date.now()}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setStatus('Exported successfully');
      showToast('Markdown exported', 'success');

    } catch (err) {
      console.error('[MindMark] Export error:', err);
      setButtonsDisabled(false);
      setStatus('Export failed', 'error');
      showToast('Export failed', 'error');
    }
  }

  /* Modal management */
  function openModal(modal) {
    if (!modal) return;
    modal.classList.add('visible');
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('visible');
    currentEditId = null;
  }

  [intentModal, deleteModal].forEach(modal => {
    if (!modal) return;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (intentModal?.classList.contains('visible')) closeModal(intentModal);
      if (deleteModal?.classList.contains('visible')) closeModal(deleteModal);
    }
  });

  /* Intent modal */
  if (intentModal) {
    const closeBtn = intentModal.querySelector('[data-action="close-intent"]');
    const saveBtn = intentModal.querySelector('[data-action="save-intent"]');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => closeModal(intentModal));
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        try {
          const newIntent = (intentInput?.value || '').trim();

          if (!newIntent) {
            showToast('Intent cannot be empty', 'error');
            return;
          }

          if (!currentEditId) {
            showToast('No snapshot selected', 'error');
            return;
          }

          setStatus('Updating intent...', 'loading');

          const response = await sendMessage({
            action: 'update_snapshot_intent',
            id: currentEditId,
            new_intent: newIntent
          });

          if (response.success) {
            showToast('Intent updated', 'success');
            await loadSnapshots();
          } else {
            showToast('Failed to update intent', 'error');
          }
        } catch (err) {
          console.error('[MindMark] Update intent error:', err);
          showToast('Failed to update intent', 'error');
        } finally {
          closeModal(intentModal);
          setStatus('Ready to capture');
        }
      });
    }
  }

  /* Delete modal */
  if (deleteModal) {
    const closeBtn = deleteModal.querySelector('[data-action="close-delete"]');
    const confirmBtn = deleteModal.querySelector('[data-action="confirm-delete"]');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => closeModal(deleteModal));
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        try {
          if (!currentEditId) {
            showToast('No snapshot selected', 'error');
            return;
          }

          setStatus('Deleting...', 'loading');

          const response = await sendMessage({
            action: 'delete_snapshot',
            id: currentEditId
          });

          if (response.success) {
            showToast('Snapshot deleted', 'success');
            await loadSnapshots();
          } else {
            showToast('Failed to delete snapshot', 'error');
          }
        } catch (err) {
          console.error('[MindMark] Delete error:', err);
          showToast('Failed to delete', 'error');
        } finally {
          closeModal(deleteModal);
          setStatus('Ready to capture');
        }
      });
    }
  }

  /* Search functionality */
  if (searchInput) {
    const debouncedSearch = debounce(() => loadSnapshots(), DEBOUNCE_DELAY);
    
    searchInput.addEventListener('input', debouncedSearch);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loadSnapshots();
    });
  }

  /* Button event handlers */
  if (captureBtn) {
    captureBtn.addEventListener('click', captureCurrentTab);
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await loadSnapshots({ finalStatus: 'Refreshed' });
      showToast('List refreshed', 'success');
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', exportMarkdown);
  }

  /* Initialization */
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[MindMark] Popup initialized');

    loadDarkMode();
    loadSnapshots();

    setTimeout(() => {
      if (searchInput && !searchInput.value) {
        searchInput.focus();
      }
    }, 200);
  });

})();