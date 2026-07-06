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

  function playKey(key, preferChannel = false, velocity = 0.9) {
    const v = resolveVoice(preferChannel);
    if (v.ch) Sequencer.preview(v.ch, key, velocity);
    else Sequencer.previewInstrument(v.instId, key, velocity);
    flashKey(key);
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
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(x + n.len * stepW - 5, y + 1, 4, KEY_H - 3); // resize handle
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.font = '9px sans-serif';
      if (n.len * stepW > 30) c.fillText(keyName(n.key), x + 4, y + 11);
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
      playKey(key);
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
        render();
      }
      return;
    }

    if (hit) {
      State.snapshot();
      drag = hit.nearEnd
        ? { type: 'resize', note: hit.note }
        : { type: 'move', note: hit.note, offsetSteps: (x - KEYS_W) / stepW - hit.note.start };
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
    drag = { type: 'move', note: n, offsetSteps: 0 };
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
    if (drag.type === 'move') {
      const rawStart = (x - KEYS_W) / stepW - drag.offsetSteps;
      const start = Math.round(rawStart / snap) * snap;
      const key = TOP_KEY - Math.floor(y / KEY_H);
      const prevKey = drag.note.key;
      drag.note.start = Math.max(0, Math.min(pattern.length - drag.note.len, start));
      drag.note.key = Math.max(BOTTOM_KEY, Math.min(TOP_KEY, key));
      if (drag.note.key !== prevKey) playKey(drag.note.key, true, 0.5);
    } else {
      const end = Math.max(drag.note.start + 1, Math.round(((x - KEYS_W) / stepW) / snap) * snap);
      drag.note.len = Math.min(end, pattern.length) - drag.note.start;
      if (drag.note.len < 1) drag.note.len = 1;
    }
    render();
  }

  function onUp() { drag = null; }

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
      playKey(12 * octave + KEYMAP[k]);
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

  return { init, render, setChannel, handleKey };
})();
