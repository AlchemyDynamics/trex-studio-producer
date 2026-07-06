/* ============================================================
   Trex Studio Producer — Sequencer
   Answers the engine's "what plays on this step?" question for
   both pattern mode and song mode, and turns notes into sound.
   ============================================================ */
'use strict';

const Sequencer = (() => {

  const A4 = 440;
  function keyToFreq(midiKey) { return A4 * Math.pow(2, (midiKey - 69) / 12); }

  // Play one note on a channel through its mixer routing.
  function playChannelNote(channel, { time, key = 60, velocity = 1, durationSteps = 4 }) {
    const ctx = Engine.ctx;
    if (!ctx || channel.mute) return;
    const dest = Mixer.inputFor(channel.mixerTrack);

    // per-note channel strip: velocity*channel volume + channel pan
    const g = ctx.createGain();
    g.gain.value = channel.volume;
    const p = ctx.createStereoPanner();
    p.pan.value = channel.pan;
    g.connect(p); p.connect(dest);

    const finalKey = key + (channel.pitch || 0);
    const duration = durationSteps * Engine.secondsPerStep();

    if (channel.instrumentId.startsWith('smp:') || channel.instrumentId.startsWith('usr:')) {
      const rate = Math.pow(2, (finalKey - 60) / 12);
      Sampler.play(channel.instrumentId, g, { time, velocity, rate });
    } else {
      const inst = Instruments.byId[channel.instrumentId];
      if (!inst) return;
      inst.play(ctx, g, { time, velocity, freq: keyToFreq(finalKey), duration });
    }
  }

  // ---- pattern playback ----
  function schedulePatternStep(pattern, localStep, when) {
    for (const channel of State.project.channels) {
      // step grid hits (drums or melodic — steps trigger key 60/C5)
      const steps = pattern.steps[channel.id];
      if (steps && steps[localStep] && steps[localStep].on) {
        playChannelNote(channel, { time: when, key: 60, velocity: steps[localStep].vel, durationSteps: 2 });
      }
      // piano roll notes that start on this step
      const notes = pattern.notes[channel.id];
      if (notes) {
        for (const n of notes) {
          if (n.start === localStep) {
            playChannelNote(channel, { time: when, key: n.key, velocity: n.vel, durationSteps: n.len });
          }
        }
      }
    }
  }

  // ---- song playback ----
  const liveAudioSources = new Set();

  function scheduleSongStep(songTick, when) {
    Automation.applyAtTick(songTick, when);
    // pattern clips
    for (const clip of State.project.playlist) {
      const clipStart = clip.start * 16;
      const clipEnd = (clip.start + clip.length) * 16;
      if (songTick < clipStart || songTick >= clipEnd) continue;
      const pattern = State.project.patterns.find(pt => pt.id === clip.patternId);
      if (!pattern) continue;
      const localStep = (songTick - clipStart) % pattern.length;
      schedulePatternStep(pattern, localStep, when);
    }
    // audio clips: start exactly on their first step
    for (const clip of State.project.audioClips) {
      const clipStart = clip.start * 16;
      if (songTick === clipStart) startAudioClip(clip, when, 0);
    }
  }

  function startAudioClip(clip, when, offsetSec) {
    const buffer = State.samples[clip.sampleId];
    const ctx = Engine.ctx;
    if (!buffer || !ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = clip.gain != null ? clip.gain : 0.9;
    src.connect(g);
    g.connect(Mixer.inputFor(clip.mixerTrack || 0));
    src.start(when, Math.min(offsetSec, Math.max(0, buffer.duration - 0.01)));
    // clip length is trimmable in the playlist — stop when the clip window ends
    const remaining = clip.lengthSteps * Engine.secondsPerStep() - offsetSec;
    if (remaining > 0 && remaining < buffer.duration - offsetSec) {
      try { src.stop(when + remaining); } catch (e) {}
    }
    liveAudioSources.add(src);
    src.onended = () => liveAudioSources.delete(src);
  }

  // When playback starts mid-song (scrub), catch audio clips already underway.
  function catchRunningClips() {
    if (Engine.transport.mode !== 'song') return;
    const tick = Engine.transport.songTick;
    const spStep = Engine.secondsPerStep();
    for (const clip of State.project.audioClips) {
      const clipStart = clip.start * 16;
      const clipEnd = clipStart + clip.lengthSteps;
      if (tick > clipStart && tick < clipEnd) {
        startAudioClip(clip, Engine.ctx.currentTime + 0.08, (tick - clipStart) * spStep);
      }
    }
  }

  function stopAllAudio() {
    for (const src of liveAudioSources) { try { src.stop(); } catch (e) {} }
    liveAudioSources.clear();
  }

  // ---- live preview (keyboard / clicking things) ----
  function preview(channel, key = 60, velocity = 0.9) {
    Engine.ensureContext();
    playChannelNote(channel, { time: Engine.ctx.currentTime + 0.005, key, velocity, durationSteps: 4 });
  }

  function previewInstrument(instrumentId, key = 60, velocity = 0.9) {
    Engine.ensureContext();
    const fake = { instrumentId, volume: 0.8, pan: 0, pitch: 0, mute: false, mixerTrack: 0 };
    playChannelNote(fake, { time: Engine.ctx.currentTime + 0.005, key, velocity, durationSteps: 4 });
  }

  // ---- wire into the engine ----
  function init() {
    Engine.patternLength = () => State.activePattern().length;
    Engine.songLength = () => State.songLengthSteps();
    Engine.on('step', (step, when, mode) => {
      if (mode === 'pattern') schedulePatternStep(State.activePattern(), step, when);
      else scheduleSongStep(step, when);
    });
    Engine.on('start', catchRunningClips);
    Engine.on('stop', stopAllAudio);
  }

  return { init, playChannelNote, preview, previewInstrument, keyToFreq, startAudioClip };
})();
