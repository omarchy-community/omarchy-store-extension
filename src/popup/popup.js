// Omarchy Store Extension - Popup
import { omarchyStore } from '../shared/api.js';

const searchInput = document.getElementById('search-input');
const statsEl = document.getElementById('stats');
const openStoreBtn = document.getElementById('open-store-btn');
const openSidebarBtn = document.getElementById('open-sidebar-btn');
const openSidebarHeaderBtn = document.getElementById('open-sidebar');

async function init() {
  setupEventListeners();
  await loadStats();
}

function setupEventListeners() {
  searchInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = searchInput.value.trim();
      if (query) {
        // Open sidebar with search query
        await chrome.storage.session.set({ pendingQuery: query });
        await omarchyStore.openSidePanel();
        window.close();
      }
    }
  });

  openStoreBtn.addEventListener('click', async () => {
    await omarchyStore.openStoreWeb();
    window.close();
  });

  openSidebarBtn.addEventListener('click', async () => {
    await omarchyStore.openSidePanel();
    window.close();
  });

  openSidebarHeaderBtn.addEventListener('click', async () => {
    await omarchyStore.openSidePanel();
    window.close();
  });
}

async function loadStats() {
  try { await omarchyStore.getCatalog(); } catch (_) {}
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}