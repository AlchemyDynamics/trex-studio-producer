/* ============================================================
   Trex Studio Producer — Mixer (audio layer)
   Builds runtime channel strips for State.project.mixer:
   strip: input → FX chain → fader → panner → analyser → master
   Track 0 is Master: its FX chain sits before Engine.master.
   ============================================================ */
'use strict';

const Mixer = (() => {
  let strips = [];   // runtime strips, index = mixer track id

  function build() {
    const ctx = Engine.ensureContext();
    // tear down old strips
    strips.forEach(s => { try { s.output.disconnect(); } catch (e) {} });
    strips = [];

    const cfg = State.project.mixer;

    // Master strip (track 0) — FX chain feeding Engine.master
    const masterChain = Effects.createChain(ctx);
    const masterFader = ctx.createGain();
    const masterAnalyser = ctx.createAnalyser(); masterAnalyser.fftSize = 256;
    masterChain.output.connect(masterFader);
    masterFader.connect(masterAnalyser);
    masterAnalyser.connect(Engine.master);
    strips[0] = {
      input: masterChain.input, output: masterAnalyser,
      fader: masterFader, panner: null, analyser: masterAnalyser, chain: masterChain,
    };
    masterChain.load(cfg[0].fx);
    masterFader.gain.value = cfg[0].volume;

    // Insert strips 1..N → master strip input
    for (let i = 1; i < cfg.length; i++) {
      const chain = Effects.createChain(ctx);
      const fader = ctx.createGain();
      const panner = ctx.createStereoPanner();
      const analyser = ctx.createAnalyser(); analyser.fftSize = 256;
      chain.output.connect(fader);
      fader.connect(panner);
      panner.connect(analyser);
      analyser.connect(strips[0].input);
      strips[i] = { input: chain.input, output: analyser, fader, panner, analyser, chain };
      chain.load(cfg[i].fx);
      applyTrack(i);
    }
    applyTrack(0);
    return strips;
  }

  // Push volume/pan/mute/solo from state into the audio graph.
  function applyTrack(i) {
    const s = strips[i];
    const cfg = State.project.mixer[i];
    if (!s || !cfg) return;
    const anySolo = State.project.mixer.some(t => t.solo && t.id !== 0);
    const audible = !cfg.mute && (i === 0 || !anySolo || cfg.solo);
    const ctx = Engine.ctx;
    const target = audible ? cfg.volume : 0;
    if (ctx) s.fader.gain.setTargetAtTime(target, ctx.currentTime, 0.015);
    else s.fader.gain.value = target;
    if (s.panner) s.panner.pan.value = cfg.pan;
  }

  function applyAll() {
    for (let i = 0; i < strips.length; i++) applyTrack(i);
  }

  // Where a channel's notes should be routed.
  function inputFor(mixerTrack) {
    if (!strips.length) build();
    const s = strips[mixerTrack] || strips[1] || strips[0];
    return s.input;
  }

  // Peak level 0..1 for meters.
  const buf = new Uint8Array(256);
  function level(i) {
    const s = strips[i];
    if (!s) return 0;
    s.analyser.getByteTimeDomainData(buf);
    let peak = 0;
    for (let j = 0; j < buf.length; j++) {
      const v = Math.abs(buf[j] - 128) / 128;
      if (v > peak) peak = v;
    }
    return peak;
  }

  // FX state changes always write to State AND the live chain.
  function addFx(track, defId) {
    const slot = strips[track].chain.add(defId);
    if (!slot) return null;
    State.project.mixer[track].fx = strips[track].chain.serialize();
    return slot;
  }
  function removeFx(track, index) {
    strips[track].chain.remove(index);
    State.project.mixer[track].fx = strips[track].chain.serialize();
  }
  function setFxParam(track, index, param, value) {
    strips[track].chain.setParam(index, param, value);
    State.project.mixer[track].fx = strips[track].chain.serialize();
  }
  function toggleFxBypass(track, index) {
    strips[track].chain.toggleBypass(index);
    State.project.mixer[track].fx = strips[track].chain.serialize();
  }

  return {
    build, applyTrack, applyAll, inputFor, level,
    addFx, removeFx, setFxParam, toggleFxBypass,
    get strips() { return strips; },
  };
})();
