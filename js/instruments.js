/* ============================================================
   Trex Studio Producer — Instruments
   Every sound is synthesized live with Web Audio oscillators &
   noise, so the whole studio works offline with zero downloads.
   Each instrument = { name, type, color, play(ctx, dest, opts) }
   opts: { time, freq, velocity 0..1, duration (melodic only) }
   ============================================================ */
'use strict';

const Instruments = (() => {

  // ---------- shared helpers ----------
  let noiseBuffer = null;
  function getNoise(ctx) {
    if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
    const len = ctx.sampleRate * 2;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  function env(ctx, param, time, peak, attack, decay, sustain, hold, release) {
    param.setValueAtTime(0.0001, time);
    param.linearRampToValueAtTime(peak, time + attack);
    param.exponentialRampToValueAtTime(Math.max(0.0001, peak * sustain), time + attack + decay);
    if (hold > 0) param.setValueAtTime(Math.max(0.0001, peak * sustain), time + attack + decay + hold);
    param.exponentialRampToValueAtTime(0.0001, time + attack + decay + hold + release);
  }

  function osc(ctx, type, freq, detune = 0) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq; o.detune.value = detune;
    return o;
  }

  // =====================================================================
  // DRUMS (one-shots; freq is ignored or used as tuning)
  // =====================================================================

  function kick808(ctx, dest, { time, velocity = 1 }) {
    const o = osc(ctx, 'sine', 160);
    const g = ctx.createGain();
    o.frequency.setValueAtTime(160, time);
    o.frequency.exponentialRampToValueAtTime(52, time + 0.09);
    o.frequency.exponentialRampToValueAtTime(38, time + 0.4);
    g.gain.setValueAtTime(velocity, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.55);
    // click transient
    const click = osc(ctx, 'square', 900);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(velocity * 0.25, time);
    cg.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
    o.connect(g); g.connect(dest);
    click.connect(cg); cg.connect(dest);
    o.start(time); o.stop(time + 0.6);
    click.start(time); click.stop(time + 0.03);
  }

  function kickPunch(ctx, dest, { time, velocity = 1 }) {
    const o = osc(ctx, 'sine', 220);
    const g = ctx.createGain();
    o.frequency.setValueAtTime(220, time);
    o.frequency.exponentialRampToValueAtTime(55, time + 0.05);
    g.gain.setValueAtTime(velocity * 1.1, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
    const n = ctx.createBufferSource(); n.buffer = getNoise(ctx);
    const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 3000;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(velocity * 0.3, time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
    o.connect(g); g.connect(dest);
    n.connect(nf); nf.connect(ng); ng.connect(dest);
    o.start(time); o.stop(time + 0.3);
    n.start(time); n.stop(time + 0.05);
  }

  function snare(ctx, dest, { time, velocity = 1 }) {
    // noise body
    const n = ctx.createBufferSource(); n.buffer = getNoise(ctx);
    const nf = ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 1400;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(velocity * 0.75, time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    // tonal thump
    const o = osc(ctx, 'triangle', 190);
    const g = ctx.createGain();
    o.frequency.exponentialRampToValueAtTime(120, time + 0.08);
    g.gain.setValueAtTime(velocity * 0.6, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    n.connect(nf); nf.connect(ng); ng.connect(dest);
    o.connect(g); g.connect(dest);
    n.start(time); n.stop(time + 0.2);
    o.start(time); o.stop(time + 0.12);
  }

  function clap(ctx, dest, { time, velocity = 1 }) {
    const n = ctx.createBufferSource(); n.buffer = getNoise(ctx);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1.4;
    const g = ctx.createGain();
    // classic 3-burst clap envelope
    g.gain.setValueAtTime(0.0001, time);
    [0, 0.012, 0.026].forEach(off => {
      g.gain.setValueAtTime(velocity * 0.7, time + off);
      g.gain.exponentialRampToValueAtTime(0.05, time + off + 0.01);
    });
    g.gain.setValueAtTime(velocity * 0.7, time + 0.038);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
    n.connect(bp); bp.connect(g); g.connect(dest);
    n.start(time); n.stop(time + 0.3);
  }

  function hatClosed(ctx, dest, { time, velocity = 1 }) {
    metallicHat(ctx, dest, time, velocity * 0.55, 0.045);
  }
  function hatOpen(ctx, dest, { time, velocity = 1 }) {
    metallicHat(ctx, dest, time, velocity * 0.5, 0.4);
  }
  // 6 detuned square oscillators through a highpass = classic 808-style cymbal
  function metallicHat(ctx, dest, time, amp, decay) {
    const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(amp, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + decay);
    hp.connect(g); g.connect(dest);
    ratios.forEach(r => {
      const o = osc(ctx, 'square', 40 * r * 4);
      o.connect(hp);
      o.start(time); o.stop(time + decay + 0.02);
    });
  }

  function tom(ctx, dest, { time, velocity = 1, freq = 140 }) {
    const o = osc(ctx, 'sine', freq * 1.6);
    const g = ctx.createGain();
    o.frequency.exponentialRampToValueAtTime(freq * 0.8, time + 0.18);
    g.gain.setValueAtTime(velocity * 0.9, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.32);
    o.connect(g); g.connect(dest);
    o.start(time); o.stop(time + 0.35);
  }

  function rimshot(ctx, dest, { time, velocity = 1 }) {
    const o = osc(ctx, 'square', 1750);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(velocity * 0.8, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
    o.connect(bp); bp.connect(g); g.connect(dest);
    o.start(time); o.stop(time + 0.07);
  }

  function crash(ctx, dest, { time, velocity = 1 }) {
    const n = ctx.createBufferSource(); n.buffer = getNoise(ctx);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(velocity * 0.5, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 1.4);
    n.connect(hp); hp.connect(g); g.connect(dest);
    n.start(time); n.stop(time + 1.5);
  }

  function shaker(ctx, dest, { time, velocity = 1 }) {
    const n = ctx.createBufferSource(); n.buffer = getNoise(ctx);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 6500; bp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(velocity * 0.4, time + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
    n.connect(bp); bp.connect(g); g.connect(dest);
    n.start(time); n.stop(time + 0.1);
  }

  function cowbell(ctx, dest, { time, velocity = 1 }) {
    const g = ctx.createGain();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 3;
    g.gain.setValueAtTime(velocity * 0.65, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    [540, 800].forEach(f => {
      const o = osc(ctx, 'square', f);
      o.connect(bp);
      o.start(time); o.stop(time + 0.32);
    });
    bp.connect(g); g.connect(dest);
  }

  // =====================================================================
  // MELODIC INSTRUMENTS (freq + duration aware, polyphonic by design)
  // =====================================================================

  function piano(ctx, dest, { time, freq = 261.6, velocity = 1, duration = 0.5 }) {
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(9000, freq * 14), time);
    lp.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 2.5), time + 1.1);
    const rel = 0.25;
    env(ctx, g.gain, time, velocity * 0.5, 0.003, 0.9, 0.22, Math.max(0, duration - 0.9), rel);
    // 3 slightly detuned partials + an octave harmonic give a piano-ish body
    [[1, 'triangle', 0], [1, 'sine', 3.5], [2, 'sine', -3]].forEach(([mult, type, det]) => {
      const o = osc(ctx, type, freq * mult, det);
      const og = ctx.createGain(); og.gain.value = mult === 2 ? 0.35 : 0.7;
      o.connect(og); og.connect(lp);
      o.start(time); o.stop(time + duration + rel + 0.1);
    });
    lp.connect(g); g.connect(dest);
  }

  function ePiano(ctx, dest, { time, freq = 261.6, velocity = 1, duration = 0.5 }) {
    // FM-style tine: carrier sine + fast-decaying bright modulator
    const car = osc(ctx, 'sine', freq);
    const mod = osc(ctx, 'sine', freq * 14);
    const modG = ctx.createGain();
    modG.gain.setValueAtTime(freq * 3 * velocity, time);
    modG.gain.exponentialRampToValueAtTime(1, time + 0.25);
    mod.connect(modG); modG.connect(car.frequency);
    const g = ctx.createGain();
    const rel = 0.3;
    env(ctx, g.gain, time, velocity * 0.55, 0.002, 1.2, 0.3, Math.max(0, duration - 1.2), rel);
    car.connect(g); g.connect(dest);
    car.start(time); car.stop(time + duration + rel + 0.1);
    mod.start(time); mod.stop(time + duration + rel + 0.1);
  }

  function organ(ctx, dest, { time, freq = 261.6, velocity = 1, duration = 0.5 }) {
    const g = ctx.createGain();
    const rel = 0.08;
    env(ctx, g.gain, time, velocity * 0.35, 0.01, 0.05, 0.9, Math.max(0, duration - 0.05), rel);
    // drawbar-style harmonics 1, 2, 3, 4
    [[1, 0.9], [2, 0.55], [3, 0.3], [4, 0.2]].forEach(([mult, amp]) => {
      const o = osc(ctx, 'sine', freq * mult);
      const og = ctx.createGain(); og.gain.value = amp;
      o.connect(og); og.connect(g);
      o.start(time); o.stop(time + duration + rel + 0.05);
    });
    g.connect(dest);
  }

  function subBass(ctx, dest, { time, freq = 65.4, velocity = 1, duration = 0.5 }) {
    const o = osc(ctx, 'sine', freq);
    const o2 = osc(ctx, 'triangle', freq * 2);
    const o2g = ctx.createGain(); o2g.gain.value = 0.15;
    const g = ctx.createGain();
    const rel = 0.1;
    env(ctx, g.gain, time, velocity * 0.85, 0.008, 0.1, 0.85, Math.max(0, duration - 0.1), rel);
    o.connect(g); o2.connect(o2g); o2g.connect(g); g.connect(dest);
    o.start(time); o.stop(time + duration + rel + 0.05);
    o2.start(time); o2.stop(time + duration + rel + 0.05);
  }

  function pluckBass(ctx, dest, { time, freq = 65.4, velocity = 1, duration = 0.5 }) {
    const o = osc(ctx, 'sawtooth', freq);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
    lp.frequency.setValueAtTime(freq * 9, time);
    lp.frequency.exponentialRampToValueAtTime(freq * 1.5, time + 0.18);
    const g = ctx.createGain();
    const rel = 0.08;
    env(ctx, g.gain, time, velocity * 0.7, 0.004, 0.25, 0.4, Math.max(0, duration - 0.25), rel);
    o.connect(lp); lp.connect(g); g.connect(dest);
    o.start(time); o.stop(time + duration + rel + 0.05);
  }

  function leadSaw(ctx, dest, { time, freq = 261.6, velocity = 1, duration = 0.5 }) {
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000; lp.Q.value = 1;
    const rel = 0.12;
    env(ctx, g.gain, time, velocity * 0.32, 0.01, 0.08, 0.8, Math.max(0, duration - 0.08), rel);
    // supersaw: 3 detuned saws
    [-12, 0, 12].forEach(det => {
      const o = osc(ctx, 'sawtooth', freq, det);
      o.connect(lp);
      o.start(time); o.stop(time + duration + rel + 0.05);
    });
    lp.connect(g); g.connect(dest);
  }

  function leadSquare(ctx, dest, { time, freq = 261.6, velocity = 1, duration = 0.5 }) {
    const o = osc(ctx, 'square', freq);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4500;
    const g = ctx.createGain();
    const rel = 0.1;
    env(ctx, g.gain, time, velocity * 0.3, 0.012, 0.06, 0.75, Math.max(0, duration - 0.06), rel);
    // gentle vibrato
    const lfo = osc(ctx, 'sine', 5.5);
    const lfoG = ctx.createGain(); lfoG.gain.value = freq * 0.006;
    lfo.connect(lfoG); lfoG.connect(o.frequency);
    o.connect(lp); lp.connect(g); g.connect(dest);
    o.start(time); o.stop(time + duration + rel + 0.05);
    lfo.start(time); lfo.stop(time + duration + rel + 0.05);
  }

  function pad(ctx, dest, { time, freq = 261.6, velocity = 1, duration = 1 }) {
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    const rel = 0.8;
    env(ctx, g.gain, time, velocity * 0.22, 0.5, 0.4, 0.8, Math.max(0, duration - 0.4), rel);
    [[1, -8], [1, 8], [0.5, -4], [2, 5]].forEach(([mult, det]) => {
      const o = osc(ctx, 'sawtooth', freq * mult, det);
      const og = ctx.createGain(); og.gain.value = mult === 1 ? 0.5 : 0.25;
      o.connect(og); og.connect(lp);
      o.start(time); o.stop(time + duration + rel + 0.1);
    });
    lp.connect(g); g.connect(dest);
  }

  function strings(ctx, dest, { time, freq = 261.6, velocity = 1, duration = 1 }) {
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3500; lp.Q.value = 0.5;
    const rel = 0.5;
    env(ctx, g.gain, time, velocity * 0.26, 0.28, 0.2, 0.85, Math.max(0, duration - 0.2), rel);
    // ensemble: detuned saws + slow LFO shimmer on the filter
    [-10, -3, 4, 11].forEach(det => {
      const o = osc(ctx, 'sawtooth', freq, det);
      o.connect(lp);
      o.start(time); o.stop(time + duration + rel + 0.1);
    });
    const lfo = osc(ctx, 'sine', 0.7);
    const lfoG = ctx.createGain(); lfoG.gain.value = 300;
    lfo.connect(lfoG); lfoG.connect(lp.frequency);
    lfo.start(time); lfo.stop(time + duration + rel + 0.1);
    lp.connect(g); g.connect(dest);
  }

  function brass(ctx, dest, { time, freq = 261.6, velocity = 1, duration = 0.5 }) {
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
    // brass "blat": filter opens quickly after the attack
    lp.frequency.setValueAtTime(freq * 1.2, time);
    lp.frequency.linearRampToValueAtTime(Math.min(8000, freq * 8), time + 0.12);
    const rel = 0.15;
    env(ctx, g.gain, time, velocity * 0.4, 0.06, 0.1, 0.8, Math.max(0, duration - 0.1), rel);
    [0, 6].forEach(det => {
      const o = osc(ctx, 'sawtooth', freq, det);
      o.connect(lp);
      o.start(time); o.stop(time + duration + rel + 0.05);
    });
    lp.connect(g); g.connect(dest);
  }

  function bell(ctx, dest, { time, freq = 523.2, velocity = 1, duration = 0.5 }) {
    // FM bell: inharmonic modulator ratio
    const car = osc(ctx, 'sine', freq);
    const mod = osc(ctx, 'sine', freq * 3.53);
    const modG = ctx.createGain();
    modG.gain.setValueAtTime(freq * 2.2, time);
    modG.gain.exponentialRampToValueAtTime(0.1, time + 1.2);
    mod.connect(modG); modG.connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(velocity * 0.4, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + Math.max(1.2, duration));
    car.connect(g); g.connect(dest);
    const stopAt = time + Math.max(1.3, duration) + 0.1;
    car.start(time); car.stop(stopAt);
    mod.start(time); mod.stop(stopAt);
  }

  function pluck(ctx, dest, { time, freq = 261.6, velocity = 1, duration = 0.3 }) {
    const o = osc(ctx, 'triangle', freq);
    const o2 = osc(ctx, 'sawtooth', freq, 4);
    const o2g = ctx.createGain(); o2g.gain.value = 0.3;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(freq * 10, time);
    lp.frequency.exponentialRampToValueAtTime(freq * 1.2, time + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(velocity * 0.55, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.45);
    o.connect(lp); o2.connect(o2g); o2g.connect(lp); lp.connect(g); g.connect(dest);
    o.start(time); o.stop(time + 0.5);
    o2.start(time); o2.stop(time + 0.5);
  }

  function harpsichord(ctx, dest, { time, freq = 261.6, velocity = 1, duration = 0.5 }) {
    // bright double-strung pluck: saw + octave saw, fast decay, no sustain
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(11000, freq * 20), time);
    lp.frequency.exponentialRampToValueAtTime(Math.max(600, freq * 3), time + 0.5);
    g.gain.setValueAtTime(velocity * 0.4, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + Math.max(0.6, Math.min(duration + 0.2, 1.2)));
    [[1, 0.7, 0], [2, 0.35, 4], [1, 0.5, -3]].forEach(([mult, amp, det]) => {
      const o = osc(ctx, 'sawtooth', freq * mult, det);
      const og = ctx.createGain(); og.gain.value = amp;
      o.connect(og); og.connect(lp);
      o.start(time); o.stop(time + 1.3);
    });
    lp.connect(g); g.connect(dest);
  }

  function clavinet(ctx, dest, { time, freq = 261.6, velocity = 1, duration = 0.3 }) {
    // funky percussive bite: saw through a resonant bandpass, very fast decay
    const o = osc(ctx, 'sawtooth', freq);
    const o2 = osc(ctx, 'square', freq * 2, 6);
    const o2g = ctx.createGain(); o2g.gain.value = 0.25;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5;
    bp.frequency.setValueAtTime(Math.min(9000, freq * 8), time);
    bp.frequency.exponentialRampToValueAtTime(Math.max(300, freq * 1.5), time + 0.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(velocity * 0.8, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + Math.max(0.3, Math.min(duration, 0.6)));
    o.connect(bp); o2.connect(o2g); o2g.connect(bp); bp.connect(g); g.connect(dest);
    o.start(time); o.stop(time + 0.7);
    o2.start(time); o2.stop(time + 0.7);
  }

  function musicBox(ctx, dest, { time, freq = 523.2, velocity = 1, duration = 0.5 }) {
    // delicate tine: sine + sparkly inharmonic FM partial, long ring
    const car = osc(ctx, 'sine', freq * 2); // music boxes speak an octave up
    const mod = osc(ctx, 'sine', freq * 2 * 3.01);
    const modG = ctx.createGain();
    modG.gain.setValueAtTime(freq * 1.2, time);
    modG.gain.exponentialRampToValueAtTime(0.5, time + 0.6);
    mod.connect(modG); modG.connect(car.frequency);
    const spark = osc(ctx, 'sine', freq * 8);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(velocity * 0.08, time);
    sg.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(velocity * 0.35, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + Math.max(1.4, duration));
    car.connect(g); spark.connect(sg); sg.connect(dest); g.connect(dest);
    const stopAt = time + Math.max(1.5, duration) + 0.1;
    car.start(time); car.stop(stopAt);
    mod.start(time); mod.stop(stopAt);
    spark.start(time); spark.stop(time + 0.35);
  }

  function accordion(ctx, dest, { time, freq = 261.6, velocity = 1, duration = 0.5 }) {
    // reedy sustained squeeze: detuned squares + saw, bellows vibrato
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4500; lp.Q.value = 0.7;
    const rel = 0.12;
    env(ctx, g.gain, time, velocity * 0.28, 0.06, 0.05, 0.9, Math.max(0, duration - 0.05), rel);
    const oscs = [];
    [['square', 1, -7], ['square', 1, 7], ['sawtooth', 2, 0]].forEach(([type, mult, det]) => {
      const o = osc(ctx, type, freq * mult, det);
      const og = ctx.createGain(); og.gain.value = mult === 2 ? 0.18 : 0.5;
      o.connect(og); og.connect(lp);
      o.start(time); o.stop(time + duration + rel + 0.05);
      oscs.push(o);
    });
    const lfo = osc(ctx, 'sine', 5.5);
    const lfoG = ctx.createGain(); lfoG.gain.value = freq * 0.005;
    lfo.connect(lfoG);
    oscs.forEach(o => lfoG.connect(o.frequency));
    lfo.start(time); lfo.stop(time + duration + rel + 0.05);
    lp.connect(g); g.connect(dest);
  }

  function churchOrgan(ctx, dest, { time, freq = 261.6, velocity = 1, duration = 0.5 }) {
    // big cathedral stack: sub + harmonics with slow swell and gentle detune shimmer
    const g = ctx.createGain();
    const rel = 0.35;
    env(ctx, g.gain, time, velocity * 0.3, 0.09, 0.05, 0.95, Math.max(0, duration - 0.05), rel);
    [[0.5, 0.5, 0], [1, 0.9, 0], [1, 0.3, 5], [2, 0.5, -3], [3, 0.22, 0], [4, 0.16, 3]].forEach(([mult, amp, det]) => {
      const o = osc(ctx, 'sine', freq * mult, det);
      const og = ctx.createGain(); og.gain.value = amp;
      o.connect(og); og.connect(g);
      o.start(time); o.stop(time + duration + rel + 0.1);
    });
    g.connect(dest);
  }

  function flute(ctx, dest, { time, freq = 523.2, velocity = 1, duration = 0.5 }) {
    const o = osc(ctx, 'sine', freq);
    const o2 = osc(ctx, 'triangle', freq * 2);
    const o2g = ctx.createGain(); o2g.gain.value = 0.12;
    // breath noise
    const n = ctx.createBufferSource(); n.buffer = getNoise(ctx); n.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq * 2; bp.Q.value = 2;
    const ng = ctx.createGain(); ng.gain.value = 0.04;
    const g = ctx.createGain();
    const rel = 0.2;
    env(ctx, g.gain, time, velocity * 0.35, 0.09, 0.05, 0.9, Math.max(0, duration - 0.05), rel);
    const lfo = osc(ctx, 'sine', 5);
    const lfoG = ctx.createGain(); lfoG.gain.value = freq * 0.008;
    lfo.connect(lfoG); lfoG.connect(o.frequency);
    o.connect(g); o2.connect(o2g); o2g.connect(g);
    n.connect(bp); bp.connect(ng); ng.connect(g);
    g.connect(dest);
    const stopAt = time + duration + rel + 0.05;
    o.start(time); o.stop(stopAt);
    o2.start(time); o2.stop(stopAt);
    n.start(time); n.stop(stopAt);
    lfo.start(time); lfo.stop(stopAt);
  }

  // =====================================================================
  // Registry
  // =====================================================================
  const list = [
    // drums
    { id: 'kick808',   name: '808 Kick',      type: 'drum', color: '#e8734a', play: kick808,
      desc: 'Deep booming kick with a long pitch drop — the heartbeat of hip-hop and trap.' },
    { id: 'kickPunch', name: 'Punch Kick',    type: 'drum', color: '#e8734a', play: kickPunch,
      desc: 'Tight punchy kick for house and pop. Shorter and snappier than the 808.' },
    { id: 'snare',     name: 'Snare',         type: 'drum', color: '#e8c84a', play: snare,
      desc: 'Classic snare crack — usually lands on beats 2 and 4.' },
    { id: 'clap',      name: 'Clap',          type: 'drum', color: '#e8c84a', play: clap,
      desc: 'Layered hand clap. Try it with (or instead of) the snare.' },
    { id: 'hatClosed', name: 'Closed Hat',    type: 'drum', color: '#4ae8c8', play: hatClosed,
      desc: 'Short tick that drives the rhythm. Put it on every 8th or 16th note.' },
    { id: 'hatOpen',   name: 'Open Hat',      type: 'drum', color: '#4ae8c8', play: hatOpen,
      desc: 'Sizzling open hi-hat. Great on off-beats for groove.' },
    { id: 'tom',       name: 'Tom',           type: 'drum', color: '#c87a4a', play: tom,
      desc: 'Round drum hit for fills. Tune it with the pitch knob.' },
    { id: 'rimshot',   name: 'Rimshot',       type: 'drum', color: '#c87a4a', play: rimshot,
      desc: 'Sharp click, like hitting the metal rim of a snare.' },
    { id: 'crash',     name: 'Crash',         type: 'drum', color: '#9a8ae8', play: crash,
      desc: 'Big cymbal wash — perfect to mark the start of a section.' },
    { id: 'shaker',    name: 'Shaker',        type: 'drum', color: '#8ae8a0', play: shaker,
      desc: 'Soft shh-shh texture that fills the space between hats.' },
    { id: 'cowbell',   name: 'Cowbell',       type: 'drum', color: '#8ae8a0', play: cowbell,
      desc: 'More cowbell. Always more cowbell.' },
    // melodic
    { id: 'piano',     name: 'Grand Piano',   type: 'melodic', color: '#6ab0e8', play: piano,
      desc: 'Bright acoustic-style piano for chords and melodies.' },
    { id: 'ePiano',    name: 'Electric Piano', type: 'melodic', color: '#6ab0e8', play: ePiano,
      desc: 'Warm Rhodes-style tines — smooth for chords and R&B.' },
    { id: 'organ',     name: 'Organ',         type: 'melodic', color: '#6ab0e8', play: organ,
      desc: 'Drawbar organ that holds as long as you hold the note.' },
    { id: 'churchOrgan', name: 'Church Organ', type: 'melodic', color: '#6ab0e8', play: churchOrgan,
      desc: 'Huge cathedral pipe organ — majestic sustained chords.' },
    { id: 'harpsichord', name: 'Harpsichord', type: 'melodic', color: '#6ab0e8', play: harpsichord,
      desc: 'Bright plucked baroque keyboard — instant fancy.' },
    { id: 'clavinet',  name: 'Clavinet',      type: 'melodic', color: '#6ab0e8', play: clavinet,
      desc: 'Funky percussive keys — think Stevie Wonder "Superstition".' },
    { id: 'musicBox',  name: 'Music Box',     type: 'melodic', color: '#6ab0e8', play: musicBox,
      desc: 'Tiny delicate tines that ring like a wind-up music box.' },
    { id: 'accordion', name: 'Accordion',     type: 'melodic', color: '#6ab0e8', play: accordion,
      desc: 'Reedy squeezebox with a gentle bellows vibrato.' },
    { id: 'subBass',   name: 'Sub Bass',      type: 'melodic', color: '#e84a8a', play: subBass,
      desc: 'Pure deep bass you feel more than hear. Keep it on low notes.' },
    { id: 'pluckBass', name: 'Pluck Bass',    type: 'melodic', color: '#e84a8a', play: pluckBass,
      desc: 'Funky filtered bass with a rubbery attack.' },
    { id: 'leadSaw',   name: 'Super Saw Lead', type: 'melodic', color: '#e8e84a', play: leadSaw,
      desc: 'Three detuned saws — the huge EDM lead sound.' },
    { id: 'leadSquare', name: 'Square Lead',  type: 'melodic', color: '#e8e84a', play: leadSquare,
      desc: 'Retro video-game lead with a touch of vibrato.' },
    { id: 'pad',       name: 'Dream Pad',     type: 'melodic', color: '#b08ae8', play: pad,
      desc: 'Slow, lush background chords that glue a track together.' },
    { id: 'strings',   name: 'Strings',       type: 'melodic', color: '#b08ae8', play: strings,
      desc: 'Orchestral string ensemble with a slow bow attack.' },
    { id: 'brass',     name: 'Brass Section', type: 'melodic', color: '#e8a04a', play: brass,
      desc: 'Punchy horn stabs — the filter opens like a trumpet blast.' },
    { id: 'bell',      name: 'Bell Keys',     type: 'melodic', color: '#8ae8e8', play: bell,
      desc: 'Glassy FM bells that ring out — great for intros and hooks.' },
    { id: 'pluck',     name: 'Pluck Synth',   type: 'melodic', color: '#8ae8e8', play: pluck,
      desc: 'Short plucked synth, like a digital harp or kalimba.' },
    { id: 'flute',     name: 'Flute',         type: 'melodic', color: '#a0e88a', play: flute,
      desc: 'Airy flute with gentle breath and vibrato.' },
  ];

  const byId = Object.fromEntries(list.map(i => [i.id, i]));

  return { list, byId };
})();
