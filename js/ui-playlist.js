/* ============================================================
   Trex Studio Producer — Playlist UI (canvas)
   Arrange pattern clips + audio clips on a bar timeline.
   Click empty cell = place selected pattern · click clip = remove
   Click/drag the ruler = scrub (fine scrubbing while dragging).
   ============================================================ */
'use strict';

const UIPlaylist = (() => {
  const RULER_H = 26;
  const TRACK_H = 44;
  const HEAD_W = 90;
  let BAR_W = 90;

  let canvas, ctx2d, scroller;
  let scrubbing = false;

  function bars() { return Math.max(32, Math.ceil(State.songLengthSteps() / 16) + 8); }
  function tracks() { return State.project.playlistTracks; }

  function resize() {
    canvas.width = HEAD_W + bars() * BAR_W;
    canvas.height = RULER_H + tracks() * TRACK_H;
  }

  function patternColor(patternId) {
    const i = State.project.patterns.findIndex(p => p.id === patternId);
    const palette = ['#ff8c2b', '#35d0a0', '#5aa2ff', '#e84a8a', '#e8e84a', '#b08ae8', '#4ae8c8', '#e8734a'];
    return palette[(i < 0 ? 0 : i) % palette.length];
  }

  function render() {
    if (!canvas) return;
    resize();
    const c = ctx2d;
    c.clearRect(0, 0, canvas.width, canvas.height);

    // track lanes
    for (let t = 0; t < tracks(); t++) {
      const y = RULER_H + t * TRACK_H;
      c.fillStyle = t % 2 === 0 ? '#1b1b22' : '#191920';
      c.fillRect(HEAD_W, y, canvas.width, TRACK_H - 1);
      // header
      c.fillStyle = '#232329';
      c.fillRect(0, y, HEAD_W - 2, TRACK_H - 1);
      c.fillStyle = '#8a8a96';
      c.font = '10px sans-serif';
      c.fillText('Track ' + (t + 1), 8, y + 25);
    }
    // bar lines
    for (let b = 0; b <= bars(); b++) {
      const x = HEAD_W + b * BAR_W;
      c.fillStyle = b % 4 === 0 ? '#3d3d49' : '#262630';
      c.fillRect(x, RULER_H, 1, canvas.height);
      // quarter subdivisions
      if (BAR_W > 60) for (let q = 1; q < 4; q++) {
        c.fillStyle = '#20202a';
        c.fillRect(x + q * BAR_W / 4, RULER_H, 1, canvas.height);
      }
    }
    // ruler
    c.fillStyle = '#101014';
    c.fillRect(0, 0, canvas.width, RULER_H);
    for (let b = 0; b < bars(); b++) {
      const x = HEAD_W + b * BAR_W;
      c.fillStyle = b % 4 === 0 ? '#d8d8e0' : '#61616e';
      c.font = '10px monospace';
      c.fillText(String(b + 1), x + 4, 17);
    }

    // pattern clips
    for (const clip of State.project.playlist) {
      const x = HEAD_W + clip.start * BAR_W;
      const y = RULER_H + clip.track * TRACK_H;
      const w = clip.length * BAR_W;
      const col = patternColor(clip.patternId);
      c.fillStyle = col + '33';
      c.fillRect(x + 1, y + 2, w - 2, TRACK_H - 6);
      c.strokeStyle = col;
      c.strokeRect(x + 1.5, y + 2.5, w - 3, TRACK_H - 7);
      c.fillStyle = col;
      c.fillRect(x + 1, y + 2, w - 2, 11);
      const pat = State.project.patterns.find(p => p.id === clip.patternId);
      c.fillStyle = '#101014';
      c.font = 'bold 9px sans-serif';
      c.fillText((pat ? pat.name : '?'), x + 5, y + 11, w - 8);
      // mini step preview
      if (pat) drawMiniPattern(c, pat, x + 3, y + 16, w - 6, TRACK_H - 22);
    }

    // audio clips
    for (const clip of State.project.audioClips) {
      const x = HEAD_W + clip.start * BAR_W;
      const y = RULER_H + clip.track * TRACK_H;
      const w = Math.max(BAR_W / 4, (clip.lengthSteps / 16) * BAR_W);
      c.fillStyle = 'rgba(255,77,94,0.2)';
      c.fillRect(x + 1, y + 2, w - 2, TRACK_H - 6);
      c.strokeStyle = '#ff4d5e';
      c.strokeRect(x + 1.5, y + 2.5, w - 3, TRACK_H - 7);
      c.fillStyle = '#ff4d5e';
      c.font = 'bold 9px sans-serif';
      c.fillText('🎙 ' + clip.name, x + 5, y + 12, w - 8);
      drawWaveClip(c, clip, x + 3, y + 16, w - 6, TRACK_H - 22);
    }
  }

  function drawMiniPattern(c, pat, x, y, w, h) {
    const chs = State.project.channels;
    const rows = Math.min(chs.length, 4);
    for (let r = 0; r < rows; r++) {
      const steps = pat.steps[chs[r].id];
      if (!steps) continue;
      for (let s = 0; s < pat.length; s++) {
        if (steps[s] && steps[s].on) {
          c.fillStyle = 'rgba(255,255,255,0.5)';
          c.fillRect(x + (s / pat.length) * w, y + r * (h / rows), Math.max(1.5, w / pat.length - 1), h / rows - 1);
        }
      }
    }
  }

  function drawWaveClip(c, clip, x, y, w, h) {
    const buf = State.samples[clip.sampleId];
    if (!buf) return;
    const data = buf.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / w));
    c.fillStyle = 'rgba(255,77,94,0.7)';
    for (let px = 0; px < w; px++) {
      let peak = 0;
      const base = px * step;
      for (let i = 0; i < step; i += 16) {
        const v = Math.abs(data[base + i] || 0);
        if (v > peak) peak = v;
      }
      const hh = Math.max(1, peak * h);
      c.fillRect(x + px, y + (h - hh) / 2, 1, hh);
    }
  }

  // playhead drawn on a rAF overlay: repaint is cheap enough to just re-render
  function paintPlayhead() {
    if (!canvas || Engine.transport.mode !== 'song') return;
    render();
    const tick = Engine.transport.playing || Engine.transport.pausedStep === null
      ? Engine.transport.songTick : Engine.transport.pausedStep;
    const x = HEAD_W + (tick / 16) * BAR_W;
    ctx2d.fillStyle = '#ffffff';
    ctx2d.fillRect(x, 0, 2, canvas.height);
    ctx2d.fillStyle = 'rgba(255,255,255,0.25)';
    ctx2d.beginPath();
    ctx2d.moveTo(x - 5, 0); ctx2d.lineTo(x + 7, 0); ctx2d.lineTo(x + 1, 10);
    ctx2d.fill();
  }

  function posFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function scrubTo(x, fine) {
    const bar = (x - HEAD_W) / BAR_W;
    if (bar < 0) return;
    // fine scrubbing: 16th-step resolution while dragging; bar snap on click
    const stepTick = fine ? Math.round(bar * 16) : Math.round(bar * 4) * 4;
    Engine.setMode('song');
    App.syncModeButtons();
    Engine.seek(Math.max(0, stepTick));
    paintPlayhead();
    App.updatePosition();
  }

  function onDown(e) {
    const { x, y } = posFromEvent(e);
    if (y < RULER_H) { scrubbing = true; scrubTo(x, false); return; }
    if (x < HEAD_W) return;

    const track = Math.floor((y - RULER_H) / TRACK_H);
    const bar = Math.floor((x - HEAD_W) / BAR_W);

    // clicked an existing clip? remove it (right or left click)
    const pi = State.project.playlist.findIndex(cl =>
      cl.track === track && bar >= cl.start && bar < cl.start + cl.length);
    if (pi >= 0) { State.snapshot(); State.project.playlist.splice(pi, 1); render(); return; }
    const ai = State.project.audioClips.findIndex(cl =>
      cl.track === track && bar >= cl.start && bar < cl.start + Math.max(1, cl.lengthSteps / 16));
    if (ai >= 0) {
      if (e.button === 2 || confirm('Remove this audio clip from the playlist?')) {
        State.snapshot(); State.project.audioClips.splice(ai, 1); render();
      }
      return;
    }
    if (e.button === 2) return;

    // place selected pattern
    const patId = document.getElementById('playlist-pattern').value;
    const pat = State.project.patterns.find(p => p.id === patId);
    if (!pat) return;
    State.snapshot();
    State.project.playlist.push({
      id: 'clip' + Math.random().toString(36).slice(2, 9),
      type: 'pattern', patternId: pat.id, track, start: bar,
      length: Math.max(1, Math.round(pat.length / 16)),
    });
    render();
  }

  function onMove(e) {
    if (!scrubbing) return;
    scrubTo(posFromEvent(e).x, true);
  }
  function onUp() { scrubbing = false; }

  function onWheel(e) {
    if (e.ctrlKey) {
      e.preventDefault();
      BAR_W = Math.max(30, Math.min(240, BAR_W + (e.deltaY < 0 ? 10 : -10)));
      render();
    }
  }

  function init() {
    canvas = document.getElementById('playlist-canvas');
    scroller = document.getElementById('playlist-scroll');
    ctx2d = canvas.getContext('2d');
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.dataset.hint = 'Playlist|Paint patterns into a song. Click empty space to place the selected pattern, click a clip to remove it, click/drag the top ruler to scrub the playhead.';
    document.getElementById('playlist-clear').onclick = () => {
      if (!confirm('Clear the whole arrangement?')) return;
      State.snapshot();
      State.project.playlist = [];
      State.project.audioClips = [];
      render();
    };
    render();
  }

  return { init, render, paintPlayhead };
})();
