/* ============================================================
   Trex Studio Producer — Demo Songs
   Three complete starter projects that load instantly, so the
   studio is never a blank canvas. Each one teaches a genre.
   ============================================================ */
'use strict';

const Demos = (() => {

  // "x" = hit, "X" = accent, "-" = rest
  function grid(str) {
    return str.replace(/\s/g, '').split('').map(ch => ({
      on: ch !== '-',
      vel: ch === 'X' ? 1 : ch === 'x' ? 0.8 : ch === 'o' ? 0.5 : 1,
    }));
  }

  const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  function n(name) { // "C5" -> midi 60
    const m = name.match(/^([A-G]#?)(\d)$/);
    return NOTE[m[1]] + (parseInt(m[2], 10) + 1) * 12;
  }
  function notes(list) { // [[key, start, len, vel?], ...]
    return list.map(([k, start, len, vel]) => ({ key: typeof k === 'string' ? n(k) : k, start, len, vel: vel || 0.85 }));
  }
  function chord(names, start, len, vel) {
    return names.map(k => [k, start, len, vel]);
  }

  function baseProject(name, bpm) {
    const p = State.blank();
    p.name = name;
    p.bpm = bpm;
    p.channels = [];
    p.patterns = [];
    return p;
  }
  function addCh(p, instrumentId, mixerTrack, name) {
    const ch = State.newChannel(instrumentId, mixerTrack);
    if (name) ch.name = name;
    p.channels.push(ch);
    return ch;
  }
  function addPat(p, nm, length) {
    const pat = State.newPattern(nm, length);
    p.patterns.push(pat);
    return pat;
  }

  // ================= Demo 1: First Beat (house, 124) =================
  function firstBeat() {
    const p = baseProject('First Beat (House)', 124);
    const kick = addCh(p, 'kickPunch', 1);
    const clap = addCh(p, 'clap', 2);
    const hat = addCh(p, 'hatClosed', 3);
    const oh = addCh(p, 'hatOpen', 3);
    const bass = addCh(p, 'pluckBass', 4);
    const keys = addCh(p, 'ePiano', 5);

    const beat = addPat(p, 'Main Beat', 16);
    beat.steps[kick.id] = grid('X---X---X---X---');
    beat.steps[clap.id] = grid('----x-------x---');
    beat.steps[hat.id]  = grid('x-x-x-x-x-x-x-x-');
    beat.steps[oh.id]   = grid('--x---x---x---x-');
    beat.notes[bass.id] = notes([['F2', 0, 3], ['F2', 4, 2], ['G#2', 6, 2], ['A#2', 8, 3], ['F2', 12, 2], ['C3', 14, 2]]);
    beat.notes[keys.id] = notes([
      ...chord(['F3', 'G#3', 'C4'], 0, 4, 0.6),
      ...chord(['F3', 'G#3', 'C4'], 6, 2, 0.5),
      ...chord(['D#3', 'G3', 'A#3'], 8, 4, 0.6),
      ...chord(['C#3', 'F3', 'G#3'], 12, 4, 0.6),
    ]);

    const intro = addPat(p, 'Intro (drums only)', 16);
    intro.steps[kick.id] = grid('X---X---X---X---');
    intro.steps[hat.id]  = grid('x-x-x-x-x-x-x-x-');

    p.playlist = [
      { id: 'c1', type: 'pattern', patternId: intro.id, track: 0, start: 0, length: 2 },
      { id: 'c2', type: 'pattern', patternId: beat.id, track: 0, start: 2, length: 4 },
      { id: 'c3', type: 'pattern', patternId: intro.id, track: 0, start: 6, length: 1 },
      { id: 'c4', type: 'pattern', patternId: beat.id, track: 0, start: 7, length: 4 },
    ];
    p.mixer[2].fx = [{ defId: 'reverb', values: { size: 1.2, mix: 0.25 }, bypassed: false }];
    p.mixer[5].fx = [{ defId: 'chorus', values: { rate: 1.2, depth: 0.0035, mix: 0.4 }, bypassed: false }];
    return p;
  }

  // ================= Demo 2: Trap Starter (140) =================
  function trapStarter() {
    const p = baseProject('Trap Starter', 140);
    const kick = addCh(p, 'kick808', 1);
    const snare = addCh(p, 'snare', 2);
    const hat = addCh(p, 'hatClosed', 3);
    const oh = addCh(p, 'hatOpen', 3);
    const bell = addCh(p, 'bell', 5);
    const bass = addCh(p, 'subBass', 4);

    const a = addPat(p, 'Trap A', 32);
    a.steps[kick.id]  = grid('X------x--x-----X------x--------');
    a.steps[snare.id] = grid('--------X---------------X-------');
    a.steps[hat.id]   = grid('x-x-x-x-x-x-xxx-x-x-x-x-x-xxxxxx');
    a.steps[oh.id]    = grid('------x---------------x---------');
    a.notes[bell.id] = notes([
      ['C5', 0, 2, 0.7], ['D#5', 2, 2, 0.6], ['G5', 4, 4, 0.7], ['F5', 10, 2, 0.6],
      ['D#5', 12, 4, 0.7], ['C5', 20, 4, 0.7], ['G#4', 26, 4, 0.6],
    ]);
    a.notes[bass.id] = notes([['C2', 0, 6], ['C2', 7, 1], ['G#1', 16, 6], ['A#1', 24, 6]]);

    const b = addPat(p, 'Trap B (no bell)', 32);
    b.steps[kick.id] = JSON.parse(JSON.stringify(a.steps[kick.id]));
    b.steps[snare.id] = JSON.parse(JSON.stringify(a.steps[snare.id]));
    b.steps[hat.id] = JSON.parse(JSON.stringify(a.steps[hat.id]));
    b.notes[bass.id] = JSON.parse(JSON.stringify(a.notes[bass.id]));

    p.playlist = [
      { id: 't1', type: 'pattern', patternId: b.id, track: 0, start: 0, length: 2 },
      { id: 't2', type: 'pattern', patternId: a.id, track: 0, start: 2, length: 4 },
      { id: 't3', type: 'pattern', patternId: b.id, track: 0, start: 6, length: 2 },
      { id: 't4', type: 'pattern', patternId: a.id, track: 0, start: 8, length: 4 },
    ];
    p.swing = 0.12;
    p.mixer[5].fx = [
      { defId: 'delay', values: { time: 0.32, feedback: 0.45, mix: 0.35 }, bypassed: false },
      { defId: 'reverb', values: { size: 2.2, mix: 0.3 }, bypassed: false },
    ];
    p.mixer[1].fx = [{ defId: 'distortion', values: { drive: 12, tone: 3500, level: 0.8 }, bypassed: false }];
    return p;
  }

  // ================= Demo 3: Lo-fi Chill (85) =================
  function lofiChill() {
    const p = baseProject('Lo-fi Chill', 85);
    const kick = addCh(p, 'kickPunch', 1);
    const snare = addCh(p, 'rimshot', 2);
    const hat = addCh(p, 'shaker', 3);
    const keys = addCh(p, 'ePiano', 5);
    const bass = addCh(p, 'subBass', 4);
    const pad = addCh(p, 'pad', 6);

    const a = addPat(p, 'Chill Loop', 32);
    a.steps[kick.id]  = grid('x------x--x-----x---------x-----');
    a.steps[snare.id] = grid('----x-------x-------x-------x---');
    a.steps[hat.id]   = grid('x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-');
    a.notes[keys.id] = notes([
      ...chord(['D3', 'F3', 'A3', 'C4'], 0, 6, 0.55),
      ...chord(['C3', 'E3', 'G3', 'B3'], 8, 6, 0.5),
      ...chord(['A#2', 'D3', 'F3', 'A3'], 16, 6, 0.55),
      ...chord(['A2', 'C#3', 'E3', 'G3'], 24, 7, 0.5),
    ]);
    a.notes[bass.id] = notes([['D2', 0, 6], ['C2', 8, 6], ['A#1', 16, 6], ['A1', 24, 7]]);
    a.notes[pad.id] = notes([...chord(['D4', 'A4'], 0, 16, 0.3), ...chord(['A#3', 'F4'], 16, 16, 0.3)]);

    p.playlist = [
      { id: 'l1', type: 'pattern', patternId: a.id, track: 0, start: 0, length: 8 },
    ];
    p.swing = 0.35;
    p.mixer[5].fx = [
      { defId: 'filter', values: { type: 'lowpass', cutoff: 3200, q: 0.8 }, bypassed: false },
      { defId: 'chorus', values: { rate: 0.8, depth: 0.005, mix: 0.5 }, bypassed: false },
    ];
    p.mixer[0].fx = [{ defId: 'compressor', values: { threshold: -18, ratio: 3, attack: 0.02, release: 0.3 }, bypassed: false }];
    p.mixer[6].fx = [{ defId: 'reverb', values: { size: 3, mix: 0.5 }, bypassed: false }];
    return p;
  }

  const list = [
    { id: 'firstBeat', name: '🏠 First Beat (House)', make: firstBeat,
      desc: 'A friendly four-on-the-floor house groove — the perfect first project. Press Space!' },
    { id: 'trap', name: '🔥 Trap Starter', make: trapStarter,
      desc: '140 BPM trap with rolling hi-hats, an 808, and a bell melody with echo.' },
    { id: 'lofi', name: '🌙 Lo-fi Chill', make: lofiChill,
      desc: 'Laid-back jazzy chords with swing and a warm filtered mix. Homework music.' },
  ];

  function load(demoId) {
    const d = list.find(x => x.id === demoId);
    if (!d) return;
    State.snapshot();
    State.project = d.make();
    App.refreshAll();
    App.toast('Loaded "' + State.project.name + '" — press Space to play!');
  }

  return { list, load };
})();
