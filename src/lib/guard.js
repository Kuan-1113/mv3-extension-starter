/**
 * Guards against the failure mode that actually costs you reviews.
 *
 * In MV3, most things that break do so silently: a promise that never settles,
 * a message to a worker that was already torn down, a WASM module the CSP
 * refuses to compile. The user sees a spinner that never stops and writes
 * "doesn't work, 1 star". Nothing appears in any console you will ever read.
 *
 * The rule this file exists to enforce: every await that crosses a boundary
 * gets a timeout, and every failure becomes something the user can see.
 */

/** Reject if `promise` hasn't settled in `ms`. `label` ends up in the message. */
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error((label || 'operation') + ' timed out after ' + ms + 'ms')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * sendMessage that resolves to {ok:false,error} instead of throwing.
 *
 * chrome.runtime.sendMessage rejects when nothing is listening — which happens
 * routinely, because the service worker sleeps. Callers that don't handle it
 * turn a recoverable hiccup into an unhandled rejection and a dead UI.
 */
async function send(msg, ms) {
  try {
    const res = await withTimeout(chrome.runtime.sendMessage(msg), ms || 15000, msg && msg.type);
    return res || { ok: false, error: 'no response' };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

/**
 * Copy text without asking for the clipboard permission.
 *
 * navigator.clipboard.writeText in a content script triggers a permission
 * prompt the user did not ask for, on a page they were just browsing. That
 * prompt alone is worth a bad review. execCommand is deprecated and works
 * everywhere, and needs no permission at all.
 */
function copyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  document.body.removeChild(ta);
  return ok;
}

if (typeof self !== 'undefined') {
  self.withTimeout = withTimeout;
  self.send = send;
  self.copyText = copyText;
}
