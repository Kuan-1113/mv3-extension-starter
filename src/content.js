/**
 * Injected on demand into the active tab.
 *
 * Injected scripts run more than once — the user clicks the toolbar button
 * twice, or the same tab gets re-injected. Guard against re-declaring, or the
 * second injection throws and the feature silently stops working.
 */
if (!self.__mv3sLoaded) {
  self.__mv3sLoaded = true;

  let panel = null;

  function closePanel() {
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    panel = null;
  }

  function showPanel(build) {
    closePanel();
    panel = document.createElement('div');
    panel.className = 'mv3s-panel';
    build(panel);
    document.body.appendChild(panel);
  }

  function button(label, onClick) {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  async function run() {
    showPanel((p) => { p.textContent = 'Working…'; });

    const res = await send({ type: 'PROCESS', payload: { text: document.title } });

    showPanel((p) => {
      if (!res.ok) {
        // Show the real reason. "Something went wrong" teaches the user
        // nothing and teaches you nothing, because they won't report it.
        const e = document.createElement('div');
        e.className = 'mv3s-err';
        e.textContent = 'Failed: ' + res.error;
        p.appendChild(e);
        p.appendChild(button('Close', closePanel));
        return;
      }

      const out = document.createElement('div');
      out.textContent = res.result.upper + '  (' + res.result.chars + ' chars)';
      out.style.marginBottom = '10px';
      p.appendChild(out);

      p.appendChild(button('Copy', (ev) => {
        ev.target.textContent = copyText(res.result.upper) ? 'Copied' : 'Copy failed';
      }));
      p.appendChild(button('Settings', () => chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' })));
      p.appendChild(button('Close', closePanel));
    });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'START') run();
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
}
