/* ============================================================
   Trex Studio Producer — Sampler
   Loads real vintage drum-machine one-shots (CC0/permissive,
   served by danigb.github.io/samples) and user samples, and
   plays AudioBuffers as instruments. Fully optional: if offline,
   the built-in synthesized instruments cover everything.
   ============================================================ */
'use strict';

const Sampler = (() => {
  const BASE = 'https://danigb.github.io/samples/drum-machines/';

  // kit id -> { name, desc, sounds: {folder -> displayName} }
  const KITS = {
    'TR-808': {
      name: 'TR-808 (1980)',
      desc: 'The most famous drum machine ever made — the sound of hip-hop, trap and electro. Real samples of the Roland TR-808.',
      picks: { kick: 'bd0050', snare: 'sd0050', 'hihat-close': 'ch', 'hihat-open': 'oh50', clap: 'cp', cowbell: 'cb', rimshot: 'rs', 'mid-tom': 'mt50', cymbal: 'cy0050' },
      names: { kick: 'Kick', snare: 'Snare', 'hihat-close': 'Closed Hat', 'hihat-open': 'Open Hat', clap: 'Clap', cowbell: 'Cowbell', rimshot: 'Rimshot', 'mid-tom': 'Tom', cymbal: 'Cymbal' },
    },
    'LM-2': {
      name: 'LinnDrum (1982)',
      desc: 'The LinnDrum powered countless 80s hits — punchy sampled acoustic drums.',
      picks: null, // discover from dm.json
    },
    'Roland-CR-8000': {
      name: 'CR-8000 (1981)',
      desc: 'Warm analog Roland rhythm machine — softer cousin of the 808.',
      picks: null,
    },
    'Casio-RZ1': {
      name: 'Casio RZ-1 (1986)',
      desc: 'Crunchy 8-bit sampled drums with tons of lo-fi character.',
      picks: null,
    },
    'MFB-512': {
      name: 'MFB-512 (1980s)',
      desc: 'Rare German analog drum machine — gritty and raw.',
      picks: null,
    },
  };

  const loaded = {};   // 'smp:KIT/folder' -> { id, name, type:'drum', color, buffer, desc }

  async function fetchKitManifest(kitId) {
    const res = await fetch(BASE + kitId + '/dm.json');
    if (!res.ok) throw new Error('Kit manifest not found: ' + kitId);
    return res.json();
  }

  // Group manifest sample paths ("kick/bd0050") by folder.
  function groupByFolder(manifest) {
    const groups = {};
    for (const s of manifest.samples || []) {
      const [folder, file] = s.split('/');
      if (!file) continue;
      (groups[folder] = groups[folder] || []).push(file);
    }
    return groups;
  }

  async function decode(url) {
    const ctx = Engine.ensureContext();
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed ' + url);
    const arr = await res.arrayBuffer();
    return ctx.decodeAudioData(arr);
  }

  // Load a kit; returns array of instrument-like sound objects.
  async function loadKit(kitId) {
    const kit = KITS[kitId];
    if (!kit) throw new Error('Unknown kit ' + kitId);
    const manifest = await fetchKitManifest(kitId);
    const groups = groupByFolder(manifest);
    const jobs = [];
    const folders = kit.picks ? Object.keys(kit.picks) : Object.keys(groups);
    for (const folder of folders) {
      const files = groups[folder];
      if (!files || !files.length) continue;
      const file = (kit.picks && kit.picks[folder] && files.includes(kit.picks[folder]))
        ? kit.picks[folder] : files[Math.floor(files.length / 2)];
      const id = 'smp:' + kitId + '/' + folder;
      if (loaded[id]) continue;
      const url = BASE + kitId + '/' + folder + '/' + file + '.ogg';
      jobs.push(decode(url).then(buffer => {
        loaded[id] = {
          id, buffer, type: 'drum', color: '#d4a24a',
          name: ((kit.names && kit.names[folder]) || prettify(folder)) + ' · ' + kitId.replace('Roland-', '').replace('Casio-', ''),
          desc: kit.desc,
        };
      }).catch(() => null));
    }
    await Promise.all(jobs);
    return Object.values(loaded).filter(s => s.id.startsWith('smp:' + kitId + '/'));
  }

  function prettify(folder) {
    return folder.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // ---- user samples (recordings / imported files) ----
  let userCount = 0;
  function addUserSample(name, buffer) {
    const id = 'usr:' + (++userCount) + ':' + name.replace(/[^a-z0-9]/gi, '_');
    State.samples[id] = buffer;
    loaded[id] = { id, buffer, type: 'drum', color: '#ff4d5e', name, desc: 'Your own recorded or imported sample.' };
    return id;
  }

  // ---- playback ----
  function play(soundId, dest, { time, velocity = 1, rate = 1 }) {
    const s = loaded[soundId] || (State.samples[soundId] && { buffer: State.samples[soundId] });
    if (!s || !s.buffer) return;
    const ctx = Engine.ctx;
    const src = ctx.createBufferSource();
    src.buffer = s.buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = velocity;
    src.connect(g); g.connect(dest);
    src.start(time);
    return src;
  }

  function get(soundId) { return loaded[soundId]; }
  function has(soundId) { return !!loaded[soundId]; }

  return { KITS, loadKit, addUserSample, play, get, has, loaded };
})();
