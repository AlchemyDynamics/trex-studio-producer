/* ============================================================
   Trex Studio Producer — AI Co-Producer
   Chat panel backed by the Claude API (key stays in this browser,
   sent directly to Anthropic — no middle server). The model gets
   the current project state and returns structured edit actions
   that we execute on the project: beats, notes, mixer, effects.
   ============================================================ */
'use strict';

const AIAssist = (() => {
  const MODEL = 'claude-opus-4-8';
  const API_URL = 'https://api.anthropic.com/v1/messages';

  const history = []; // chat turns for context

  // ---------- structured output schema ----------
  const ACTION_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['message', 'actions'],
    properties: {
      message: { type: 'string', description: 'Friendly reply to the producer explaining what you did or answering their question.' },
      actions: {
        type: 'array',
        description: 'Edits to apply to the project, executed in order.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type'],
          properties: {
            type: {
              type: 'string',
              enum: ['set_bpm', 'set_swing', 'add_channel', 'remove_channel', 'set_steps',
                'add_notes', 'clear_notes', 'clear_steps', 'add_effect', 'set_mixer_track',
                'add_pattern', 'place_clip', 'clear_playlist', 'set_channel'],
            },
            bpm: { type: 'number' },
            swing: { type: 'number', description: '0 to 1' },
            instrumentId: { type: 'string', description: 'One of the available instrument ids' },
            channelName: { type: 'string', description: 'Name of an existing channel (or the new channel for add_channel)' },
            mixerTrack: { type: 'integer', description: '1-8' },
            steps: { type: 'string', description: 'Step pattern like "x---x---x---x---", one char per 16th step: x=hit, X=accent, -=rest. Length must equal pattern length.' },
            notes: {
              type: 'array',
              description: 'Piano roll notes for add_notes',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['key', 'start', 'len'],
                properties: {
                  key: { type: 'integer', description: 'MIDI note number, 60 = middle C' },
                  start: { type: 'integer', description: 'start step (16ths from pattern start)' },
                  len: { type: 'integer', description: 'length in 16th steps' },
                  vel: { type: 'number', description: '0.1-1 velocity' },
                },
              },
            },
            patternName: { type: 'string' },
            patternLength: { type: 'integer', enum: [16, 32, 64] },
            effectId: { type: 'string', enum: ['delay', 'distortion', 'filter', 'reverb', 'eq3', 'compressor', 'chorus'] },
            values: { type: 'object', additionalProperties: true, description: 'Effect parameter values, e.g. {"mix":0.3}' },
            volume: { type: 'number', description: '0-1' },
            pan: { type: 'number', description: '-1 to 1' },
            pitch: { type: 'integer', description: 'semitone offset -24..24' },
            track: { type: 'integer', description: 'playlist track 0-7' },
            startBar: { type: 'integer' },
            lengthBars: { type: 'integer' },
          },
        },
      },
    },
  };

  function systemPrompt() {
    const p = State.project;
    const summary = {
      name: p.name, bpm: p.bpm, swing: p.swing,
      channels: p.channels.map(c => ({ name: c.name, instrumentId: c.instrumentId, mixerTrack: c.mixerTrack, volume: c.volume, pitch: c.pitch })),
      patterns: p.patterns.map((pt, i) => ({
        index: i, name: pt.name, length: pt.length, active: i === p.activePattern,
        steps: Object.fromEntries(p.channels.filter(c => pt.steps[c.id]).map(c =>
          [c.name, pt.steps[c.id].map(s => s.on ? (s.vel > 0.9 ? 'X' : 'x') : '-').join('')])),
        noteCounts: Object.fromEntries(p.channels.filter(c => (pt.notes[c.id] || []).length).map(c =>
          [c.name, pt.notes[c.id].length])),
      })),
      playlist: p.playlist.map(c => ({ pattern: (p.patterns.find(x => x.id === c.patternId) || {}).name, track: c.track, startBar: c.start, lengthBars: c.length })),
      mixer: p.mixer.map(t => ({ id: t.id, name: t.name, volume: t.volume, fx: t.fx.map(f => f.defId) })),
    };
    return `You are the AI co-producer inside Trex Studio Producer, a browser music studio used by a 14-year-old learning music production. Be encouraging, concise and fun — explain music ideas simply (what a four-on-the-floor is, why swing grooves, etc).

You edit the project by returning actions. Edits apply to the ACTIVE pattern unless you create a new one first (add_pattern makes the new pattern active).

AVAILABLE INSTRUMENT IDS (for add_channel):
Drums: ${Instruments.list.filter(i => i.type === 'drum').map(i => i.id).join(', ')}
Melodic: ${Instruments.list.filter(i => i.type === 'melodic').map(i => i.id).join(', ')}

MUSIC TIPS: kick on steps 1,5,9,13 = house; trap = sparse 808 kicks + snare on 9/25 (32-step) + fast hats; MIDI 60 = C5 here. Keep bass below MIDI 48. Use set_steps for drums, add_notes for melodies/chords/basslines. Step strings must be exactly the pattern length. Velocities: x=0.8, X=1.

CURRENT PROJECT STATE:
${JSON.stringify(summary)}`;
  }

  // ---------- action executor ----------
  function findChannel(name) {
    return State.project.channels.find(c => c.name.toLowerCase() === (name || '').toLowerCase())
      || State.project.channels.find(c => c.name.toLowerCase().includes((name || '').toLowerCase()));
  }

  function execute(action) {
    const p = State.project;
    switch (action.type) {
      case 'set_bpm':
        p.bpm = Math.max(30, Math.min(300, action.bpm || 120));
        Engine.setBpm(p.bpm);
        return `Tempo → ${p.bpm} BPM`;
      case 'set_swing':
        p.swing = Math.max(0, Math.min(1, action.swing || 0));
        Engine.setSwing(p.swing);
        return `Swing → ${Math.round(p.swing * 100)}%`;
      case 'add_channel': {
        if (!Instruments.byId[action.instrumentId]) return `⚠ unknown instrument ${action.instrumentId}`;
        const ch = State.newChannel(action.instrumentId, action.mixerTrack || 1);
        if (action.channelName) ch.name = action.channelName;
        p.channels.push(ch);
        return `Added channel "${ch.name}"`;
      }
      case 'remove_channel': {
        const ch = findChannel(action.channelName);
        if (!ch) return `⚠ channel not found: ${action.channelName}`;
        p.channels = p.channels.filter(c => c !== ch);
        return `Removed "${ch.name}"`;
      }
      case 'set_channel': {
        const ch = findChannel(action.channelName);
        if (!ch) return `⚠ channel not found: ${action.channelName}`;
        if (action.volume != null) ch.volume = Math.max(0, Math.min(1, action.volume));
        if (action.pan != null) ch.pan = Math.max(-1, Math.min(1, action.pan));
        if (action.pitch != null) ch.pitch = Math.max(-24, Math.min(24, action.pitch));
        if (action.mixerTrack != null) ch.mixerTrack = Math.max(1, Math.min(8, action.mixerTrack));
        return `Updated "${ch.name}"`;
      }
      case 'set_steps': {
        const ch = findChannel(action.channelName);
        if (!ch) return `⚠ channel not found: ${action.channelName}`;
        const pat = State.activePattern();
        const arr = State.stepsFor(pat, ch.id);
        const str = (action.steps || '').replace(/\s/g, '');
        for (let i = 0; i < pat.length; i++) {
          const c = str[i % str.length] || '-';
          arr[i] = { on: c !== '-', vel: c === 'X' ? 1 : 0.8 };
        }
        return `Beat set on "${ch.name}"`;
      }
      case 'clear_steps': {
        const ch = findChannel(action.channelName);
        if (!ch) return `⚠ channel not found`;
        State.activePattern().steps[ch.id] = null;
        State.stepsFor(State.activePattern(), ch.id);
        return `Cleared steps on "${ch.name}"`;
      }
      case 'add_notes': {
        const ch = findChannel(action.channelName);
        if (!ch) return `⚠ channel not found: ${action.channelName}`;
        const pat = State.activePattern();
        const list = State.notesFor(pat, ch.id);
        (action.notes || []).forEach(n => {
          if (n.start >= 0 && n.start < pat.length) {
            list.push({ key: n.key, start: n.start, len: Math.max(1, Math.min(n.len, pat.length - n.start)), vel: n.vel || 0.85 });
          }
        });
        return `Added ${(action.notes || []).length} notes to "${ch.name}"`;
      }
      case 'clear_notes': {
        const ch = findChannel(action.channelName);
        if (!ch) return `⚠ channel not found`;
        State.activePattern().notes[ch.id] = [];
        return `Cleared notes on "${ch.name}"`;
      }
      case 'add_effect': {
        const t = Math.max(0, Math.min(8, action.mixerTrack != null ? action.mixerTrack : 1));
        const slot = Mixer.addFx(t, action.effectId);
        if (!slot) return `⚠ could not add ${action.effectId}`;
        Object.entries(action.values || {}).forEach(([k, v]) => {
          const idx = Mixer.strips[t].chain.slots.indexOf(slot);
          Mixer.setFxParam(t, idx, k, v);
        });
        return `Added ${action.effectId} to ${State.project.mixer[t].name}`;
      }
      case 'set_mixer_track': {
        const t = State.project.mixer[action.mixerTrack != null ? action.mixerTrack : 1];
        if (!t) return '⚠ bad mixer track';
        if (action.volume != null) t.volume = Math.max(0, Math.min(1, action.volume));
        if (action.pan != null) t.pan = Math.max(-1, Math.min(1, action.pan));
        Mixer.applyAll();
        return `Mixer "${t.name}" updated`;
      }
      case 'add_pattern': {
        const pat = State.newPattern(action.patternName || ('Pattern ' + (p.patterns.length + 1)), action.patternLength || 16);
        p.patterns.push(pat);
        p.activePattern = p.patterns.length - 1;
        return `New pattern "${pat.name}" (now active)`;
      }
      case 'place_clip': {
        const pat = p.patterns.find(x => x.name.toLowerCase() === (action.patternName || '').toLowerCase()) || State.activePattern();
        p.playlist.push({
          id: 'clip' + Math.random().toString(36).slice(2, 9),
          type: 'pattern', patternId: pat.id,
          track: Math.max(0, Math.min(p.playlistTracks - 1, action.track || 0)),
          start: Math.max(0, action.startBar || 0),
          length: Math.max(1, action.lengthBars || 1),
        });
        return `Placed "${pat.name}" at bar ${(action.startBar || 0) + 1}`;
      }
      case 'clear_playlist':
        p.playlist = [];
        return 'Cleared arrangement';
      default:
        return `⚠ unknown action ${action.type}`;
    }
  }

  // ---------- API call ----------
  async function send(userText) {
    const key = document.getElementById('ai-key').value.trim();
    if (!key) {
      addMsg('bot', 'I need a Claude API key to work. Ask your dad to add one below 👇 — it stays in this browser only. (Get one at console.anthropic.com)');
      return;
    }
    addMsg('user', userText);
    history.push({ role: 'user', content: userText });
    const thinking = addMsg('bot', '🎧 Cooking…');

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 8000,
          system: systemPrompt(),
          messages: history.slice(-12),
          output_config: { format: { type: 'json_schema', schema: ACTION_SCHEMA } },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err.error && err.error.message) || ('HTTP ' + res.status));
      }
      const data = await res.json();
      if (data.stop_reason === 'refusal') throw new Error('The AI declined that request.');
      const text = (data.content.find(b => b.type === 'text') || {}).text || '{}';
      const result = JSON.parse(text);

      history.push({ role: 'assistant', content: text });
      thinking.remove();

      if (result.actions && result.actions.length) {
        State.snapshot();
        const log = result.actions.map(execute);
        addMsg('action', log.join('\n'));
        App.refreshAll();
      }
      addMsg('bot', result.message || 'Done!');
    } catch (err) {
      thinking.remove();
      addMsg('bot', '⚠ ' + err.message);
    }
  }

  // ---------- UI ----------
  function addMsg(kind, text) {
    const el = document.createElement('div');
    el.className = 'ai-msg ' + kind;
    el.textContent = text;
    const log = document.getElementById('ai-log');
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function toggle(open) {
    const panel = document.getElementById('ai-panel');
    const willOpen = open != null ? open : !panel.classList.contains('open');
    panel.classList.toggle('open', willOpen);
    document.getElementById('btn-ai').classList.toggle('active', willOpen);
    if (willOpen && !document.getElementById('ai-log').children.length) {
      addMsg('bot', "Hey! I'm your AI co-producer 🦖🎵 Tell me what you want and I'll build it right into your project. Try:\n• \"make a trap beat at 140\"\n• \"add a chill piano melody in A minor\"\n• \"put echo on the bell and turn up the bass\"\n• \"arrange my patterns into a full song\"");
    }
  }

  function init() {
    const savedKey = localStorage.getItem('trex-ai-key');
    if (savedKey) document.getElementById('ai-key').value = savedKey;
    document.getElementById('ai-key').addEventListener('change', e => {
      localStorage.setItem('trex-ai-key', e.target.value.trim());
      App.toast('API key saved in this browser');
    });
    document.getElementById('btn-ai').onclick = () => toggle();
    document.getElementById('ai-close').onclick = () => toggle(false);
    const input = document.getElementById('ai-input');
    const submit = () => {
      const t = input.value.trim();
      if (!t) return;
      input.value = '';
      send(t);
    };
    document.getElementById('ai-send').onclick = submit;
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    });
  }

  return { init, toggle };
})();
