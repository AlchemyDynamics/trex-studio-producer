/* ============================================================
   Trex Studio Producer — Hints & Help
   Every control carries data-hint="Title|Explanation".
   - Hint bar (bottom): always-on one-liner for whatever you hover
   - Help mode (❓ toggle): rich floating tooltip with full text
   - Dragging a control streams its live value into the hint bar
   ============================================================ */
'use strict';

const Hints = (() => {
  let helpMode = false;
  let valueTimer = null;

  const bar = () => document.getElementById('hint-text');
  const tip = () => document.getElementById('help-tip');

  function parse(el) {
    const raw = el.closest('[data-hint]');
    if (!raw) return null;
    const [title, ...rest] = raw.dataset.hint.split('|');
    return { title: title.trim(), body: rest.join('|').trim(), el: raw };
  }

  function onOver(e) {
    const h = parse(e.target);
    if (!h) return;
    bar().textContent = h.body ? `${h.title} — ${h.body}` : h.title;
    if (helpMode && h.body) {
      const t = tip();
      document.getElementById('tip-title').textContent = h.title;
      document.getElementById('tip-body').textContent = h.body;
      t.style.display = 'block';
      positionTip(e);
    }
  }

  function positionTip(e) {
    const t = tip();
    const pad = 14;
    let x = e.clientX + pad, y = e.clientY + pad;
    const r = t.getBoundingClientRect();
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad;
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad;
    t.style.left = x + 'px';
    t.style.top = y + 'px';
  }

  function onMove(e) {
    if (helpMode && tip().style.display === 'block') positionTip(e);
  }

  function onOut(e) {
    if (!e.relatedTarget || !parse(e.relatedTarget)) {
      tip().style.display = 'none';
    }
  }

  // Live value readout while dragging knobs/faders (FL-style).
  function showValue(text) {
    bar().textContent = text;
    document.getElementById('hintbar').classList.add('help-on');
    clearTimeout(valueTimer);
    valueTimer = setTimeout(() => document.getElementById('hintbar').classList.remove('help-on'), 700);
  }

  function toggleHelp() {
    helpMode = !helpMode;
    document.body.classList.toggle('help-mode', helpMode);
    document.getElementById('btn-help').classList.toggle('active', helpMode);
    if (!helpMode) tip().style.display = 'none';
    App.toast(helpMode
      ? 'Help mode ON — hover anything for a full explanation'
      : 'Help mode off — the bottom bar still shows quick hints');
  }

  function init() {
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseout', onOut);
    document.getElementById('btn-help').onclick = toggleHelp;
  }

  return { init, toggleHelp, showValue, get helpMode() { return helpMode; } };
})();
