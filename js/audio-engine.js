/* ============================================================
   Trex Studio Producer — Audio Engine
   AudioContext lifecycle, master bus, lookahead scheduler,
   transport (play/pause/stop/scrub), metronome, WAV export.
   ============================================================ */
'use strict';

const Engine = (() => {
  let ctx = null;            // AudioContext (created on first user gesture)
  let masterGain = null;     // final gain before destination
  let masterLimiter = null;  // safety compressor/limiter on master
  let masterAnalyser = null; // for master meters
  let recorderTap = null;    // MediaStreamDestination for exporting live output

  // --- Transport state -------------------------------------------------
  const transport = {
    playing: false,
    mode: 'pattern',        // 'pattern' | 'song'
    bpm: 130,               // FL Studio's classic default
    swing: 0,               // 0..1 applied to off-beat 16ths
    metronome: false,
    // musical position
    step: 0,                // current 16th step within pattern
    songTick: 0,            // current 16th step within song timeline
    loopStart: 0,           // song-mode loop, in 16th steps
    loopEnd: 0,             // 0 = auto (end of arrangement)
    // scheduler bookkeeping
    nextNoteTime: 0,        // audio-clock time of next step
    timerId: null,
    startedAt: 0,           // ctx.currentTime when playback started
    pausedStep: null,       // resume point for pause
  };

  const LOOKAHEAD_MS = 25;        // scheduler wake-up interval
  const SCHEDULE_AHEAD = 0.12;    // seconds of audio scheduled in advance
  const STEPS_PER_BEAT = 4;       // 16th-note grid

  // Queue of steps that were scheduled, for UI playhead sync.
  let stepQueue = [];

  // Callbacks the rest of the app registers.
  const listeners = { step: [], stop: [], start: [] };
  function on(evt, fn) { listeners[evt].push(fn); }
  function emit(evt, ...args) { listeners[evt].forEach(fn => fn(...args)); }

  // --- Context bootstrap ------------------------------------------------
  function ensureContext() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });

    masterGain = ctx.createGain();
    masterGain.gain.value = 0.8;

    masterLimiter = ctx.createDynamicsCompressor();
    masterLimiter.threshold.value = -3;
    masterLimiter.knee.value = 0;
    masterLimiter.ratio.value = 20;
    masterLimiter.attack.value = 0.002;
    masterLimiter.release.value = 0.1;

    masterAnalyser = ctx.createAnalyser();
    masterAnalyser.fftSize = 2048;

    recorderTap = ctx.createMediaStreamDestination();

    masterGain.connect(masterLimiter);
    masterLimiter.connect(masterAnalyser);
    masterAnalyser.connect(ctx.destination);
    masterAnalyser.connect(recorderTap);
    return ctx;
  }

  function secondsPerStep() {
    return 60 / transport.bpm / STEPS_PER_BEAT;
  }

  // Swing: delay every odd 16th by swing * half a step.
  function swingOffset(stepIndex) {
    return (stepIndex % 2 === 1) ? transport.swing * secondsPerStep() * 0.5 : 0;
  }

  // --- Scheduler (lookahead pattern) -------------------------------------
  function schedulerTick() {
    while (transport.nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
      const stepIdx = (transport.mode === 'pattern') ? transport.step : transport.songTick;
      const when = transport.nextNoteTime + swingOffset(stepIdx);
      stepQueue.push({ step: stepIdx, time: transport.nextNoteTime, mode: transport.mode });

      // Hand the step to the app (sequencer + playlist decide what sounds).
      emit('step', stepIdx, when, transport.mode);

      if (transport.metronome) {
        const beatPos = stepIdx % (STEPS_PER_BEAT * 4);
        if (stepIdx % STEPS_PER_BEAT === 0) playMetronomeTick(when, beatPos === 0);
      }

      advanceStep();
    }
  }

  function advanceStep() {
    transport.nextNoteTime += secondsPerStep();
    if (transport.mode === 'pattern') {
      const len = Engine.patternLength ? Engine.patternLength() : 16;
      transport.step = (transport.step + 1) % len;
    } else {
      transport.songTick += 1;
      const end = transport.loopEnd || (Engine.songLength ? Engine.songLength() : 64);
      if (transport.songTick >= end) transport.songTick = transport.loopStart;
    }
  }

  function playMetronomeTick(when, accent) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = accent ? 1600 : 1100;
    g.gain.setValueAtTime(accent ? 0.35 : 0.22, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
    osc.connect(g); g.connect(masterGain);
    osc.start(when); osc.stop(when + 0.06);
  }

  // --- UI playhead sync ---------------------------------------------------
  // Called from requestAnimationFrame; returns the step the user is HEARING now.
  function currentUiStep() {
    let current = null;
    while (stepQueue.length && stepQueue[0].time <= ctx.currentTime) {
      current = stepQueue.shift();
    }
    return current; // may be null between steps
  }

  // --- Transport controls ---------------------------------------------------
  function play() {
    ensureContext();
    if (transport.playing) return;
    transport.playing = true;
    // resume from pause point if there is one
    if (transport.pausedStep !== null) {
      if (transport.mode === 'pattern') transport.step = transport.pausedStep;
      else transport.songTick = transport.pausedStep;
      transport.pausedStep = null;
    }
    transport.nextNoteTime = ctx.currentTime + 0.06;
    transport.startedAt = ctx.currentTime;
    stepQueue = [];
    transport.timerId = setInterval(schedulerTick, LOOKAHEAD_MS);
    emit('start');
  }

  function pause() {
    if (!transport.playing) return;
    transport.playing = false;
    clearInterval(transport.timerId);
    transport.pausedStep = (transport.mode === 'pattern') ? transport.step : transport.songTick;
    stepQueue = [];
    emit('stop', /*paused*/true);
  }

  function stop() {
    transport.playing = false;
    clearInterval(transport.timerId);
    transport.step = 0;
    transport.songTick = transport.loopStart;
    transport.pausedStep = null;
    stepQueue = [];
    emit('stop', false);
  }

  function rewind() {
    const wasPlaying = transport.playing;
    stop();
    if (wasPlaying) play();
  }

  // Scrub: jump the playhead to an arbitrary 16th step (song or pattern mode).
  function seek(stepIdx) {
    if (transport.mode === 'pattern') transport.step = Math.max(0, stepIdx | 0);
    else transport.songTick = Math.max(0, stepIdx | 0);
    if (!transport.playing) transport.pausedStep = Math.max(0, stepIdx | 0);
    if (transport.playing) { stepQueue = []; transport.nextNoteTime = ctx.currentTime + 0.03; }
  }

  function setBpm(bpm) { transport.bpm = Math.min(300, Math.max(30, bpm)); }
  function setSwing(v) { transport.swing = Math.min(1, Math.max(0, v)); }
  function setMode(m) { const was = transport.playing; if (was) stop(); transport.mode = m; if (was) play(); }

  // --- Master metering -------------------------------------------------------
  const meterData = new Uint8Array(2048);
  function masterLevel() {
    if (!masterAnalyser) return 0;
    masterAnalyser.getByteTimeDomainData(meterData);
    let peak = 0;
    for (let i = 0; i < meterData.length; i++) {
      const v = Math.abs(meterData[i] - 128) / 128;
      if (v > peak) peak = v;
    }
    return peak;
  }

  // --- WAV export -------------------------------------------------------------
  // Renders are done live via MediaRecorder on recorderTap (simple + reliable),
  // and encodeWav() converts AudioBuffers (e.g. recorded takes) to .wav blobs.
  function encodeWav(audioBuffer) {
    const numCh = audioBuffer.numberOfChannels;
    const rate = audioBuffer.sampleRate;
    const len = audioBuffer.length * numCh * 2;
    const buf = new ArrayBuffer(44 + len);
    const view = new DataView(buf);
    const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
    writeStr(0, 'RIFF'); view.setUint32(4, 36 + len, true); writeStr(8, 'WAVE');
    writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, numCh, true); view.setUint32(24, rate, true);
    view.setUint32(28, rate * numCh * 2, true); view.setUint16(32, numCh * 2, true);
    view.setUint16(34, 16, true); writeStr(36, 'data'); view.setUint32(40, len, true);
    let off = 44;
    const chans = [];
    for (let c = 0; c < numCh; c++) chans.push(audioBuffer.getChannelData(c));
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let c = 0; c < numCh; c++) {
        let s = Math.max(-1, Math.min(1, chans[c][i]));
        view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        off += 2;
      }
    }
    return new Blob([buf], { type: 'audio/wav' });
  }

  return {
    ensureContext, on,
    get ctx() { return ctx; },
    get master() { return masterGain; },
    get recorderTap() { return recorderTap; },
    transport, play, pause, stop, rewind, seek, setBpm, setSwing, setMode,
    currentUiStep, masterLevel, encodeWav, secondsPerStep,
    STEPS_PER_BEAT,
    // wired up later by app.js:
    patternLength: null, songLength: null,
  };
})();
