/* ============================================================
   Trex Studio Producer — Piano Roll UI (canvas)
   Click = add note · drag = move · right-click = delete
   drag right edge = resize · velocity via Alt+wheel
   A–K computer keys play the selected channel live.
   ============================================================ */
'use strict';

const UIPiano = (() => {
  const KEY_H = 16;            // px per semitone row
  const KEYS_W = 64;           // piano keyboard gutter width
  const TOP_KEY = 96;          // C7 at top
  const BOTTOM_KEY = 24;       // C1 at bottom
  const NUM_KEYS = TOP_KEY - BOTTOM_KEY + 1;

  let canvas, ctx2d, scroller;
  let channelId = null;
  let stepW = 34;              // px per 16th step
  let drag = null;             // {type:'move'|'resize', note, offsetSteps}
  let hoverNote = null;
  let keysVoice = 'piano';     // sound for the on-screen keys / typing ('channel' = follow)
  const pressedKeys = new Set();
  const selected = new Set();  // selected note objects
  let clipboard = [];          // copied notes, starts normalized to 0

  // Which sound should a key/note audition use?
  // - keys & typing: the Keys voice (or the channel when set to 'Follow channel')
  // - grid notes: the channel's own sound when it's pitched, else the Keys voice
  function resolveVoice(preferChannel) {
    const ch = channel();
    const inst = ch && Instruments.byId[ch.instrumentId];
    const pitched = (inst && inst.type === 'melodic') || (ch && (ch.instrumentId.startsWith('smp:') || ch.instrumentId.startsWith('usr:')));
    if ((keysVoice === 'channel' || preferChannel) && ch && pitched) return { ch };
    return { instId: keysVoice === 'channel' ? 'piano' : keysVoice };
  }

  function playKey(key, preferChannel = false, velocity = 0.9, capture = false) {
    const v = resolveVoice(preferChannel);
    if (v.ch) Sequencer.preview(v.ch, key, velocity);
    else Sequencer.previewInstrument(v.instId, key, velocity);
    flashKey(key);
    if (capture) captureNote(key);
  }

  // ---- live note recording: armed + playing in pattern mode = performance is written in ----
  function captureNote(key) {
    const t = Engine.transport;
    if (!t.recArm || !t.playing || t.mode !== 'pattern' || t.countIn > 0) return;
    const ch = channel();
    if (!ch) return;
    const pat = State.activePattern();
    let step = Math.round(Engine.currentStepFloat());   // quantize to nearest 16th
    step = ((step % pat.length) + pat.length) % pat.length;
    const list = State.notesFor(pat, ch.id);
    if (!list.some(n => n.start === step && n.key === key)) {
      list.push({ key, start: step, len: Math.max(1, Math.min(drawLen(), pat.length - step)), vel: 0.9 });
      render();
    }
  }

  function flashKey(key) {
    pressedKeys.add(key);
    render();
    setTimeout(() => { pressedKeys.delete(key); render(); }, 180);
  }

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const isBlack = k => [1, 3, 6, 8, 10].includes(k % 12);
  const keyName = k => NOTE_NAMES[k % 12] + (Math.floor(k / 12) - 1);

  function channel() { return State.project.channels.find(c => c.id === channelId); }
  function notes() {
    const ch = channel();
    if (!ch) return [];
    return State.notesFor(State.activePattern(), ch.id);
  }

  function snapVal() { return parseInt(document.getElementById('piano-snap').value, 10); }
  function drawLen() { return parseInt(document.getElementById('piano-notelen').value, 10); }

  function resize() {
    const pattern = State.activePattern();
    canvas.width = KEYS_W + pattern.length * stepW;
    canvas.height = NUM_KEYS * KEY_H;
  }

  function render() {
    if (!canvas) return;
    refreshChannelSelect();
    resize();
    const pattern = State.activePattern();
    const ch = channel();
    const c = ctx2d;
    c.clearRect(0, 0, canvas.width, canvas.height);

    // rows
    for (let i = 0; i < NUM_KEYS; i++) {
      const key = TOP_KEY - i;
      c.fillStyle = isBlack(key) ? '#15151b' : '#1d1d25';
      if (key % 12 === 0) c.fillStyle = '#232330'; // highlight C rows
      c.fillRect(KEYS_W, i * KEY_H, canvas.width, KEY_H - 1);
    }
    // beat/bar lines
    for (let s = 0; s <= pattern.length; s++) {
      const x = KEYS_W + s * stepW;
      c.fillStyle = s % 16 === 0 ? '#4a4a58' : s % 4 === 0 ? '#33333f' : '#26262e';
      c.fillRect(x, 0, s % 4 === 0 ? 2 : 1, canvas.height);
    }
    // notes
    const color = ch ? (Instruments.byId[ch.instrumentId] || Sampler.get(ch.instrumentId) || { color: '#5aa2ff' }).color : '#5aa2ff';
    for (const n of notes()) {
      const x = KEYS_W + n.start * stepW;
      const y = (TOP_KEY - n.key) * KEY_H;
      c.fillStyle = color;
      c.globalAlpha = 0.45 + 0.55 * n.vel;
      c.fillRect(x + 1, y + 1, n.len * stepW - 2, KEY_H - 3);
      c.globalAlpha = 1;
      if (selected.has(n)) {
        c.strokeStyle = '#ffffff';
        c.lineWidth = 1.5;
        c.strokeRect(x + 1, y + 1, n.len * stepW - 2, KEY_H - 3);
        c.lineWidth = 1;
      }
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(x + n.len * stepW - 5, y + 1, 4, KEY_H - 3); // resize handle
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.font = '9px sans-serif';
      if (n.len * stepW > 30) c.fillText(keyName(n.key), x + 4, y + 11);
    }
    // marquee selection rectangle
    if (drag && drag.type === 'marquee') {
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.strokeStyle = 'rgba(255,255,255,0.5)';
      const rx = Math.min(drag.x0, drag.x1), ry = Math.min(drag.y0, drag.y1);
      const rw = Math.abs(drag.x1 - drag.x0), rh = Math.abs(drag.y1 - drag.y0);
      c.fillRect(rx, ry, rw, rh);
      c.strokeRect(rx, ry, rw, rh);
    }
    // piano keys gutter
    for (let i = 0; i < NUM_KEYS; i++) {
      const key = TOP_KEY - i;
      c.fillStyle = pressedKeys.has(key) ? '#ff8c2b' : (isBlack(key) ? '#0c0c10' : '#e8e8ee');
      c.fillRect(0, i * KEY_H, KEYS_W - 2, KEY_H - 1);
      if (key % 12 === 0) {
        c.fillStyle = pressedKeys.has(key) ? '#17171c' : (isBlack(key) ? '#aaa' : '#555');
        c.font = 'bold 9px sans-serif';
        c.fillText(keyName(key), 4, i * KEY_H + 11);
      }
    }
  }

  function hitTest(px, py) {
    const step = (px - KEYS_W) / stepW;
    const key = TOP_KEY - Math.floor(py / KEY_H);
    for (const n of notes()) {
      if (key === n.key && step >= n.start && step <= n.start + n.len) {
        const nearEnd = (n.start + n.len - step) * stepW < 8;
        return { note: n, nearEnd };
      }
    }
    return null;
  }

  function posFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onDown(e) {
    const { x, y } = posFromEvent(e);

    // clicking piano gutter plays the key with the Keys voice (works even with no channels)
    if (x < KEYS_W) {
      const key = TOP_KEY - Math.floor(y / KEY_H);
      playKey(key, false, 0.9, true); // capture when note-recording
      return;
    }

    const ch = channel();
    if (!ch) return;

    const pattern = State.activePattern();
    const hit = hitTest(x, y);

    if (e.button === 2) { // right-click delete
      if (hit) {
        State.snapshot();
        const arr = notes();
        arr.splice(arr.indexOf(hit.note), 1);
        selected.delete(hit.note);
        render();
      }
      return;
    }

    // Ctrl+drag on empty space = marquee select
    if (!hit && (e.ctrlKey || e.metaKey)) {
      drag = { type: 'marquee', x0: x, y0: y, x1: x, y1: y };
      return;
    }

    if (hit) {
      State.snapshot();
      if (!selected.has(hit.note)) {
        if (!e.shiftKey) selected.clear();
        selected.add(hit.note);
      }
      if (hit.nearEnd) {
        drag = { type: 'resize', note: hit.note };
      } else {
        // group move: remember every selected note's original position
        drag = {
          type: 'move', anchor: hit.note,
          offsetSteps: (x - KEYS_W) / stepW - hit.note.start,
          orig: [...selected].map(n => ({ n, start: n.start, key: n.key })),
        };
      }
      render();
      return;
    }

    // add note
    State.snapshot();
    const snap = snapVal();
    const start = Math.floor((x - KEYS_W) / stepW / snap) * snap;
    const key = TOP_KEY - Math.floor(y / KEY_H);
    if (start < 0 || start >= pattern.length || key < BOTTOM_KEY || key > TOP_KEY) return;
    const n = { key, start, len: Math.min(drawLen(), pattern.length - start), vel: 0.9 };
    notes().push(n);
    playKey(key, true); // grid notes audition with the channel's own sound when it's pitched
    selected.clear();
    selected.add(n);
    drag = { type: 'move', anchor: n, offsetSteps: 0, orig: [{ n, start: n.start, key: n.key }] };
    render();
  }

  function onMove(e) {
    const { x, y } = posFromEvent(e);
    if (!drag) {
      const hit = hitTest(x, y);
      canvas.style.cursor = hit ? (hit.nearEnd ? 'ew-resize' : 'move') : (x < KEYS_W ? 'pointer' : 'crosshair');
      hoverNote = hit ? hit.note : null;
      return;
    }
    const pattern = State.activePattern();
    const snap = snapVal();
    if (drag.type === 'marquee') {
      drag.x1 = x; drag.y1 = y;
      render();
      return;
    }
    if (drag.type === 'move') {
      const anchorOrig = drag.orig.find(o => o.n === drag.anchor);
      const rawStart = (x - KEYS_W) / stepW - drag.offsetSteps;
      const start = Math.round(rawStart / snap) * snap;
      const key = TOP_KEY - Math.floor(y / KEY_H);
      const dStart = Math.max(0, Math.min(pattern.length - drag.anchor.len, start)) - anchorOrig.start;
      const dKey = Math.max(BOTTOM_KEY, Math.min(TOP_KEY, key)) - anchorOrig.key;
      const prevKey = drag.anchor.key;
      // move the whole selection together
      for (const o of drag.orig) {
        o.n.start = Math.max(0, Math.min(pattern.length - o.n.len, o.start + dStart));
        o.n.key = Math.max(BOTTOM_KEY, Math.min(TOP_KEY, o.key + dKey));
      }
      if (drag.anchor.key !== prevKey) playKey(drag.anchor.key, true, 0.5);
    } else {
      const end = Math.max(drag.note.start + 1, Math.round(((x - KEYS_W) / stepW) / snap) * snap);
      drag.note.len = Math.min(end, pattern.length) - drag.note.start;
      if (drag.note.len < 1) drag.note.len = 1;
    }
    render();
  }

  function onUp() {
    if (drag && drag.type === 'marquee') {
      // select every note intersecting the rectangle
      const rx1 = Math.min(drag.x0, drag.x1), rx2 = Math.max(drag.x0, drag.x1);
      const ry1 = Math.min(drag.y0, drag.y1), ry2 = Math.max(drag.y0, drag.y1);
      selected.clear();
      for (const n of notes()) {
        const nx1 = KEYS_W + n.start * stepW, nx2 = nx1 + n.len * stepW;
        const ny1 = (TOP_KEY - n.key) * KEY_H, ny2 = ny1 + KEY_H;
        if (nx2 >= rx1 && nx1 <= rx2 && ny2 >= ry1 && ny1 <= ry2) selected.add(n);
      }
      drag = null;
      render();
      if (selected.size) App.toast(selected.size + ' notes selected — drag to move, Ctrl+C/B, Shift+↑↓ transpose, Del removes');
      return;
    }
    drag = null;
  }

  // ---- selection commands (routed from App when the Piano Roll is open) ----
  function handleShortcut(e) {
    const k = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    const list = notes();
    const targets = selected.size ? [...selected] : list;

    if (ctrl && k.toLowerCase() === 'a') {
      e.preventDefault();
      selected.clear();
      list.forEach(n => selected.add(n));
      render();
      return true;
    }
    if (ctrl && k.toLowerCase() === 'c') {
      if (!selected.size) return false;
      const minStart = Math.min(...[...selected].map(n => n.start));
      clipboard = [...selected].map(n => ({ key: n.key, start: n.start - minStart, len: n.len, vel: n.vel }));
      App.toast('Copied ' + clipboard.length + ' notes');
      return true;
    }
    if (ctrl && k.toLowerCase() === 'v') {
      if (!clipboard.length) return false;
      State.snapshot();
      const pat = State.activePattern();
      const base = selected.size ? Math.min(...[...selected].map(n => n.start)) : 0;
      selected.clear();
      clipboard.forEach(cn => {
        if (base + cn.start < pat.length) {
          const n = { key: cn.key, start: base + cn.start, len: cn.len, vel: cn.vel };
          list.push(n);
          selected.add(n);
        }
      });
      render();
      App.toast('Pasted — drag the selection into place');
      return true;
    }
    if (ctrl && k.toLowerCase() === 'b') {   // duplicate right, FL-style
      e.preventDefault();
      if (!targets.length) return false;
      State.snapshot();
      const pat = State.activePattern();
      const minStart = Math.min(...targets.map(n => n.start));
      const span = Math.max(...targets.map(n => n.start + n.len)) - minStart;
      selected.clear();
      targets.forEach(n => {
        if (n.start + span < pat.length) {
          const copy = { key: n.key, start: n.start + span, len: n.len, vel: n.vel };
          list.push(copy);
          selected.add(copy);
        }
      });
      render();
      return true;
    }
    if ((k === 'Delete' || k === 'Backspace') && selected.size) {
      State.snapshot();
      const pat = State.activePattern();
      const ch = channel();
      pat.notes[ch.id] = list.filter(n => !selected.has(n));
      selected.clear();
      render();
      return true;
    }
    if ((k === 'ArrowUp' || k === 'ArrowDown') && (e.shiftKey || ctrl) && targets.length) {
      e.preventDefault();
      State.snapshot();
      const d = (k === 'ArrowUp' ? 1 : -1) * (ctrl ? 12 : 1);
      targets.forEach(n => { n.key = Math.max(BOTTOM_KEY, Math.min(TOP_KEY, n.key + d)); });
      if (targets[0]) playKey(targets[0].key, true, 0.5);
      render();
      return true;
    }
    return false;
  }

  function clearSelection() { selected.clear(); render(); }

  function onWheel(e) {
    if (e.altKey && hoverNote) {
      e.preventDefault();
      hoverNote.vel = Math.max(0.1, Math.min(1, hoverNote.vel + (e.deltaY < 0 ? 0.05 : -0.05)));
      render();
    } else if (e.ctrlKey) {
      e.preventDefault();
      stepW = Math.max(14, Math.min(80, stepW + (e.deltaY < 0 ? 4 : -4)));
      render();
    }
  }

  function refreshChannelSelect() {
    const sel = document.getElementById('piano-channel');
    const prev = channelId;
    sel.innerHTML = '';
    for (const ch of State.project.channels) {
      const o = document.createElement('option');
      o.value = ch.id; o.textContent = ch.name;
      sel.appendChild(o);
    }
    if (prev && State.project.channels.some(c => c.id === prev)) {
      sel.value = prev;
    } else {
      // default to the first melodic channel so notes always make a tone
      const melodic = State.project.channels.find(c => {
        const inst = Instruments.byId[c.instrumentId];
        return inst && inst.type === 'melodic';
      });
      if (melodic) sel.value = melodic.id;
    }
    channelId = sel.value || null;
  }

  // ---- computer keyboard piano (A-K white keys, W E T Y U black, Z/X octave) ----
  let octave = 5; // C5 = key 60... midi octave base
  const KEYMAP = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15 };
  function handleKey(e) {
    if (e.repeat) return false;
    const k = e.key.toLowerCase();
    if (k === 'z') { octave = Math.max(2, octave - 1); App.toast('Octave: C' + octave); return true; }
    if (k === 'x') { octave = Math.min(7, octave + 1); App.toast('Octave: C' + octave); return true; }
    if (KEYMAP[k] !== undefined) {
      playKey(12 * octave + KEYMAP[k], false, 0.9, true); // capture when note-recording
      return true;
    }
    return false;
  }

  function setChannel(id) {
    channelId = id;
    const sel = document.getElementById('piano-channel');
    if (sel) sel.value = id;
    render();
  }

  function init() {
    canvas = document.getElementById('piano-canvas');
    scroller = document.getElementById('piano-scroll');
    ctx2d = canvas.getContext('2d');
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    document.getElementById('piano-channel').onchange = (e) => { channelId = e.target.value; render(); };
    // Keys sound selector: Grand Piano default, all melodic instruments, or follow-channel
    const ks = document.getElementById('piano-keys');
    const kOpt = (val, label) => {
      const o = document.createElement('option');
      o.value = val; o.textContent = label;
      ks.appendChild(o);
    };
    Instruments.list.filter(i => i.type === 'melodic').forEach(i => kOpt(i.id, i.name));
    kOpt('channel', '↳ Follow channel');
    ks.value = 'piano';
    ks.onchange = (e) => {
      keysVoice = e.target.value;
      if (keysVoice !== 'channel') Sequencer.previewInstrument(keysVoice, 60);
    };
    document.getElementById('piano-clear').onclick = () => {
      const ch = channel();
      if (!ch) return;
      if (!confirm('Clear all notes for ' + ch.name + ' in this pattern?')) return;
      State.snapshot();
      State.activePattern().notes[ch.id] = [];
      render();
    };
    render();
    // scroll to middle C region
    setTimeout(() => { scroller.scrollTop = (TOP_KEY - 72) * KEY_H; }, 50);
  }

  return { init, render, setChannel, handleKey, handleShortcut, clearSelection };
})();
