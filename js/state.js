/* ============================================================
   Trex Studio Producer — Project State
   One serializable object describes the whole song. Everything
   (UI, save/load, undo, AI assist) reads and writes this state.
   ============================================================ */
'use strict';

const State = (() => {
  const MIXER_TRACKS = 9; // 0 = Master, 1..8 = inserts

  function defaultMixer() {
    const tracks = [];
    for (let i = 0; i < MIXER_TRACKS; i++) {
      tracks.push({
        id: i,
        name: i === 0 ? 'Master' : 'Insert ' + i,
        volume: 0.8, pan: 0, mute: false, solo: false,
        sendReverb: 0, sendDelay: 0, // shared bus send amounts
        fx: [], // [{ defId, values, bypassed }]
      });
    }
    return tracks;
  }

  function newChannel(instrumentId, mixerTrack = 1) {
    const inst = Instruments.byId[instrumentId];
    return {
      id: 'ch' + Math.random().toString(36).slice(2, 9),
      instrumentId,
      name: inst ? inst.name : instrumentId,
      volume: 0.8,
      pan: 0,
      pitch: 0,           // semitone offset applied to every note
      mute: false,
      mixerTrack,
    };
  }

  function newPattern(name, length = 16) {
    return {
      id: 'pat' + Math.random().toString(36).slice(2, 9),
      name,
      length,             // steps (16 = 1 bar of 16ths)
      steps: {},          // channelId -> [{on, vel} x length]
      notes: {},          // channelId -> [{key, start, len, vel}] (piano roll)
    };
  }

  function blank() {
    return {
      meta: { app: 'Trex Studio Producer', version: 1 },
      name: 'Untitled',
      bpm: 130,
      swing: 0,
      channels: [
        newChannel('kick808', 1),
        newChannel('clap', 2),
        newChannel('hatClosed', 3),
        newChannel('snare', 2),
        newChannel('piano', 5),
        newChannel('subBass', 4),
      ],
      patterns: [newPattern('Pattern 1')],
      activePattern: 0,
      // playlist clips: pattern clips + audio clips on arrangement tracks
      playlist: [],       // [{ id, type:'pattern', patternId, track, start(bar), length(bars) }]
      audioClips: [],     // [{ id, type:'audio', name, track, start(bar), lengthSteps, sampleId }]
      playlistTracks: 8,
      mixer: defaultMixer(),
      automation: [],     // [{ id, name, target:{kind,track,slot,param}, points:[{tick,value}] }]
      loop: { start: 0, end: 0 }, // song-mode loop region in 16th steps (0,0 = off)
    };
  }

  let project = blank();

  // Runtime-only stores (not serialized directly)
  const samples = {};   // sampleId -> AudioBuffer (recordings + imported samples)

  // ---------- undo ----------
  const undoStack = [];
  const redoStack = [];
  function snapshot() {
    undoStack.push(JSON.stringify(project));
    if (undoStack.length > 60) undoStack.shift();
    redoStack.length = 0;
  }
  function undo() {
    if (!undoStack.length) return false;
    redoStack.push(JSON.stringify(project));
    project = JSON.parse(undoStack.pop());
    return true;
  }
  function redo() {
    if (!redoStack.length) return false;
    undoStack.push(JSON.stringify(project));
    project = JSON.parse(redoStack.pop());
    return true;
  }

  // ---------- step helpers ----------
  function stepsFor(pattern, channelId) {
    if (!pattern.steps[channelId] || pattern.steps[channelId].length !== pattern.length) {
      const old = pattern.steps[channelId] || [];
      pattern.steps[channelId] = Array.from({ length: pattern.length },
        (_, i) => old[i] || { on: false, vel: 1 });
    }
    return pattern.steps[channelId];
  }

  function notesFor(pattern, channelId) {
    if (!pattern.notes[channelId]) pattern.notes[channelId] = [];
    return pattern.notes[channelId];
  }

  function activePattern() { return project.patterns[project.activePattern]; }

  // Song length in steps (end of the last clip), min 4 bars.
  function songLengthSteps() {
    let end = 4 * 16;
    for (const c of project.playlist) {
      const clipEnd = (c.start + c.length) * 16;
      if (clipEnd > end) end = clipEnd;
    }
    for (const c of project.audioClips) {
      const clipEnd = c.start * 16 + Math.ceil(c.lengthSteps);
      if (clipEnd > end) end = clipEnd;
    }
    return end;
  }

  // ---------- persistence ----------
  // Recorded/imported audio is embedded in downloaded .trex files as
  // base64 16-bit PCM (skipped for localStorage, which has tight quotas).
  function encodeSamples() {
    const out = {};
    for (const [id, buf] of Object.entries(samples)) {
      const chans = [];
      for (let c = 0; c < buf.numberOfChannels; c++) {
        const f = buf.getChannelData(c);
        const i16 = new Int16Array(f.length);
        for (let i = 0; i < f.length; i++) {
          const s = Math.max(-1, Math.min(1, f[i]));
          i16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        const bytes = new Uint8Array(i16.buffer);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        chans.push(btoa(bin));
      }
      out[id] = { rate: buf.sampleRate, length: buf.length, channels: chans };
    }
    return out;
  }

  function restoreSamples(data, ctx) {
    for (const [id, s] of Object.entries(data || {})) {
      try {
        const buf = ctx.createBuffer(s.channels.length, s.length, s.rate);
        s.channels.forEach((b64, c) => {
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const i16 = new Int16Array(bytes.buffer);
          const f = buf.getChannelData(c);
          for (let i = 0; i < i16.length; i++) f[i] = i16[i] / 0x8000;
        });
        samples[id] = buf;
        if (typeof Sampler !== 'undefined') Sampler.restore(id, buf);
      } catch (e) { /* one bad sample shouldn't kill the whole load */ }
    }
  }

  function serialize(includeSamples = false) {
    if (!includeSamples || !Object.keys(samples).length) return JSON.stringify(project);
    return JSON.stringify({ ...project, samplesData: encodeSamples() });
  }

  function load(json) {
    const p = (typeof json === 'string') ? JSON.parse(json) : json;
    if (!p || !p.patterns) throw new Error('Not a Trex Studio project');
    if (p.samplesData) {
      restoreSamples(p.samplesData, Engine.ensureContext());
      delete p.samplesData;
    }
    // upgrade projects saved before these features existed
    p.automation = p.automation || [];
    p.loop = p.loop || { start: 0, end: 0 };
    (p.mixer || []).forEach(t => {
      t.sendReverb = t.sendReverb || 0;
      t.sendDelay = t.sendDelay || 0;
    });
    project = p;
  }
  function saveLocal(slot = 'autosave') {
    try { localStorage.setItem('trex-studio-' + slot, serialize()); } catch (e) {}
  }
  function loadLocal(slot = 'autosave') {
    const raw = localStorage.getItem('trex-studio-' + slot);
    if (raw) { load(raw); return true; }
    return false;
  }

  return {
    get project() { return project; },
    set project(p) { project = p; },
    samples,
    blank, newChannel, newPattern,
    stepsFor, notesFor, activePattern, songLengthSteps,
    snapshot, undo, redo,
    serialize, load, saveLocal, loadLocal,
    MIXER_TRACKS,
  };
})();
