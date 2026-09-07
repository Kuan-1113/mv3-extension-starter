# Chrome Manifest V3 starter — offscreen, timeouts, and a build that fails closed

A small MV3 skeleton for extensions that do **real work in the browser** and
never upload anything: heavy processing in an offscreen document, an injected
overlay, an options page that opens itself on first run, and a build script
that ships an allowlist instead of a folder.

No framework. No bundler. No build step other than `python tools/package.py`.

```bash
git clone https://github.com/Kuan-1113/mv3-extension-starter
# chrome://extensions → Developer mode → Load unpacked → pick src/
# then edit doWork() in src/offscreen.js
```

---

## What it is actually for

MV3 breaks things that worked fine in MV2, and it breaks them **silently**.
The service worker is killed after ~30 seconds idle. It has no DOM, no canvas,
and no usable WASM. `sendMessage` rejects when nothing is listening, which
happens routinely because the worker sleeps. None of this produces an error
anyone will ever see — the user gets a spinner that never stops, writes
*"doesn't work"*, and leaves one star.

This skeleton is the shape that survives that:

| | |
|---|---|
| **Offscreen document** | Heavy work runs where the browser won't kill it. Created via `getContexts` (the only reliable existence check), closed by an alarm after 5 idle minutes so a WASM heap doesn't sit in RAM forever. |
| **`withTimeout` on every hop** | Worker → offscreen, content → worker. A stuck step becomes a visible error instead of an eternal spinner. |
| **Handlers that always answer** | A message handler that throws leaves the caller waiting forever. Every one here replies, including on failure. |
| **`return true`** | The one-line omission that silently breaks every async `onMessage` handler. |
| **Clipboard without the permission** | `navigator.clipboard` in a content script triggers a permission prompt on a page the user was just browsing. `execCommand` needs none. |
| **First-run guide** | Opens on install, not on update. Nobody discovers a keyboard shortcut on their own. |
| **Allowlist packaging** | A denylist fails open — one forgotten `debug.html` ships. This fails closed and prints anything in `src/` it did *not* ship. |

---

## Layout

```
src/
  manifest.json      MV3, wasm-unsafe-eval CSP, keyboard command
  background.js      service worker: injection, offscreen lifecycle, messages
  content.js         injected overlay, guarded against double-injection
  offscreen.js       ← put the real work in doWork()
  options.html/js    first-run guide + settings
  lib/guard.js       withTimeout, send, copyText
tools/
  package.py         build + preflight checks
```

---

## Things that cost a day each

**WASM needs `'wasm-unsafe-eval'`.** Without it in
`content_security_policy.extension_pages`, compilation throws a `CompileError`
— and if the throw happens inside an un-awaited promise, nothing settles and
the UI hangs with no error anywhere. Already set in the manifest here.

**`return true` in `onMessage`.** Omit it and the channel closes before your
async handler replies. The caller waits forever. No warning.

**Store images must be 24-bit RGB with no alpha channel.** `canvas.toBlob(…,
'image/png')` always produces RGBA. The dashboard rejects it with *"image has
incorrect dimensions"*, which sends you off measuring pixels for an hour. The
icon generator in this repo outputs RGB.

**"Are you using remote code?" → No.** WASM and models bundled inside the
package are not remote code. Answering yes routes you into a stricter review.

**A content script may be injected twice.** The user clicks the toolbar button
again. Guard your top-level declarations or the second injection throws and the
feature quietly stops working.

**`chrome://` and the Web Store refuse injection.** Not a bug you can fix — but
tell the user that instead of failing silently, or they will assume you are
broken.

---

## Adding paid features

Gate them in `background.js`, where the privileged work happens — never only in
the options page, which the user owns and can edit in devtools.

For licence keys that verify **offline**, so the extension still needs no
network permission and a "nothing leaves your computer" claim survives:
[**chrome-ext-offline-license**](https://github.com/Kuan-1113/chrome-ext-offline-license)
— MIT, drop-in.

---

## 繁體中文

MV3 會把很多本來能動的東西弄壞,而且**壞得無聲無息**:service worker 閒置 30 秒被殺、
沒有 DOM、沒有 canvas、WASM 也不能用;`sendMessage` 在 worker 睡著時會 reject。
這些都不會出現在任何你看得到的錯誤訊息裡 —— 使用者只看到轉圈圈轉不完,然後留一星。

這個樣板就是能撐過那些狀況的骨架:重活放 offscreen document、每一次跨界呼叫都包 timeout、
每個 handler 都一定回話、剪貼簿不要權限、首次安裝自動開說明、
打包用白名單(黑名單會 fail open,一個忘記刪的測試頁就跟著上架了)。

把 `src/offscreen.js` 的 `doWork()` 換成你的東西就能開始。

## Running in production

The code here is not a demo. It ships in two extensions on the Chrome Web Store:

- [**Screenshot OCR — Chinese & Japanese, offline**](https://chromewebstore.google.com/detail/pgfnobkogofkjapcmaoekajipgpaknnm) — four Tesseract
  language models bundled in the package, recognition in an offscreen document,
  and no network permission at all.
- [**PDF Editor — fill forms in Chinese, offline**](https://chromewebstore.google.com/detail/bmbnonjkhhaamehmkhjihcagalijcdoj) — pdf-lib with an
  embedded, subsetted CJK font.

Both are free with an optional one-time paid tier, which is what the offline
licensing here exists to serve.

## If you searched for one of these

Every item below is a real MV3 failure that produces no useful error:

- `Could not establish connection. Receiving end does not exist.`
- `Extension context invalidated.`
- `Only a single offscreen document may be created.`
- `Refused to compile or instantiate WebAssembly module because 'unsafe-eval'
  is not an allowed source of script`
- manifest v3 service worker keeps going inactive / dies after 30 seconds
- chrome.runtime.sendMessage no response, promise never resolves
- how to use canvas / DOM / WASM in a manifest v3 service worker
- copy to clipboard in an extension without the `clipboardWrite` permission

The first two and the message-passing one are all the same root cause: the
worker is asleep. The fix is not to keep it alive — it is to make every hop
time out and every handler always reply.

---

MIT
