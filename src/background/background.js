// Omarchy Store extension: background service worker.
// Fetches and caches the store catalog, answers the popup and side panel.

const SITE = 'https://omarchystore.com/';
const SOURCES = [SITE + 'catalog.json', 'https://raw.githubusercontent.com/omarchy-community/store/main/site/catalog.json'];
const CACHE_KEY = 'omarchy-store-catalog';
const CACHE_TTL = 3600000; // 1 hour

let mem = null;
let memAt = 0;

// Keep only what the panel needs (the full catalog is several MB; storage.local has a quota).
function slim(cat) {
  const abs = (u) => (!u ? '' : /^https?:\/\//.test(u) ? u : SITE + u.replace(/^\//, ''));
  return {
    categories: cat.categories || [],
    apps: (cat.apps || []).map((a) => ({
      id: a.id, name: a.name, category: a.category, summary: a.summary || '',
      description: (a.description || '').slice(0, 1500), developer: a.developer || '',
      icon: abs(a.icon), homepage: a.homepage || '', github: a.github || '', license: a.license || '',
      install: a.install ? { method: a.install.method, packages: a.install.packages || [], command: a.install.command || '' } : null,
    })),
  };
}

async function refreshCatalog() {
  for (const url of SOURCES) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) continue;
      mem = slim(await r.json());
      memAt = Date.now();
      await chrome.storage.local.set({ [CACHE_KEY]: mem, [CACHE_KEY + '-ts']: memAt });
      return mem;
    } catch (_) { /* try next source */ }
  }
  const c = await chrome.storage.local.get([CACHE_KEY, CACHE_KEY + '-ts']);
  if (c[CACHE_KEY]) { mem = c[CACHE_KEY]; memAt = c[CACHE_KEY + '-ts'] || 0; return mem; }
  throw new Error('The store catalog could not be loaded. Check your connection.');
}

async function getCatalog() {
  if (mem && Date.now() - memAt < CACHE_TTL) return mem;
  const c = await chrome.storage.local.get([CACHE_KEY, CACHE_KEY + '-ts']);
  if (c[CACHE_KEY] && Date.now() - (c[CACHE_KEY + '-ts'] || 0) < CACHE_TTL) {
    mem = c[CACHE_KEY]; memAt = c[CACHE_KEY + '-ts']; return mem;
  }
  return refreshCatalog();
}

async function getApps({ category, query, limit = 60, offset = 0 } = {}) {
  const cat = await getCatalog();
  let apps = cat.apps;
  if (category && category !== 'all') apps = apps.filter((a) => a.category === category);
  if (query) {
    const q = query.toLowerCase();
    apps = apps.filter((a) => a.name.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q));
  }
  return { apps: apps.slice(offset, offset + limit), total: apps.length, categories: cat.categories };
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'omarchy-store-search', title: 'Search Omarchy Store for "%s"', contexts: ['selection'] });
  refreshCatalog().catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  (async () => {
    switch (msg.type) {
      case 'GET_CATALOG': return getCatalog();
      case 'GET_APPS': return getApps(msg.params);
      case 'GET_APP': return (await getCatalog()).apps.find((a) => a.id === msg.appId) || null;
      case 'REFRESH_CATALOG': return refreshCatalog();
      case 'OPEN_STORE_WEB': await chrome.tabs.create({ url: SITE }); return { ok: true };
      case 'OPEN_URL':
        if (/^https:\/\//.test(msg.url || '')) await chrome.tabs.create({ url: msg.url });
        return { ok: true };
      case 'SEARCH_QUERY': return { ok: true }; // relayed to the side panel by the runtime
      default: throw new Error('Unknown message ' + msg.type);
    }
  })().then(reply, (e) => reply({ error: e.message }));
  return true;
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'omarchy-store-search' || !info.selectionText) return;
  await chrome.storage.session.set({ pendingQuery: info.selectionText });
  await chrome.sidePanel.open({ windowId: tab.windowId });
});
