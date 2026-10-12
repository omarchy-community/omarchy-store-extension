// Shared API for communicating with background script
// Used by sidebar, popup, and content scripts

export const omarchyStore = {
  // Send a message to the background script
  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  },

  // Get full catalog
  async getCatalog() {
    return this.sendMessage({ type: 'GET_CATALOG' });
  },

  // Get filtered apps
  async getApps(params = {}) {
    return this.sendMessage({ type: 'GET_APPS', params });
  },

  // Get single app
  async getApp(appId) {
    return this.sendMessage({ type: 'GET_APP', appId });
  },

  // Force refresh catalog
  async refreshCatalog() {
    return this.sendMessage({ type: 'REFRESH_CATALOG' });
  },

  // Open full store website
  async openStoreWeb() {
    return this.sendMessage({ type: 'OPEN_STORE_WEB' });
  },

  // Open an https link in a new tab
  async openUrl(url) {
    return this.sendMessage({ type: 'OPEN_URL', url });
  },

  // Open side panel
  async openSidePanel() {
    const win = await chrome.windows.getCurrent();
    return chrome.sidePanel.open({ windowId: win.id });
  }
};

// Utility: copy text to clipboard
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Copy failed:', err);
    return false;
  }
}

// Utility: show toast notification
export function showToast(message, type = 'info') {
  // Simple toast implementation
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    background: var(--bg-elevated, #14141a);
    border: 1px solid var(--border, #2a2a3a);
    border-radius: var(--radius, 8px);
    color: var(--fg, #e8e8ed);
    font-size: 13px;
    box-shadow: var(--shadow, 0 4px 24px rgba(0,0,0,0.4));
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;

  // Add animation keyframes if not already added
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}