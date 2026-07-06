/* ============================================================
   Trex Studio Producer — Effects
   Each effect = { id, name, desc, params: [...], create(ctx) }
   create() returns { input, output, set(param, value), dispose() }
   Effects chain inside a mixer channel: in → fx1 → fx2 → ... → out
   ============================================================ */
'use strict';

const Effects = (() => {

  // ---------- helpers ----------
  function makeDistortionCurve(amount) {
    // classic sigmoid waveshaper; amount 0..100
    const k = amount, n = 44100, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  // Generated impulse response = free reverb, no sample files needed.
  function makeImpulse(ctx, seconds, decay) {
    const rate = ctx.sampleRate;
    const len = Math.max(1, rate * seconds);
    const impulse = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = impulse.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return impulse;
  }

  function dryWet(ctx, wetNode) {
    // returns { input, output, wetGain, dryGain } around any wet-path node
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    input.connect(dry); dry.connect(output);
    input.connect(wetNode);
    wet.connect(output);
    return { input, output, dry, wet };
  }

  // ---------- effect definitions ----------
  const defs = [
    {
      id: 'delay', name: 'Echo Delay', icon: '⟲',
      desc: 'Repeats the sound like an echo. Time sets the gap between repeats, Feedback sets how many repeats you hear.',
      params: [
        { id: 'time', name: 'Time', min: 0.05, max: 1.2, def: 0.28, unit: 's',
          hint: 'Gap between echoes. Around 0.25–0.4s locks nicely with most tempos.' },
        { id: 'feedback', name: 'Feedback', min: 0, max: 0.9, def: 0.35, unit: '',
          hint: 'How much echo feeds back into itself. High = echoes last longer.' },
        { id: 'mix', name: 'Mix', min: 0, max: 1, def: 0.3, unit: '',
          hint: 'Balance of dry sound vs echo. 0 = no echo, 1 = only echo.' },
      ],
      create(ctx) {
        const delay = ctx.createDelay(2.0);
        const fb = ctx.createGain();
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300;
        const io = dryWet(ctx, delay);
        delay.connect(hp); hp.connect(fb); fb.connect(delay);
        hp.connect(io.wet);
        delay.delayTime.value = 0.28; fb.gain.value = 0.35;
        io.dry.gain.value = 1; io.wet.gain.value = 0.3;
        return {
          input: io.input, output: io.output,
          params: { time: delay.delayTime, feedback: fb.gain, mix: io.wet.gain },
          set(p, v) {
            if (p === 'time') delay.delayTime.setTargetAtTime(v, ctx.currentTime, 0.02);
            if (p === 'feedback') fb.gain.value = v;
            if (p === 'mix') { io.wet.gain.value = v; io.dry.gain.value = 1 - v * 0.5; }
          },
        };
      },
    },
    {
      id: 'distortion', name: 'Distortion', icon: '🔥',
      desc: 'Crunches and grits up the sound, from warm drive to full fuzz. Great on basses and leads.',
      params: [
        { id: 'drive', name: 'Drive', min: 0, max: 100, def: 25, unit: '',
          hint: 'How hard the sound gets pushed. Low = warm, high = aggressive fuzz.' },
        { id: 'tone', name: 'Tone', min: 500, max: 12000, def: 5000, unit: 'Hz',
          hint: 'Darkens or brightens the distorted sound.' },
        { id: 'level', name: 'Level', min: 0, max: 1, def: 0.7, unit: '',
          hint: 'Output volume — distortion adds loudness, so trim it here.' },
      ],
      create(ctx) {
        const shaper = ctx.createWaveShaper();
        shaper.curve = makeDistortionCurve(25);
        shaper.oversample = '4x';
        const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 5000;
        const level = ctx.createGain(); level.gain.value = 0.7;
        const input = ctx.createGain();
        input.connect(shaper); shaper.connect(tone); tone.connect(level);
        return {
          input, output: level,
          params: { tone: tone.frequency, level: level.gain },
          set(p, v) {
            if (p === 'drive') shaper.curve = makeDistortionCurve(v);
            if (p === 'tone') tone.frequency.value = v;
            if (p === 'level') level.gain.value = v;
          },
        };
      },
    },
    {
      id: 'filter', name: 'Filter', icon: '◠',
      desc: 'Sweeps away highs or lows. The classic DJ build-up and drop effect.',
      params: [
        { id: 'type', name: 'Type', options: ['lowpass', 'highpass', 'bandpass'], def: 'lowpass',
          hint: 'Lowpass keeps the lows, highpass keeps the highs, bandpass keeps the middle.' },
        { id: 'cutoff', name: 'Cutoff', min: 40, max: 18000, def: 18000, unit: 'Hz', log: true,
          hint: 'Where the filter starts cutting. Sweep it while playing!' },
        { id: 'q', name: 'Resonance', min: 0.1, max: 20, def: 1, unit: '',
          hint: 'Boosts the edge right at the cutoff — high values squeal.' },
      ],
      create(ctx) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 18000; f.Q.value = 1;
        return {
          input: f, output: f,
          params: { cutoff: f.frequency, q: f.Q },
          set(p, v) {
            if (p === 'type') f.type = v;
            if (p === 'cutoff') f.frequency.setTargetAtTime(v, ctx.currentTime, 0.01);
            if (p === 'q') f.Q.value = v;
          },
        };
      },
    },
    {
      id: 'reverb', name: 'Reverb', icon: '≋',
      desc: 'Puts the sound in a room — from a tight booth to a giant cathedral.',
      params: [
        { id: 'size', name: 'Room Size', min: 0.2, max: 5, def: 1.8, unit: 's',
          hint: 'How long the room tail rings. Big = cathedral, small = closet.' },
        { id: 'mix', name: 'Mix', min: 0, max: 1, def: 0.3, unit: '',
          hint: 'Dry vs roomy. A little goes a long way.' },
      ],
      create(ctx) {
        const conv = ctx.createConvolver();
        conv.buffer = makeImpulse(ctx, 1.8, 2.5);
        const io = dryWet(ctx, conv);
        conv.connect(io.wet);
        io.dry.gain.value = 1; io.wet.gain.value = 0.3;
        return {
          input: io.input, output: io.output,
          params: { mix: io.wet.gain },
          set(p, v) {
            if (p === 'size') conv.buffer = makeImpulse(ctx, v, 2.5);
            if (p === 'mix') { io.wet.gain.value = v; io.dry.gain.value = 1 - v * 0.4; }
          },
        };
      },
    },
    {
      id: 'eq3', name: '3-Band EQ', icon: '≡',
      desc: 'Turn the bass, mids, and treble up or down — like a fancy car stereo.',
      params: [
        { id: 'low', name: 'Low', min: -18, max: 18, def: 0, unit: 'dB',
          hint: 'Bass below ~250 Hz. Boost for boom, cut to clean up mud.' },
        { id: 'mid', name: 'Mid', min: -18, max: 18, def: 0, unit: 'dB',
          hint: 'Middle around 1 kHz — where voices and leads live.' },
        { id: 'high', name: 'High', min: -18, max: 18, def: 0, unit: 'dB',
          hint: 'Treble above ~4 kHz. Boost for sparkle and air.' },
      ],
      create(ctx) {
        const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 250;
        const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1000; mid.Q.value = 0.8;
        const high = ctx.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 4000;
        low.connect(mid); mid.connect(high);
        return {
          input: low, output: high,
          params: { low: low.gain, mid: mid.gain, high: high.gain },
          set(p, v) {
            if (p === 'low') low.gain.value = v;
            if (p === 'mid') mid.gain.value = v;
            if (p === 'high') high.gain.value = v;
          },
        };
      },
    },
    {
      id: 'compressor', name: 'Compressor', icon: '][',
      desc: 'Evens out loud and quiet parts so the track sounds tight and punchy.',
      params: [
        { id: 'threshold', name: 'Threshold', min: -60, max: 0, def: -24, unit: 'dB',
          hint: 'Sounds louder than this get squeezed down.' },
        { id: 'ratio', name: 'Ratio', min: 1, max: 20, def: 4, unit: ':1',
          hint: 'How hard the squeeze is. 4:1 is musical, 20:1 is a brick wall.' },
        { id: 'attack', name: 'Attack', min: 0.001, max: 0.3, def: 0.01, unit: 's',
          hint: 'How fast it grabs. Slower attack lets drum punch through.' },
        { id: 'release', name: 'Release', min: 0.05, max: 1, def: 0.25, unit: 's',
          hint: 'How fast it lets go after a loud moment.' },
      ],
      create(ctx) {
        const c = ctx.createDynamicsCompressor();
        c.threshold.value = -24; c.ratio.value = 4; c.attack.value = 0.01; c.release.value = 0.25; c.knee.value = 10;
        return {
          input: c, output: c,
          params: { threshold: c.threshold, ratio: c.ratio, attack: c.attack, release: c.release },
          set(p, v) { if (c[p]) c[p].value = v; },
        };
      },
    },
    {
      id: 'chorus', name: 'Chorus', icon: '∿',
      desc: 'Doubles the sound with a slowly wobbling copy — instant width and shimmer.',
      params: [
        { id: 'rate', name: 'Rate', min: 0.1, max: 6, def: 1.2, unit: 'Hz',
          hint: 'Speed of the wobble.' },
        { id: 'depth', name: 'Depth', min: 0, max: 0.01, def: 0.0035, unit: '',
          hint: 'How far the copy drifts out of tune.' },
        { id: 'mix', name: 'Mix', min: 0, max: 1, def: 0.5, unit: '',
          hint: 'Dry vs chorused signal.' },
      ],
      create(ctx) {
        const delay = ctx.createDelay(0.05); delay.delayTime.value = 0.02;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 1.2;
        const lfoG = ctx.createGain(); lfoG.gain.value = 0.0035;
        lfo.connect(lfoG); lfoG.connect(delay.delayTime); lfo.start();
        const io = dryWet(ctx, delay);
        delay.connect(io.wet);
        io.wet.gain.value = 0.5;
        return {
          input: io.input, output: io.output,
          params: { rate: lfo.frequency, depth: lfoG.gain, mix: io.wet.gain },
          set(p, v) {
            if (p === 'rate') lfo.frequency.value = v;
            if (p === 'depth') lfoG.gain.value = v;
            if (p === 'mix') io.wet.gain.value = v;
          },
          dispose() { try { lfo.stop(); } catch (e) {} },
        };
      },
    },
  ];

  const byId = Object.fromEntries(defs.map(d => [d.id, d]));

  // ---------- FX chain container (used by mixer channels) ----------
  // Keeps input/output stable while effects are inserted/removed/reordered.
  function createChain(ctx) {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const slots = []; // { defId, fx, values }

    function rewire() {
      try { input.disconnect(); } catch (e) {}
      slots.forEach(s => { try { s.fx.output.disconnect(); } catch (e) {} });
      let node = input;
      for (const s of slots.filter(s => !s.bypassed)) {
        node.connect(s.fx.input);
        node = s.fx.output;
      }
      node.connect(output);
    }

    return {
      input, output, slots,
      add(defId) {
        const def = byId[defId];
        if (!def || slots.length >= 8) return null;
        const fx = def.create(ctx);
        const values = {};
        def.params.forEach(p => { values[p.id] = p.def; });
        const slot = { defId, fx, values, bypassed: false };
        slots.push(slot);
        rewire();
        return slot;
      },
      remove(index) {
        const [s] = slots.splice(index, 1);
        if (s && s.fx.dispose) s.fx.dispose();
        rewire();
      },
      setParam(index, param, value) {
        const s = slots[index];
        if (!s) return;
        s.values[param] = value;
        s.fx.set(param, value);
      },
      toggleBypass(index) {
        const s = slots[index];
        if (!s) return;
        s.bypassed = !s.bypassed;
        rewire();
      },
      serialize() {
        return slots.map(s => ({ defId: s.defId, values: { ...s.values }, bypassed: s.bypassed }));
      },
      load(data) {
        while (slots.length) this.remove(0);
        (data || []).forEach(d => {
          const slot = this.add(d.defId);
          if (!slot) return;
          Object.entries(d.values || {}).forEach(([p, v]) => {
            slot.values[p] = v; slot.fx.set(p, v);
          });
          if (d.bypassed) { slot.bypassed = true; }
        });
        rewire();
      },
    };
  }

  // normalized 0..1 <-> real parameter value (log-aware)
  function norm(paramDef, v) {
    if (paramDef.log) return Math.log(v / paramDef.min) / Math.log(paramDef.max / paramDef.min);
    return (v - paramDef.min) / (paramDef.max - paramDef.min);
  }
  function denorm(paramDef, n) {
    n = Math.max(0, Math.min(1, n));
    if (paramDef.log) return paramDef.min * Math.pow(paramDef.max / paramDef.min, n);
    return paramDef.min + n * (paramDef.max - paramDef.min);
  }

  return { defs, byId, createChain, norm, denorm };
})();
