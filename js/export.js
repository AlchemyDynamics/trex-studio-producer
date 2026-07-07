/* ============================================================
   Trex Studio Producer — WAV Export
   Rebuilds the full project in an OfflineAudioContext (mixer
   chains, effects, every note and audio clip scheduled upfront)
   and renders to a 16-bit WAV, faster than real time.
   ============================================================ */
'use strict';

const Exporter = (() => {

  function secondsPerStep() { return 60 / State.project.bpm / 4; }
  function swingOffset(step, sp) { return (step % 2 === 1) ? State.project.swing * sp * 0.5 : 0; }

  function buildOfflineMixer(octx) {
    // master bus
    const masterGain = octx.createGain();
    masterGain.gain.value = 0.8;
    const limiter = octx.createDynamicsCompressor();
    limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20;
    limiter.attack.value = 0.002; limiter.release.value = 0.1;
    masterGain.connect(limiter);
    limiter.connect(octx.destination);

    const cfg = State.project.mixer;
    const strips = [];

    // master strip (0)
    const mChain = Effects.createChain(octx);
    mChain.load(cfg[0].fx);
    const mFader = octx.createGain();
    mFader.gain.value = cfg[0].mute ? 0 : cfg[0].volume;
    mChain.output.connect(mFader);
    mFader.connect(masterGain);
    strips[0] = { input: mChain.input, fader: mFader, chain: mChain, audible: !cfg[0].mute };

    // shared send buses (mirror of Mixer.buildBuses)
    const conv = octx.createConvolver();
    conv.buffer = Effects.makeImpulse(octx, 2.4, 2.2);
    const rvGain = octx.createGain(); rvGain.gain.value = 1;
    conv.connect(rvGain); rvGain.connect(strips[0].input);
    const dl = octx.createDelay(3);
    dl.delayTime.value = 0.75 * (60 / (State.project.bpm || 130));
    const dfb = octx.createGain(); dfb.gain.value = 0.42;
    const dhp = octx.createBiquadFilter(); dhp.type = 'highpass'; dhp.frequency.value = 250;
    const dlGain = octx.createGain(); dlGain.gain.value = 0.9;
    dl.connect(dhp); dhp.connect(dfb); dfb.connect(dl);
    dhp.connect(dlGain); dlGain.connect(strips[0].input);

    const anySolo = cfg.some(t => t.solo && t.id !== 0);
    for (let i = 1; i < cfg.length; i++) {
      const chain = Effects.createChain(octx);
      chain.load(cfg[i].fx);
      const fader = octx.createGain();
      const audible = !cfg[i].mute && (!anySolo || cfg[i].solo);
      fader.gain.value = audible ? cfg[i].volume : 0;
      const panner = octx.createStereoPanner();
      panner.pan.value = cfg[i].pan;
      chain.output.connect(fader);
      fader.connect(panner);
      panner.connect(strips[0].input);
      if (audible && (cfg[i].sendReverb || 0) > 0) {
        const sr = octx.createGain(); sr.gain.value = cfg[i].sendReverb;
        panner.connect(sr); sr.connect(conv);
      }
      if (audible && (cfg[i].sendDelay || 0) > 0) {
        const sd = octx.createGain(); sd.gain.value = cfg[i].sendDelay;
        panner.connect(sd); sd.connect(dl);
      }
      strips[i] = { input: chain.input, fader, panner, chain, audible };
    }
    return { strips, masterGain };
  }

  function playNoteOffline(octx, strips, channel, { time, key, velocity, durationSteps }) {
    if (channel.mute) return;
    const strip = strips[channel.mixerTrack] || strips[1] || strips[0];
    const g = octx.createGain();
    g.gain.value = channel.volume;
    const p = octx.createStereoPanner();
    p.pan.value = channel.pan;
    g.connect(p); p.connect(strip.input);

    const finalKey = key + (channel.pitch || 0);
    const duration = durationSteps * secondsPerStep();

    if (channel.instrumentId.startsWith('smp:') || channel.instrumentId.startsWith('usr:')) {
      const s = Sampler.get(channel.instrumentId);
      const buffer = s ? s.buffer : State.samples[channel.instrumentId];
      if (!buffer) return;
      const src = octx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = Math.pow(2, (finalKey - 60) / 12);
      const vg = octx.createGain(); vg.gain.value = velocity;
      src.connect(vg); vg.connect(g);
      src.start(time);
    } else {
      const inst = Instruments.byId[channel.instrumentId];
      if (!inst) return;
      inst.play(octx, g, { time, velocity, freq: Sequencer.keyToFreq(finalKey), duration });
    }
  }

  function schedulePattern(octx, strips, pattern, localStep, when) {
    for (const channel of State.project.channels) {
      const steps = pattern.steps[channel.id];
      if (steps && steps[localStep] && steps[localStep].on) {
        playNoteOffline(octx, strips, channel, { time: when, key: 60, velocity: steps[localStep].vel, durationSteps: 2 });
      }
      const notes = pattern.notes[channel.id];
      if (notes) for (const n of notes) {
        if (n.start === localStep) {
          playNoteOffline(octx, strips, channel, { time: when, key: n.key, velocity: n.vel, durationSteps: n.len });
        }
      }
    }
  }

  async function render() {
    Engine.ensureContext();
    const sp = secondsPerStep();
    const isSong = State.project.playlist.length > 0 || State.project.audioClips.length > 0;
    // song → full arrangement; no arrangement → active pattern twice
    const totalSteps = isSong ? State.songLengthSteps() : State.activePattern().length * 2;
    const tail = 2.5;
    const lengthSec = totalSteps * sp + tail;
    const rate = 44100;
    const octx = new OfflineAudioContext(2, Math.ceil(lengthSec * rate), rate);

    const offline = buildOfflineMixer(octx);
    const strips = offline.strips;
    const startPad = 0.05;

    for (let tick = 0; tick < totalSteps; tick++) {
      const when = startPad + tick * sp + swingOffset(tick, sp);
      if (isSong) {
        Automation.applyOffline(offline, tick, when);
        for (const clip of State.project.playlist) {
          const cs = clip.start * 16, ce = (clip.start + clip.length) * 16;
          if (tick < cs || tick >= ce) continue;
          const pattern = State.project.patterns.find(pt => pt.id === clip.patternId);
          if (pattern) schedulePattern(octx, strips, pattern, (tick - cs) % pattern.length, when);
        }
        for (const clip of State.project.audioClips) {
          if (tick === clip.start * 16) {
            const buffer = State.samples[clip.sampleId];
            if (!buffer) continue;
            const src = octx.createBufferSource();
            src.buffer = buffer;
            const g = octx.createGain();
            g.gain.value = clip.gain != null ? clip.gain : 0.9;
            src.connect(g);
            g.connect((strips[clip.mixerTrack || 0]).input);
            src.start(when);
            const clipSec = clip.lengthSteps * sp;
            if (clipSec > 0 && clipSec < buffer.duration) src.stop(when + clipSec);
          }
        }
      } else {
        const pattern = State.activePattern();
        schedulePattern(octx, strips, pattern, tick % pattern.length, when);
      }
    }

    App.toast('Rendering ' + (isSong ? 'song' : 'pattern') + '…');
    return octx.startRendering();
  }

  async function exportWav() {
    const buffer = await render();
    const blob = Engine.encodeWav(buffer);
    const name = (State.project.name || 'trex-song').replace(/[^a-z0-9-_]/gi, '_') + '.wav';
    App.download(blob, name);
    App.toast('✔ Exported ' + name + ' (' + (blob.size / 1048576).toFixed(1) + ' MB)');
  }

  // small shareable file: play the rendered buffer (silently) into a MediaRecorder
  async function exportCompressed() {
    const buffer = await render();
    App.toast('Encoding compressed audio — takes as long as the song plays…');
    const ctx2 = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx2.state === 'suspended') { try { await ctx2.resume(); } catch (e) {} } // a suspended clock would never fire src.onended
    const src = ctx2.createBufferSource();
    src.buffer = buffer;
    const msd = ctx2.createMediaStreamDestination();
    src.connect(msd); // not connected to speakers — encodes silently
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
      : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
    const rec = new MediaRecorder(msd.stream, mime ? { mimeType: mime, audioBitsPerSecond: 160000 } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise(res => { rec.onstop = res; });
    rec.start();
    src.start();
    src.onended = () => { try { rec.stop(); } catch (e) {} };
    await done;
    ctx2.close();
    const ext = (mime.includes('mp4')) ? '.m4a' : '.webm';
    const blob = new Blob(chunks, { type: mime || 'audio/webm' });
    const name = (State.project.name || 'trex-song').replace(/[^a-z0-9-_]/gi, '_') + ext;
    App.download(blob, name);
    App.toast('✔ Exported ' + name + ' (' + (blob.size / 1048576).toFixed(1) + ' MB) — small enough to text to your friends');
  }

  function init() {
    document.getElementById('btn-export').onclick = () => {
      App.choose({
        title: '⬇ Export your song',
        items: [
          { label: 'WAV — best quality', desc: 'Uncompressed studio quality. Big file. Renders in seconds.', color: '#35d0a0' },
          { label: 'Compressed — small & shareable', desc: 'Opus-encoded audio (.webm/.m4a) around a tenth the size. Encodes in real time, so it takes as long as the song.', color: '#5aa2ff' },
        ],
        onPick: (i) => {
          (i === 0 ? exportWav() : exportCompressed()).catch(err => App.toast('Export failed: ' + err.message));
        },
      });
    };
  }

  return { init, render, exportWav, exportCompressed };
})();
