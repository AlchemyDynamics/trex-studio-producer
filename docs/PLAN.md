# Trex Studio Producer — Development Plan

## Vision
A complete, legal, browser-based music production studio inspired by FL Studio's pattern-based workflow — built for a 14-year-old to learn real music production, with professional features under a friendly, self-teaching UI. Static HTML/CSS/JS, no build step, no install, deployed on GitHub Pages.

## Architecture

```
index.html                 app shell (splash, toolbar, browser, 5 views, hint bar, AI panel)
css/style.css              original dark studio theme (Trex orange/mint on near-black)
js/
  audio-engine.js          AudioContext, lookahead scheduler, transport, scrubbing, metronome, WAV encoder
  instruments.js           24 synthesized instruments (11 drums, 13 melodic) — zero sample downloads
  effects.js               7 effects (delay, distortion, filter, reverb, EQ, compressor, chorus) + FX chains
  state.js                 single serializable project object; undo/redo; localStorage persistence
  mixer.js                 runtime channel strips: FX chain → fader → pan → analyser → master
  sampler.js               CC0 vintage drum-machine kits (live-fetched) + user samples
  sequencer.js             "what plays on this step" for pattern & song modes; note voicing
  ui-rack.js               Channel Rack: LED mute, vol/pan knobs, 16th-step grid, playhead
  ui-pianoroll.js          canvas piano roll: draw/move/resize/delete notes, musical typing
  ui-playlist.js           canvas arrangement timeline: paint pattern clips, audio clips, ruler scrubbing
  ui-mixer.js              9 strips (Master + 8 inserts) with meters, faders, mute/solo, FX rack panel
  recorder.js              mic/interface capture, device picker, live waveform, takes → playlist/WAV
  hints.js                 hint bar + Help-mode rich tooltips (every control has data-hint)
  export.js                OfflineAudioContext full-song render → 16-bit WAV
  demos.js                 3 complete demo songs (House / Trap / Lo-fi)
  ai-assist.js             Claude-powered co-producer: structured-output actions edit the project
  app.js                   glue: boot, views, shortcuts, knobs, rAF loop, save/load
docs/                      RESEARCH.md, PLAN.md, USER_GUIDE.md
```

## Feature checklist (v1 — all shipped)
- [x] Boot splash (~4s brand hold) that also unlocks the AudioContext
- [x] Transport: play / pause / stop / rewind / record, PAT/SONG modes, position readout
- [x] Fine scrubbing: click ruler = jump, drag ruler = 16th-note-resolution scrub
- [x] BPM (30–300, drag/scroll), swing, metronome, master volume + live meter
- [x] Channel Rack step sequencer (16/32/64 steps, right-click erase, per-channel vol/pan/pitch/mute)
- [x] Piano roll (draw/move/resize/delete, snap, zoom, velocity via Alt+wheel, A–K musical typing, Z/X octave)
- [x] Playlist song arrangement (pattern clips with mini-previews, audio clips with waveforms)
- [x] Mixer: master + 8 inserts, faders, pan, mute/solo, dancing meters, up to 8 FX per insert
- [x] 7 effects with full parameter knobs + bypass
- [x] 24 synthesized instruments incl. piano, e-piano, organ, brass, strings, flute, bells, leads, basses, full drum kit
- [x] Real vintage drum machines (TR-808, LinnDrum, CR-8000, RZ-1, MFB-512) via CC0 sample host
- [x] Multi-track recording: any mic/audio interface input, music-grade constraints, monitor, takes → playlist
- [x] WAV export (offline render of full song or pattern), per-take WAV download
- [x] Save/load: autosave every 15 s, manual save, .trex file download/import
- [x] Undo/redo (60 levels)
- [x] Help system: always-on hint bar + Help toggle with rich tooltips on every control + F1 guide
- [x] AI Assist toggle: Claude co-producer that executes edits (beats, melodies, mixer, effects, arrangement)
- [x] 3 demo songs; never-empty first run; keyboard shortcuts matching FL conventions (Space, L, F5–F9, Ctrl+Z/S)

## Design principles
1. **Every knob teaches itself** — the FL hint-bar idea, doubled with a Help mode.
2. **Never a blank canvas** — a demo beat loads and plays on first visit.
3. **Can't-sound-bad defaults** — snap on, sensible instrument levels, master limiter always on.
4. **Legal by construction** — original code/name/theme/graphics; synthesized or CC0 sounds only.
5. **No build step** — a kid can read the source, edit a file, refresh.

## Roadmap (v2 ideas)
- Automation clips (draw parameter curves on the playlist)
- Sample drag-and-drop import + slicer
- Per-step velocity graph editor in the rack
- MIDI keyboard input (Web MIDI API)
- Sonic Pi CC0 sample pack vendored into the repo (FLAC→ogg)
- Song templates + more demo songs
- Share songs as URLs (compressed project state)
- Simple mastering view (master EQ + limiter ceiling with loudness meter)
