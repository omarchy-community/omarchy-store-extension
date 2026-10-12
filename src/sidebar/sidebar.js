// Omarchy Store Extension - Sidebar Panel
// Runs in the side panel context

import { omarchyStore } from '../shared/api.js';

// State
let allCategories = [];
let currentCategory = 'all';
let searchQuery = '';
let storeApps = [];
let installedAppIds = new Set();

// DOM Elements
const categoriesNav = document.getElementById('categories');
const searchInput = document.getElementById('search-input');
const grid = document.getElementById('grid');
const loading = document.getElementById('loading');
const empty = document.getElementById('empty');
const refreshBtn = document.getElementById('refresh-btn');
const openWebBtn = document.getElementById('open-web-btn');
const modal = document.getElementById('modal');
const modalClose = document.getElementById('modal-close');
const modalBody = document.getElementById('modal-body');
const footerLink = document.getElementById('footer-link');

// Initialize
async function init() {
  setupEventListeners();
  await loadInitialData();
}

function setupEventListeners() {
  // Search
  searchInput.addEventListener('input', debounce(handleSearch, 150));

  // Categories (delegated)
  categoriesNav.addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-btn');
    if (btn) setCategory(btn.dataset.category);
  });

  // Grid clicks (delegated)
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.store-card');
    if (card && !e.target.closest('.store-card-install')) {
      openModal(card.dataset.appId);
    }
    const installBtn = e.target.closest('.store-card-install');
    if (installBtn && !installBtn.classList.contains('installed')) {
      e.stopPropagation();
      installApp(installBtn.closest('.store-card').dataset.appId, installBtn);
    }
  });

  // Header actions
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshBtn.querySelector('svg').style.animation = 'spin 1s linear infinite';
    try {
      await omarchyStore.refreshCatalog();
      await loadStoreApps();
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.querySelector('svg').style.animation = '';
    }
  });

  openWebBtn.addEventListener('click', () => omarchyStore.openStoreWeb());
  footerLink.addEventListener('click', (e) => {
    e.preventDefault();
    omarchyStore.openStoreWeb();
  });

  // Modal
  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modal.open) closeModal();
    }
  });

  // Search requested from the popup or the right-click menu
  const takePending = async () => {
    const { pendingQuery } = await chrome.storage.session.get('pendingQuery');
    if (pendingQuery) {
      await chrome.storage.session.remove('pendingQuery');
      searchInput.value = pendingQuery;
      handleSearch({ target: searchInput });
    }
  };
  chrome.storage.session.onChanged.addListener((ch) => { if (ch.pendingQuery?.newValue) takePending(); });
  takePending();
}

async function loadInitialData() {
  try {
    const catalog = await omarchyStore.getCatalog();
    allCategories = catalog.categories || [];
    renderCategories();

    // Load installed apps from storage
    const stored = await chrome.storage.local.get('omarchy-installed-apps');
    if (stored['omarchy-installed-apps']) {
      installedAppIds = new Set(stored['omarchy-installed-apps']);
    }

    await loadStoreApps();
  } catch (err) {
    console.error('[Omarchy Store] Failed to load initial data:', err);
    loading.style.display = 'none';
    empty.style.display = 'flex';
    empty.textContent = 'Failed to load store. Click refresh to retry.';
  }
}

function renderCategories() {
  const allBtn = categoriesNav.querySelector('[data-category="all"]');
  categoriesNav.innerHTML = '';
  categoriesNav.appendChild(allBtn);

  allCategories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.dataset.category = cat.id;
    btn.textContent = cat.name;
    categoriesNav.appendChild(btn);
  });
}

async function loadStoreApps() {
  loading.style.display = 'flex';
  grid.style.display = 'none';
  empty.style.display = 'none';

  try {
    const result = await omarchyStore.getApps({ category: currentCategory === 'all' ? undefined : currentCategory, query: searchQuery });
    storeApps = result.apps || [];
    allCategories = result.categories || allCategories;
    renderStoreApps();
  } catch (err) {
    console.error('[Omarchy Store] Failed to load apps:', err);
    loading.style.display = 'none';
    empty.style.display = 'flex';
    empty.textContent = 'Failed to load apps. Click refresh to retry.';
  }
}

function renderStoreApps() {
  loading.style.display = 'none';

  if (storeApps.length === 0) {
    grid.style.display = 'none';
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';
  grid.style.display = 'grid';
  grid.innerHTML = storeApps.map(app => renderStoreCard(app)).join('');
}

function renderStoreCard(app) {
  const isInstalled = installedAppIds.has(app.id);
  const iconHtml = app.icon && app.icon.startsWith('https://')
    ? `<img src="${escapeHtml(app.icon)}" alt="" loading="lazy">`
    : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"></rect><path d="M8 21h8M12 17v4"></path></svg>`;

  return `
    <article class="store-card" data-app-id="${app.id}" tabindex="0" role="button" aria-label="${escapeHtml(app.name)} - ${escapeHtml(app.summary || '')}">
      <div class="store-card-icon">${iconHtml}</div>
      <div class="store-card-info">
        <span class="store-card-name">${escapeHtml(app.name)}</span>
        <span class="store-card-summary">${escapeHtml(app.summary || 'No description')}</span>
      </div>
      <div class="store-card-meta">
        <span class="store-card-category">${escapeHtml(app.category || 'app')}</span>
        <button class="store-card-install" title="Copy the install command">
          Copy
        </button>
      </div>
    </article>
  `;
}

function handleSearch(e) {
  searchQuery = e.target.value.trim();
  loadStoreApps();
}

function setCategory(category) {
  currentCategory = category;
  categoriesNav.querySelectorAll('.cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });
  loadStoreApps();
}

async function installApp(appId, btn) {
  const app = storeApps.find(a => a.id === appId);
  if (!app) return;

  btn.disabled = true;
  btn.textContent = 'Installing...';

  try {
    // For extension, we can't run pacman directly. Open the store web page
    // to the app detail where the user can copy the install command,
    // or we can copy it to clipboard.
    const installCmd = getInstallCommand(app);
    await navigator.clipboard.writeText(installCmd);

    btn.classList.add('installed');
    btn.textContent = 'Copied';
    setTimeout(() => { btn.classList.remove('installed'); btn.disabled = false; btn.textContent = 'Copy'; }, 2000);
  } catch (err) {
    console.error('[Omarchy Store] Install failed:', err);
    btn.disabled = false;
    btn.textContent = 'Install';
    alert(`Failed: ${err.message}`);
  }
}

function getInstallCommand(app) {
  const { install } = app;
  if (!install) return '# No install method';

  if (install.method === 'pacman') {
    return `omarchy-pkg-add ${(install.packages || []).join(' ')}`;
  } else if (install.method === 'aur') {
    return `omarchy-pkg-aur-add ${(install.packages || []).join(' ')}`;
  } else if (install.method === 'omarchy') {
    return install.command;
  } else if (install.method === 'release') {
    return `# Get ${app.name} with the Omarchy Store desktop app: https://omarchystore.com/`;
  }
  return `# Unknown method: ${install.method}`;
}

async function openModal(appId) {
  const app = await omarchyStore.getApp(appId);
  if (!app) return;

  const isInstalled = installedAppIds.has(app.id);
  const iconHtml = app.icon && app.icon.startsWith('https://')
    ? `<img src="${escapeHtml(app.icon)}" alt="" loading="lazy">`
    : `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"></rect><path d="M8 21h8M12 17v4"></path></svg>`;

  modalBody.innerHTML = `
    <div class="modal-header">
      <div class="modal-icon">${iconHtml}</div>
      <div class="modal-title-block">
        <h3 class="modal-title" id="modal-title">${escapeHtml(app.name)}</h3>
        <div class="modal-subtitle">
          <span class="modal-category">${escapeHtml(app.category || 'app')}</span>
          <span>•</span>
          <span>${escapeHtml(app.developer || 'Unknown developer')}</span>
        </div>
      </div>
    </div>
    <p class="modal-description">${escapeHtml(app.description || 'No description available.')}</p>
    <div class="modal-actions">
      <button class="modal-btn primary" id="modal-install">
        Copy install command
      </button>
      <button class="modal-btn secondary" id="modal-open-web" ${!app.homepage ? 'disabled' : ''}>
        Website
      </button>
      <button class="modal-btn secondary" id="modal-github" ${!app.github ? 'disabled' : ''}>
        GitHub
      </button>
    </div>
    ${app.github ? `
    <div class="modal-section">
      <div class="modal-section-title">Source</div>
      <div class="modal-tags">
        <span class="modal-tag">GitHub: ${escapeHtml(app.github)}</span>
      </div>
    </div>
    ` : ''}
    ${app.license ? `
    <div class="modal-section">
      <div class="modal-section-title">License</div>
      <div class="modal-tags">
        <span class="modal-tag">${escapeHtml(app.license)}</span>
      </div>
    </div>
    ` : ''}
  `;

  document.getElementById('modal-install')?.addEventListener('click', async () => {
    const btn = document.getElementById('modal-install');
    await navigator.clipboard.writeText(getInstallCommand(app));
    btn.textContent = 'Copied. Paste it in a terminal';
    setTimeout(() => { btn.textContent = 'Copy install command'; }, 2500);
  });

  document.getElementById('modal-open-web')?.addEventListener('click', () => {
    if (app.homepage) omarchyStore.openUrl(app.homepage);
  });

  document.getElementById('modal-github')?.addEventListener('click', () => {
    if (app.github) omarchyStore.openUrl(`https://github.com/${app.github}`);
  });

  modal.showModal();
}

function closeModal() {
  modal.close();
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}