importScripts('lib/guard.js');

const OFFSCREEN = 'offscreen.html';
const IDLE_ALARM = 'closeOffscreen';
const IDLE_MINUTES = 5;

// ---------------------------------------------------------------------------
// First run
// ---------------------------------------------------------------------------

// People do not discover right-click menus or keyboard shortcuts on their own.
// If your extension has any feature that isn't the toolbar button, show the
// guide once, on install. Not on update — that reads as spam.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.runtime.openOptionsPage();

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'guide', title: 'Guide and settings', contexts: ['action'] });
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'guide') chrome.runtime.openOptionsPage();
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  // chrome:// pages and the Web Store refuse injection. Say so instead of
  // failing silently — the user will otherwise think the extension is broken.
  if (!/^https?:/.test(tab.url || '')) {
    chrome.runtime.openOptionsPage();
    return;
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['lib/guard.js', 'content.js'] });
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] });
    await chrome.tabs.sendMessage(tab.id, { type: 'START' });
  } catch (e) {
    console.warn('inject failed', e);
  }
});

// ---------------------------------------------------------------------------
// Offscreen document — where heavy work goes
// ---------------------------------------------------------------------------

/**
 * A service worker is killed after ~30s idle and cannot use the DOM, canvas,
 * or (usefully) WASM. Anything heavy belongs in an offscreen document.
 *
 * getContexts is the only reliable way to know whether one already exists;
 * calling createDocument twice throws, and tracking it in a variable does not
 * survive the worker being torn down.
 */
async function ensureOffscreen() {
  const existing = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (!existing.length) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN,
      reasons: ['WORKERS'],
      justification: 'Runs the processing pipeline off the service worker so it cannot be killed mid-task.'
    });
  }
  // An idle offscreen document holds its whole heap — for a WASM engine that is
  // tens of megabytes sitting in the user's RAM forever. Close it when quiet.
  chrome.alarms.create(IDLE_ALARM, { delayInMinutes: IDLE_MINUTES });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== IDLE_ALARM) return;
  const existing = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existing.length) await chrome.offscreen.closeDocument();
});

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === 'OPEN_OPTIONS') { chrome.runtime.openOptionsPage(); return; }

  if (msg.type === 'PROCESS') {
    (async () => {
      try {
        await ensureOffscreen();
        // Every hop gets a timeout. Without this, one stuck worker means a
        // spinner that never stops and a user who never tells you why.
        const res = await withTimeout(
          chrome.runtime.sendMessage({ type: 'OFFSCREEN_PROCESS', payload: msg.payload }),
          30000, 'processing');
        sendResponse(res);
      } catch (e) {
        sendResponse({ ok: false, error: String((e && e.message) || e) });
      }
    })();
    return true;   // REQUIRED: keeps the channel open for the async reply
  }
});
