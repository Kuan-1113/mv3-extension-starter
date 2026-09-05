const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', async () => {
  const { autoCopy } = await chrome.storage.local.get('autoCopy');
  $('autoCopy').checked = !!autoCopy;

  $('autoCopy').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ autoCopy: e.target.checked });
    // Confirm the save. A checkbox that silently persists leaves people
    // wondering whether it took, and clicking it again to be sure.
    $('saved').textContent = 'Saved';
    setTimeout(() => { $('saved').textContent = ''; }, 1400);
  });

  // Swap this for a real licence check when you add paid features.
  // Do the check that gates the feature in background.js, not here — this page
  // belongs to the user and anything decided in it can be edited in devtools.
  $('plan').textContent = 'Free';
});
