/* ============================================================
   Trex Studio Producer — App glue
   Splash boot, view switching, transport UI, browser panel,
   keyboard shortcuts, knob widget, rAF loop, save/load.
   ============================================================ */
'use strict';

const App = (() => {

  // ---------- shared knob widget (vertical drag, FL-style) ----------
  function makeKnob({ value, min = 0, max = 1, onChange, hint, format, small }) {
    const el = document.createElement('div');
    el.className = 'knob' + (small ? ' small' : '');
    if (hint) el.dataset.hint = hint;
    let v = value;
    const paint = () => el.style.setProperty('--knob-deg', (30 + v * 300) + 'deg');
    paint();
    let dragging = false, startY = 0, startV = 0;
    el.addEventListener('mousedown', (e) => {
      dragging = true; startY = e.clientY; startV = v; e.preventDefault(); e.stopPropagation();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      v = Math.max(0, Math.min(1, startV + (startY - e.clientY) / 150));
      paint();
      onChange(v);
      if (format) Hints.showValue((hint ? hint.split('|')[0] : 'Value') + ': ' + format(v));
    });
    window.addEventListener('mouseup', () => { dragging = false; });
    el.addEventListener('dblclick', () => { v = 0.5; paint(); onChange(v); });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      v = Math.max(0, Math.min(1, v + (e.deltaY < 0 ? 0.04 : -0.04)));
      paint(); onChange(v);
      if (format) Hints.showValue((hint ? hint.split('|')[0] : 'Value') + ': ' + format(v));
    }, { passive: false });
    return el;
  }

  // ---------- toast ----------
  let toastTimer = null;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function download(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // ---------- views ----------
  function showView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.view-tab[data-view]').forEach(t => t.classList.remove('active'));
    const view = document.getElementById('view-' + name);
    const tab = document.querySelector(`.view-tab[data-view="${name}"]`);
    if (view) view.classList.add('active');
    if (tab) tab.classList.add('active');
    if (name === 'piano') UIPiano.render();
    if (name === 'playlist') UIPlaylist.render();
  }

  // ---------- mixer floating window ----------
  function mixerOpen() {
    return document.getElementById('mixer-window').classList.contains('open');
  }
  function toggleMixer(open) {
    const win = document.getElementById('mixer-window');
    const willOpen = open != null ? open : !win.classList.contains('open');
    win.classList.toggle('open', willOpen);
    document.getElementById('tab-mixer').classList.toggle('active', willOpen);
    if (willOpen) UIMixer.render();
  }
  function initMixerWindow() {
    const win = document.getElementById('mixer-window');
    const bar = document.getElementById('mixer-titlebar');
    let dragging = false, offX = 0, offY = 0;
    bar.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      dragging = true;
      const r = win.getBoundingClientRect();
      offX = e.clientX - r.left;
      offY = e.clientY - r.top;
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const x = Math.max(0, Math.min(innerWidth - 120, e.clientX - offX));
      const y = Math.max(0, Math.min(innerHeight - 60, e.clientY - offY));
      win.style.left = x + 'px';
      win.style.top = y + 'px';
    });
    window.addEventListener('mouseup', () => { dragging = false; });
    document.getElementById('mixer-close').onclick = () => toggleMixer(false);
    document.getElementById('tab-mixer').onclick = () => toggleMixer();
  }

  function setPianoChannel(id) { UIPiano.setChannel(id); }

  // ---------- transport UI ----------
  function syncTransportButtons() {
    document.getElementById('btn-play').classList.toggle('active', Engine.transport.playing);
  }
  function syncModeButtons() {
    document.getElementById('mode-pat').classList.toggle('active', Engine.transport.mode === 'pattern');
    document.getElementById('mode-song').classList.toggle('active', Engine.transport.mode === 'song');
  }

  function updatePosition() {
    const t = Engine.transport;
    const tick = t.mode === 'pattern' ? t.step : (t.playing ? t.songTick : (t.pausedStep != null ? t.pausedStep : t.songTick));
    const bar = Math.floor(tick / 16) + 1;
    const beat = Math.floor((tick % 16) / 4) + 1;
    const step = (tick % 4) + 1;
    document.getElementById('position').textContent = `${bar}:${beat}:${step}`;
  }

  // vertical-drag number boxes (bpm / swing / master)
  function attachNumbox(id, get, set, fmt, step) {
    const el = document.getElementById(id);
    let dragging = false, startY = 0, startV = 0;
    el.addEventListener('mousedown', (e) => { dragging = true; startY = e.clientY; startV = get(); e.preventDefault(); });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      set(startV + (startY - e.clientY) * step);
      el.querySelector('.val').textContent = fmt(get());
      Hints.showValue(el.querySelector('.lbl').textContent + ': ' + fmt(get()));
    });
    window.addEventListener('mouseup', () => { dragging = false; });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      set(get() + (e.deltaY < 0 ? 1 : -1) * step * 30);
      el.querySelector('.val').textContent = fmt(get());
    }, { passive: false });
    el.querySelector('.val').textContent = fmt(get());
  }

  // ---------- browser sidebar ----------
  function renderBrowser() {
    const drums = document.getElementById('browser-drums');
    const melodic = document.getElementById('browser-melodic');
    drums.innerHTML = ''; melodic.innerHTML = '';
    for (const inst of Instruments.list) {
      const item = document.createElement('div');
      item.className = 'browser-item';
      item.dataset.hint = `${inst.name}|${inst.desc} Click to preview, ＋ to add it to the Channel Rack.`;
      const sw = document.createElement('span');
      sw.className = 'swatch'; sw.style.background = inst.color;
      item.appendChild(sw);
      item.appendChild(document.createTextNode(inst.name));
      const add = document.createElement('span');
      add.className = 'add'; add.textContent = '＋';
      item.appendChild(add);
      item.onclick = (e) => {
        if (e.target === add) {
          State.snapshot();
          const track = (State.project.channels.length % 8) + 1;
          State.project.channels.push(State.newChannel(inst.id, track));
          UIRack.render();
          toast(inst.name + ' added to Channel Rack');
        } else {
          Sequencer.previewInstrument(inst.id, inst.type === 'drum' ? 60 : 60);
        }
      };
      (inst.type === 'drum' ? drums : melodic).appendChild(item);
    }

    // vintage kits (loaded on demand from the CC0 sample host)
    const kits = document.getElementById('browser-kits');
    kits.innerHTML = '';
    Object.entries(Sampler.KITS).forEach(([kitId, kit]) => {
      const item = document.createElement('div');
      item.className = 'browser-item';
      item.dataset.hint = `${kit.name}|${kit.desc} Click to load its real sampled sounds as new channels (needs internet).`;
      const sw = document.createElement('span');
      sw.className = 'swatch'; sw.style.background = '#d4a24a';
      item.appendChild(sw);
      item.appendChild(document.createTextNode(kit.name));
      const add = document.createElement('span');
      add.className = 'add'; add.textContent = '⬇';
      item.appendChild(add);
      item.onclick = async () => {
        toast('Loading ' + kit.name + '…');
        try {
          const sounds = await Sampler.loadKit(kitId);
          State.snapshot();
          sounds.forEach((s, i) => {
            const ch = State.newChannel(s.id, (i % 8) + 1);
            ch.name = s.name;
            State.project.channels.push(ch);
          });
          UIRack.render();
          toast('✔ ' + kit.name + ': ' + sounds.length + ' sounds added');
        } catch (err) {
          toast('Could not load kit (offline?) — the built-in synth drums still work!');
        }
      };
      kits.appendChild(item);
    });

    // demos
    const demos = document.getElementById('browser-demos');
    demos.innerHTML = '';
    Demos.list.forEach(d => {
      const item = document.createElement('div');
      item.className = 'browser-item';
      item.dataset.hint = `${d.name}|${d.desc}`;
      item.appendChild(document.createTextNode(d.name));
      item.onclick = () => {
        if (confirm('Load demo "' + d.name + '"? (Your current project will be replaced — save first if you want to keep it.)')) {
          Demos.load(d.id);
        }
      };
      demos.appendChild(item);
    });
  }

  // ---------- instrument picker ----------
  function pickInstrument() {
    const names = Instruments.list.map((i, n) => `${n + 1}. ${i.name}`).join('\n');
    const pick = prompt('Add which instrument?\n\n' + names + '\n\nEnter a number:');
    const idx = parseInt(pick, 10) - 1;
    if (idx >= 0 && idx < Instruments.list.length) {
      State.snapshot();
      State.project.channels.push(State.newChannel(Instruments.list[idx].id, (State.project.channels.length % 8) + 1));
      UIRack.render();
    }
  }

  // ---------- save / load ----------
  function saveProject() {
    State.project.name = State.project.name === 'Untitled'
      ? (prompt('Project name:', 'My Song') || 'My Song') : State.project.name;
    State.saveLocal('manual');
    const blob = new Blob([State.serialize(true)], { type: 'application/json' });
    download(blob, State.project.name.replace(/[^a-z0-9-_ ]/gi, '') + '.trex');
    toast('✔ Saved in browser + downloaded .trex file');
  }

  function newProject() {
    if (!confirm('Start a new project?\n\nYour current song will be saved first (in this browser + downloaded as a .trex file).')) return;
    // save what's there now
    if (State.project.name === 'Untitled') {
      State.project.name = prompt('Name your current song before we file it away:', 'My Song') || 'My Song';
    }
    const savedName = State.project.name;
    State.saveLocal('manual');
    download(new Blob([State.serialize(true)], { type: 'application/json' }),
      savedName.replace(/[^a-z0-9-_ ]/gi, '') + '.trex');
    // fresh start
    Engine.stop();
    State.project = State.blank();
    State.saveLocal('autosave');
    refreshAll();
    showView('rack');
    toast('✔ "' + savedName + '" saved — fresh project ready. Make some noise!');
  }

  function openProject() {
    const choice = prompt('Open:\n1. Last saved project (browser)\n2. A .trex file from your computer\n\nEnter 1 or 2:');
    if (choice === '1') {
      if (State.loadLocal('manual') || State.loadLocal('autosave')) { refreshAll(); toast('Project loaded'); }
      else toast('No saved project found in this browser');
    } else if (choice === '2') {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.trex,.json';
      input.onchange = () => {
        const f = input.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          try { State.load(r.result); refreshAll(); toast('✔ Loaded ' + f.name); }
          catch (e) { toast('Not a valid Trex Studio project file'); }
        };
        r.readAsText(f);
      };
      input.click();
    }
  }

  function refreshAll() {
    Engine.setBpm(State.project.bpm);
    Engine.setSwing(State.project.swing);
    document.getElementById('bpm-val').textContent = Math.round(State.project.bpm);
    document.getElementById('swing-val').textContent = Math.round(State.project.swing * 100) + '%';
    Mixer.build();
    UIRack.render();
    UIPiano.render();
    UIPlaylist.render();
    UIMixer.render();
  }

  // ---------- keyboard shortcuts ----------
  function handleKeys(e) {
    if (e.target.matches('input, textarea, select')) return;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        if (Engine.transport.playing) Engine.pause(); else Engine.play();
        syncTransportButtons();
        return;
      case 'F1': e.preventDefault(); document.getElementById('guide-back').classList.add('open'); return;
      case 'F5': e.preventDefault(); showView('playlist'); return;
      case 'F6': e.preventDefault(); showView('rack'); return;
      case 'F7': e.preventDefault(); showView('piano'); return;
      case 'F8': e.preventDefault(); showView('record'); return;
      case 'F9': e.preventDefault(); toggleMixer(); return;
      case 'Escape':
        document.getElementById('guide-back').classList.remove('open');
        AIAssist.toggle(false);
        return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey ? State.redo() : State.undo()) { refreshAll(); toast(e.shiftKey ? 'Redo' : 'Undo'); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveProject(); return; }
    // with the Piano Roll open, musical typing wins over single-letter shortcuts (L is a piano key too)
    const pianoActive = document.getElementById('view-piano').classList.contains('active');
    if (pianoActive && !e.ctrlKey && !e.altKey && !e.metaKey && UIPiano.handleKey(e)) return;
    if (e.key.toLowerCase() === 'l' && !e.ctrlKey) {
      const m = Engine.transport.mode === 'pattern' ? 'song' : 'pattern';
      Engine.setMode(m); syncModeButtons(); syncTransportButtons();
      return;
    }
    // musical typing from any other view (A-K etc.)
    if (!e.ctrlKey && !e.altKey && !e.metaKey) UIPiano.handleKey(e);
  }

  // ---------- rAF loop: playheads + meters ----------
  function frame() {
    if (Engine.ctx) {
      const cur = Engine.currentUiStep();
      if (cur && Engine.transport.mode === 'pattern') UIRack.paintPlayhead(cur.step);
      if (Engine.transport.playing && Engine.transport.mode === 'song'
        && document.getElementById('view-playlist').classList.contains('active')) {
        UIPlaylist.paintPlayhead();
      }
      if (Engine.transport.playing) updatePosition();
      document.getElementById('master-fill').style.width = Math.min(100, Engine.masterLevel() * 110) + '%';
      if (mixerOpen()) UIMixer.paintMeters();
      Recorder.paintMonitor();
    }
    requestAnimationFrame(frame);
  }

  // ---------- boot ----------
  function enterStudio() {
    Engine.ensureContext();          // unlock audio inside the user gesture
    document.getElementById('splash').classList.add('fade');
    const app = document.getElementById('app');
    app.classList.add('ready');

    Sequencer.init();
    Mixer.build();
    Engine.on('stop', () => { syncTransportButtons(); UIRack.paintPlayhead(null); updatePosition(); });
    Engine.on('start', syncTransportButtons);

    // never show an empty project: restore autosave or load the demo
    if (!State.loadLocal('autosave')) {
      Demos.load('firstBeat');
      setTimeout(() => {
        document.getElementById('guide-back').classList.add('open');
      }, 700);
    } else {
      toast('Welcome back — your project was restored');
    }
    refreshAll();
    setInterval(() => State.saveLocal('autosave'), 15000);
    frame();
  }

  function init() {
    // splash: hold ~4s before revealing the enter button (it's part of the show)
    setTimeout(() => document.querySelector('#splash .enter').classList.add('show'), 3800);
    document.getElementById('splash-enter').onclick = (e) => { e.stopPropagation(); enterStudio(); };

    // transport
    document.getElementById('btn-play').onclick = () => { Engine.play(); syncTransportButtons(); };
    document.getElementById('btn-pause').onclick = () => { Engine.pause(); syncTransportButtons(); };
    document.getElementById('btn-stop').onclick = () => { Engine.stop(); };
    document.getElementById('btn-rewind').onclick = () => { Engine.rewind(); updatePosition(); };
    document.getElementById('btn-metro').onclick = (e) => {
      Engine.transport.metronome = !Engine.transport.metronome;
      e.currentTarget.classList.toggle('active', Engine.transport.metronome);
    };
    document.getElementById('mode-pat').onclick = () => { Engine.setMode('pattern'); syncModeButtons(); syncTransportButtons(); };
    document.getElementById('mode-song').onclick = () => { Engine.setMode('song'); syncModeButtons(); syncTransportButtons(); };

    attachNumbox('bpm-box',
      () => State.project.bpm,
      v => { State.project.bpm = Math.max(30, Math.min(300, Math.round(v))); Engine.setBpm(State.project.bpm); },
      v => Math.round(v), 0.5);
    attachNumbox('swing-box',
      () => State.project.swing * 100,
      v => { State.project.swing = Math.max(0, Math.min(100, v)) / 100; Engine.setSwing(State.project.swing); },
      v => Math.round(v) + '%', 0.6);
    attachNumbox('master-box',
      () => (Engine.master ? Engine.master.gain.value * 100 : 80),
      v => { if (Engine.master) Engine.master.gain.value = Math.max(0, Math.min(1.25, v / 100)); },
      v => Math.round(v), 0.6);

    // tabs (the Mixer tab toggles its floating window instead)
    document.querySelectorAll('.view-tab[data-view]').forEach(tab => {
      tab.onclick = () => showView(tab.dataset.view);
    });
    initMixerWindow();

    // toolbar buttons
    document.getElementById('btn-new').onclick = newProject;
    document.getElementById('btn-save').onclick = saveProject;
    document.getElementById('btn-open').onclick = openProject;
    document.getElementById('guide-close').onclick = () => document.getElementById('guide-back').classList.remove('open');
    document.getElementById('guide-back').addEventListener('click', (e) => {
      if (e.target.id === 'guide-back') e.currentTarget.classList.remove('open');
    });

    window.addEventListener('keydown', handleKeys);

    // module init
    UIRack.init();
    UIPiano.init();
    UIPlaylist.init();
    Recorder.init();
    Hints.init();
    Exporter.init();
    AIAssist.init();
    renderBrowser();
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    makeKnob, toast, download, showView, setPianoChannel, refreshAll,
    syncTransportButtons, syncModeButtons, updatePosition, pickInstrument,
  };
})();
