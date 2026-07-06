/* ============================================================
   Trex Studio Producer — Playlist UI (canvas)
   Arrange pattern + audio clips on a bar timeline.
   · left-drag a clip = move    · drag its right edge = resize
   · Shift+drag = clone         · right-click clip = delete
   · click empty = paint the selected pattern
   · ruler: click = jump · drag = loop region · right-click = clear loop
   · automation lanes below the tracks: click = add/drag point,
     right-click point = delete, ✕ on the header = remove lane
   ============================================================ */
'use strict';

const UIPlaylist = (() => {
  const RULER_H = 26;
  const TRACK_H = 44;
  const LANE_H = 56;
  const HEAD_W = 90;
  const EDGE_PX = 8;          // resize handle width
  let BAR_W = 90;

  let canvas, ctx2d, scroller;
  let action = null;          // {type:'scrub'|'loop'|'move'|'resize'|'point', ...}

  function bars() { return Math.max(32, Math.ceil(State.songLengthSteps() / 16) + 8); }
  function tracks() { return State.project.playlistTracks; }
  function lanes() { return State.project.automation; }
  function lanesTop() { return RULER_H + tracks() * TRACK_H; }

  function resize() {
    canvas.width = HEAD_W + bars() * BAR_W;
    canvas.height = lanesTop() + lanes().length * LANE_H;
  }

  function patternColor(patternId) {
    const i = State.project.patterns.findIndex(p => p.id === patternId);
    const palette = ['#ff8c2b', '#35d0a0', '#5aa2ff', '#e84a8a', '#e8e84a', '#b08ae8', '#4ae8c8', '#e8734a'];
    return palette[(i < 0 ? 0 : i) % palette.length];
  }

  // ---------- rendering ----------
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
      c.fillStyle = '#232329';
      c.fillRect(0, y, HEAD_W - 2, TRACK_H - 1);
      c.fillStyle = '#8a8a96';
      c.font = '10px sans-serif';
      c.fillText('Track ' + (t + 1), 8, y + 25);
    }
    // bar lines (tracks + lanes)
    for (let b = 0; b <= bars(); b++) {
      const x = HEAD_W + b * BAR_W;
      c.fillStyle = b % 4 === 0 ? '#3d3d49' : '#262630';
      c.fillRect(x, RULER_H, 1, canvas.height - RULER_H);
      if (BAR_W > 60) for (let q = 1; q < 4; q++) {
        c.fillStyle = '#20202a';
        c.fillRect(x + q * BAR_W / 4, RULER_H, 1, canvas.height - RULER_H);
      }
    }

    // ruler
    c.fillStyle = '#101014';
    c.fillRect(0, 0, canvas.width, RULER_H);
    // loop region
    const loop = State.project.loop;
    if (loop && loop.end > loop.start) {
      const x1 = HEAD_W + (loop.start / 16) * BAR_W;
      const x2 = HEAD_W + (loop.end / 16) * BAR_W;
      c.fillStyle = 'rgba(53,208,160,0.28)';
      c.fillRect(x1, 0, x2 - x1, RULER_H);
      c.fillStyle = '#35d0a0';
      c.fillRect(x1, 0, 2, RULER_H);
      c.fillRect(x2 - 2, 0, 2, RULER_H);
    }
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
      // resize grip
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(x + w - 4, y + 2, 3, TRACK_H - 6);
      const pat = State.project.patterns.find(p => p.id === clip.patternId);
      c.fillStyle = '#101014';
      c.font = 'bold 9px sans-serif';
      c.fillText((pat ? pat.name : '?'), x + 5, y + 11, w - 8);
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
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(x + w - 4, y + 2, 3, TRACK_H - 6);
      c.fillStyle = '#ff4d5e';
      c.font = 'bold 9px sans-serif';
      c.fillText('🎙 ' + clip.name, x + 5, y + 12, w - 8);
      drawWaveClip(c, clip, x + 3, y + 16, w - 6, TRACK_H - 22);
    }

    // automation lanes
    lanes().forEach((lane, li) => {
      const y = lanesTop() + li * LANE_H;
      c.fillStyle = li % 2 === 0 ? '#161620' : '#14141d';
      c.fillRect(HEAD_W, y, canvas.width, LANE_H - 1);
      // header
      c.fillStyle = '#26202e';
      c.fillRect(0, y, HEAD_W - 2, LANE_H - 1);
      c.fillStyle = '#b08ae8';
      c.font = '9px sans-serif';
      wrapText(c, lane.name, 6, y + 14, HEAD_W - 22, 11);
      c.fillStyle = '#8a8a96';
      c.font = 'bold 11px sans-serif';
      c.fillText('✕', HEAD_W - 16, y + 14);

      // curve
      const vy = (v) => y + 6 + (1 - v) * (LANE_H - 14);
      c.strokeStyle = '#b08ae8';
      c.lineWidth = 1.5;
      c.beginPath();
      const pts = lane.points;
      if (pts.length) {
        c.moveTo(HEAD_W, vy(pts[0].value));
        pts.forEach(p => c.lineTo(HEAD_W + (p.tick / 16) * BAR_W, vy(p.value)));
        c.lineTo(canvas.width, vy(pts[pts.length - 1].value));
      }
      c.stroke();
      c.lineWidth = 1;
      pts.forEach(p => {
        c.fillStyle = '#b08ae8';
        c.beginPath();
        c.arc(HEAD_W + (p.tick / 16) * BAR_W, vy(p.value), 3.5, 0, 7);
        c.fill();
      });
    });
  }

  function wrapText(c, text, x, y, maxW, lineH) {
    const words = String(text).split(' ');
    let line = '';
    for (const w of words) {
      if (c.measureText(line + w).width > maxW && line) {
        c.fillText(line, x, y);
        line = w + ' ';
        y += lineH;
        if (y > 0 && lineH > 0 && line.length > 60) break;
      } else line += w + ' ';
    }
    c.fillText(line.trim(), x, y);
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

  // ---------- hit testing ----------
  function posFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function clipAt(x, y) {
    const track = Math.floor((y - RULER_H) / TRACK_H);
    for (const clip of State.project.playlist) {
      if (clip.track !== track) continue;
      const cx = HEAD_W + clip.start * BAR_W;
      const cw = clip.length * BAR_W;
      if (x >= cx && x <= cx + cw) {
        return { clip, kind: 'pattern', nearEnd: (cx + cw - x) <= EDGE_PX };
      }
    }
    for (const clip of State.project.audioClips) {
      if (clip.track !== track) continue;
      const cx = HEAD_W + clip.start * BAR_W;
      const cw = Math.max(BAR_W / 4, (clip.lengthSteps / 16) * BAR_W);
      if (x >= cx && x <= cx + cw) {
        return { clip, kind: 'audio', nearEnd: (cx + cw - x) <= EDGE_PX };
      }
    }
    return null;
  }

  function laneAt(y) {
    const idx = Math.floor((y - lanesTop()) / LANE_H);
    return (idx >= 0 && idx < lanes().length) ? { lane: lanes()[idx], index: idx, top: lanesTop() + idx * LANE_H } : null;
  }

  function laneTickAt(x, fine) {
    const tick = ((x - HEAD_W) / BAR_W) * 16;
    const snap = fine ? 1 : 4; // quarter notes normally, 16ths with Shift
    return Math.max(0, Math.round(tick / snap) * snap);
  }
  function laneValueAt(laneTop, y) {
    const v = 1 - (y - laneTop - 6) / (LANE_H - 14);
    return Math.max(0, Math.min(1, v));
  }

  // ---------- interactions ----------
  function onDown(e) {
    const { x, y } = posFromEvent(e);

    // === ruler: click = jump, drag = loop region, right-click = clear loop ===
    if (y < RULER_H) {
      if (e.button === 2) {
        State.project.loop = { start: 0, end: 0 };
        Engine.clearLoop();
        render();
        App.toast('Loop off');
        return;
      }
      action = { type: 'rulerDown', startX: x, moved: false };
      return;
    }

    // === automation lanes ===
    const la = laneAt(y);
    if (la && x >= HEAD_W) {
      const tick = laneTickAt(x, e.shiftKey);
      if (e.button === 2) {
        State.snapshot();
        Automation.deletePoint(la.lane, tick, 3);
        render();
        return;
      }
      State.snapshot();
      Automation.setPoint(la.lane, tick, laneValueAt(la.top, y));
      action = { type: 'point', lane: la.lane, top: la.top, fine: e.shiftKey, lastTick: tick };
      render();
      return;
    }
    if (la && x < HEAD_W) {
      // lane header: ✕ removes
      if (x > HEAD_W - 24 && y < la.top + 20) {
        if (confirm('Remove automation lane "' + la.lane.name + '"?')) {
          Automation.removeLane(la.lane.id);
          render();
        }
      }
      return;
    }

    if (x < HEAD_W || y >= lanesTop()) return;

    // === clips ===
    const hit = clipAt(x, y);
    if (hit) {
      if (e.button === 2) { // right-click = delete
        State.snapshot();
        if (hit.kind === 'pattern') State.project.playlist = State.project.playlist.filter(c => c !== hit.clip);
        else State.project.audioClips = State.project.audioClips.filter(c => c !== hit.clip);
        render();
        return;
      }
      State.snapshot();
      let clip = hit.clip;
      if (e.shiftKey && !hit.nearEnd) { // shift-drag = clone
        clip = JSON.parse(JSON.stringify(hit.clip));
        clip.id = 'clip' + Math.random().toString(36).slice(2, 9);
        if (hit.kind === 'pattern') State.project.playlist.push(clip);
        else State.project.audioClips.push(clip);
      }
      if (hit.nearEnd) {
        action = { type: 'resize', clip, kind: hit.kind };
      } else {
        action = {
          type: 'move', clip, kind: hit.kind,
          grabOffset: (x - HEAD_W) / BAR_W - clip.start,
        };
      }
      return;
    }

    // === empty cell: paint selected pattern ===
    if (e.button === 2) return;
    const track = Math.floor((y - RULER_H) / TRACK_H);
    const bar = Math.floor((x - HEAD_W) / BAR_W);
    const patId = document.getElementById('playlist-pattern').value;
    const pat = State.project.patterns.find(p => p.id === patId);
    if (!pat || track < 0 || track >= tracks()) return;
    State.snapshot();
    const clip = {
      id: 'clip' + Math.random().toString(36).slice(2, 9),
      type: 'pattern', patternId: pat.id, track, start: bar,
      length: Math.max(1, Math.round(pat.length / 16)),
    };
    State.project.playlist.push(clip);
    action = { type: 'move', clip, kind: 'pattern', grabOffset: (x - HEAD_W) / BAR_W - clip.start };
    render();
  }

  function onMove(e) {
    const { x, y } = posFromEvent(e);
    if (!action) {
      // cursor feedback
      if (y < RULER_H) canvas.style.cursor = 'pointer';
      else if (laneAt(y)) canvas.style.cursor = 'crosshair';
      else {
        const hit = x >= HEAD_W ? clipAt(x, y) : null;
        canvas.style.cursor = hit ? (hit.nearEnd ? 'ew-resize' : 'grab') : 'pointer';
      }
      return;
    }

    switch (action.type) {
      case 'rulerDown': {
        if (Math.abs(x - action.startX) > 5) {
          action = { type: 'loop', startX: action.startX };
        }
        break;
      }
      case 'loop': {
        const b1 = Math.max(0, Math.round((Math.min(action.startX, x) - HEAD_W) / BAR_W));
        const b2 = Math.max(b1 + 1, Math.round((Math.max(action.startX, x) - HEAD_W) / BAR_W));
        State.project.loop = { start: b1 * 16, end: b2 * 16 };
        Engine.setLoop(b1 * 16, b2 * 16);
        render();
        Hints.showValue('Loop: bar ' + (b1 + 1) + ' – ' + (b2 + 1));
        break;
      }
      case 'move': {
        const clip = action.clip;
        clip.start = Math.max(0, Math.round((x - HEAD_W) / BAR_W - action.grabOffset));
        clip.track = Math.max(0, Math.min(tracks() - 1, Math.floor((y - RULER_H) / TRACK_H)));
        render();
        break;
      }
      case 'resize': {
        const clip = action.clip;
        if (action.kind === 'pattern') {
          clip.length = Math.max(1, Math.round((x - HEAD_W) / BAR_W - clip.start));
        } else {
          // audio clips trim in quarter-bar (4-step) increments
          const steps = ((x - HEAD_W) / BAR_W - clip.start) * 16;
          clip.lengthSteps = Math.max(4, Math.round(steps / 4) * 4);
        }
        render();
        break;
      }
      case 'point': {
        const la = { top: action.top };
        const tick = laneTickAt(x, action.fine || e.shiftKey);
        // dragging sculpts: move the point we grabbed (remove old tick if it moved)
        if (tick !== action.lastTick) {
          action.lane.points = action.lane.points.filter(p => p.tick !== action.lastTick || action.lane.points.length <= 1);
          action.lastTick = tick;
        }
        Automation.setPoint(action.lane, tick, laneValueAt(la.top, y));
        render();
        break;
      }
    }
  }

  function onUp(e) {
    if (action && action.type === 'rulerDown') { // never became a loop-drag → it's a click = seek
      // simple click = seek (16th resolution)
      const { x } = posFromEvent(e);
      const stepTick = Math.max(0, Math.round(((x - HEAD_W) / BAR_W) * 16));
      Engine.setMode('song');
      App.syncModeButtons();
      Engine.seek(stepTick);
      paintPlayhead();
      App.updatePosition();
    }
    action = null;
  }

  function onWheel(e) {
    if (e.ctrlKey) {
      e.preventDefault();
      BAR_W = Math.max(30, Math.min(240, BAR_W + (e.deltaY < 0 ? 10 : -10)));
      render();
    }
  }

  // ---------- automation lane creation (＋ Auto button) ----------
  function pickAutomationTarget() {
    const options = [{ label: 'Master volume', target: { kind: 'masterVol' } }];
    State.project.mixer.forEach((t, i) => {
      if (i === 0) return;
      options.push({ label: t.name + ' volume', target: { kind: 'mixerVol', track: i } });
      options.push({ label: t.name + ' pan', target: { kind: 'mixerPan', track: i } });
      t.fx.forEach((fx, slot) => {
        const def = Effects.byId[fx.defId];
        if (!def) return;
        def.params.filter(p => !p.options).forEach(p => {
          options.push({ label: `${t.name} · ${def.name} · ${p.name}`, target: { kind: 'fxParam', track: i, slot, param: p.id } });
        });
      });
    });
    const listing = options.map((o, i) => `${i + 1}. ${o.label}`).join('\n');
    const pick = prompt('Automate which control?\n(Tip: you can also right-click any mixer knob or fader)\n\n' + listing + '\n\nEnter a number:');
    const idx = parseInt(pick, 10) - 1;
    if (idx >= 0 && idx < options.length) {
      Automation.createLane(options[idx].target);
      render();
      App.toast('Automation lane added — click in the lane to draw the curve');
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
    canvas.dataset.hint = 'Playlist|Drag clips to move them, drag their right edge to resize, Shift+drag to clone, right-click to delete. Click empty space to paint the selected pattern. Drag on the ruler to set a loop region.';
    document.getElementById('playlist-clear').onclick = () => {
      if (!confirm('Clear the whole arrangement? (Patterns and automation lanes are kept.)')) return;
      State.snapshot();
      State.project.playlist = [];
      State.project.audioClips = [];
      render();
    };
    document.getElementById('playlist-auto').onclick = pickAutomationTarget;
    render();
  }

  return { init, render, paintPlayhead };
})();
