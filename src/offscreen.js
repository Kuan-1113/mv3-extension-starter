/**
 * The offscreen document: a real page with a DOM, canvas, and WASM, that the
 * browser will not kill mid-task the way it kills a service worker.
 *
 * Replace `doWork` with the actual pipeline — OCR, PDF rendering, image
 * processing, whatever the extension is for. Everything else here is the
 * scaffolding that keeps failures visible.
 */

// Anything expensive is built once and reused. Building it per request is the
// difference between 0.2s and 4s on the second run.
let engine = null;

async function getEngine() {
  if (engine) return engine;
  // If you load WASM here, the manifest needs 'wasm-unsafe-eval' in
  // content_security_policy.extension_pages. Without it, compilation throws a
  // CompileError, and if you forgot to await it inside a try, the promise
  // never settles and the UI hangs forever with no error anywhere.
  engine = { ready: true };
  return engine;
}

async function doWork(payload) {
  const e = await getEngine();
  if (!e.ready) throw new Error('engine failed to start');

  // --- replace this with the real work ------------------------------------
  const text = String(payload && payload.text ? payload.text : '');
  return { chars: text.length, upper: text.toUpperCase() };
  // ------------------------------------------------------------------------
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'OFFSCREEN_PROCESS') return;

  (async () => {
    try {
      const result = await withTimeout(doWork(msg.payload), 25000, 'work');
      sendResponse({ ok: true, result });
    } catch (e) {
      // Always answer. A handler that throws leaves the caller waiting for a
      // reply that will never come — the single most common cause of an
      // extension that "just spins".
      sendResponse({ ok: false, error: String((e && e.message) || e) });
    }
  })();

  return true;
});
