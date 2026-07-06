# Trex Studio Producer — Product Specification

*The canonical definition of what this software is, what a DAW must foundationally do, where we stand, and what we build next. Supersedes the feature checklist in PLAN.md as the source of truth.*

**Vision:** a complete, legal, browser-based digital audio workstation that a motivated teenager can learn real music production on — professional in capability, self-teaching in presentation, zero-install, zero-cost.

**Definition of "complete":** a user can go from silence to a finished, shareable song — composed, performed, recorded, arranged, mixed, automated, and exported — without leaving the app or hitting a wall where "real" software would be needed.

---

## The Ten Pillars

Every serious DAW — FL Studio, Ableton, Logic, Cubase, Reaper — does these ten things. This is the foundational checklist any audio production software must satisfy.

| # | Pillar | One-line test | Status |
|---|--------|---------------|--------|
| 1 | **Sound generation** | Can I get a wide palette of instrument sounds, and shape them? | 🟡 strong palette, no shaping |
| 2 | **Sequencing** | Can I compose rhythms and melodies precisely and quickly? | 🟡 entry works, editing is thin |
| 3 | **Performance capture** | Can I *play* music in (keys/pads) and have it recorded as notes? | 🟡 note recording + count-in shipped; MIDI pending |
| 4 | **Audio recording** | Can I capture real sound (voice, instruments) accurately? | 🟡 works, no count-in/latency comp |
| 5 | **Arrangement** | Can I structure patterns and audio into a full song, and rework it freely? | 🟡 clip editing + loop shipped; markers/track-mute pending |
| 6 | **Automation** | Can parameters move over time (filter sweeps, fades, builds)? | 🟡 lanes + live/export apply shipped; curves/recording pending |
| 7 | **Mixing** | Can I balance, place, and process every sound? | 🟡 solid inserts, no sends/sidechain |
| 8 | **Editing ergonomics** | Select, copy, paste, duplicate, delete — everywhere, fast, undoable | 🟡 notes+clips shipped; modals/context menus pending |
| 9 | **Import / export** | Can sound come in (samples, files) and songs go out (WAV/MP3/stems)? | 🟡 audio import + WAV out shipped; MP3/stems pending |
| 10 | **Feedback & learning** | Meters, hints, guidance — does the tool teach and show what's happening? | ✅ strongest area |

Pillars 3 and 6 were entirely absent at spec time — **you could program music but not *perform* it in, and nothing could *move* over time.** Milestone A (2026-07-06) filled both foundations; remaining work is depth, not absence.

---

## Pillar-by-pillar specification

Legend: ✅ shipped · 🟡 partial · ❌ missing · Priority **P0** (foundational, next) / **P1** (expected, soon) / **P2** (professional polish)

### 1. Sound generation
| Capability | Status | Priority |
|---|---|---|
| Synthesized instrument palette (29 instruments: drums, keys, brass, strings, leads, basses, pads) | ✅ | — |
| Sampled drum machines (TR-808, LinnDrum, CR-8000, RZ-1, MFB-512 via CC0 host) | ✅ | — |
| Recorded audio as playable channels | ✅ | — |
| **Per-channel sound shaping** — ADSR envelope, filter cutoff/res, per-channel pitch UI (FL's "channel settings"). Our synths are fixed presets; there are no knobs to make a sound *yours* | ❌ | **P1** |
| **User sample import** — drag a WAV/MP3 onto the app → new channel (the #1 way real producers work) | ✅ | shipped |
| Simple sample controls per channel: start/end trim, reverse, normalize, loop toggle | ❌ | P1 |
| Sidechain/ducking input on compressor (the EDM "pump") | ❌ | P2 |

### 2. Sequencing (Channel Rack + Piano Roll)
| Capability | Status | Priority |
|---|---|---|
| 16th-step grid, 1–8 bars, right-click erase, swing | ✅ | — |
| Piano roll: draw/move/resize/delete, snap, zoom, keys gutter | ✅ | — |
| **Per-step velocity/accent editing** (drag vertically on a lit step; fill height shows accent) | ✅ | shipped |
| **Piano roll selection & clipboard**: marquee select, copy/paste, Ctrl+B duplicate-right, Shift+arrows transpose, Del | ✅ | shipped |
| Scale helper: highlight in-key rows / optional scale lock ("can't sound bad") | ❌ | P1 |
| Chord stamp tool (click once → major/minor/7th chord) | ❌ | P1 |
| Quantize command (snap recorded/played notes to grid, with strength) | ❌ | P1 (pairs with pillar 3) |
| Humanize (randomize velocity/timing slightly) | ❌ | P2 |
| Per-pattern time signatures / triplet grid | ❌ | P2 |

### 3. Performance capture ← missing pillar
| Capability | Status | Priority |
|---|---|---|
| Live audition via typing keyboard / clicking keys | ✅ | — |
| **Note recording**: ⏺ arms, count-in, played keys written into the pattern quantized to the grid while the loop plays | ✅ | shipped |
| **Web MIDI input**: plug in a USB keyboard/pad controller and play — works in Chrome/Edge today | ❌ | **P1** |
| Count-in (1 bar of metronome before capture starts) | ✅ | shipped |
| Loop-overdub (keep looping, layer more notes each pass) | ❌ | P1 |

### 4. Audio recording
| Capability | Status | Priority |
|---|---|---|
| Device picker (any mic/interface), music-grade constraints, monitoring, live waveform | ✅ | — |
| Recording → Channel Rack track automatically, takes list, WAV per take | ✅ | — |
| Recordings persist inside .trex files | ✅ | — |
| **Count-in for audio takes** (engine count-in shipped for note recording; wire it into the audio-record flow too) | 🟡 | **P1** |
| **Latency compensation** — recordings land 20–80 ms late (hardware+browser); auto-shift takes left by a calibrated offset, expose a nudge control | ❌ | **P1** — this is why takes feel "off the beat" |
| Trim take (head/tail silence) in a small waveform editor | ❌ | P1 |
| Punch in/out, take comping (keep best parts of multiple passes) | ❌ | P2 |

### 5. Arrangement (Playlist)
| Capability | Status | Priority |
|---|---|---|
| Paint pattern clips, audio clips, mini-previews, waveforms, ruler scrub | ✅ | — |
| **Clip manipulation: drag to move, drag edge to resize/trim, Shift+drag clone, right-click delete** | ✅ | shipped |
| **Loop region**: drag a loop brace on the ruler; playback cycles it | ✅ | shipped |
| Per-playlist-track mute/solo + rename in track headers | ❌ | P1 |
| Song markers/sections ("Intro", "Drop") on the ruler | ❌ | P1 |
| Audio clip trim/offset (slip-edit inside clip window) | ❌ | P2 |

### 6. Automation ← missing pillar
| Capability | Status | Priority |
|---|---|---|
| **Automation lanes**: right-click any mixer knob/fader (or ⚡＋Auto) → drawable curve lane in the playlist; applies live and in WAV export | ✅ | shipped |
| Automatable targets: mixer volume/pan, FX parameters (AudioParam-scheduled in exports), master volume | ✅ | shipped (BPM deferred) |
| Curve tensions/shapes (hold, S-curve) | ❌ | P2 |
| Recording knob movements live ("touch" automation) | ❌ | P2 |

### 7. Mixing
| Capability | Status | Priority |
|---|---|---|
| Master + 8 inserts, faders, pan, mute/solo, meters, 8-slot FX chains, 7 effect types, channel→insert routing | ✅ | — |
| **Send/aux buses** — one shared reverb/delay that many channels feed by amount (how mixes actually get glued; cheaper than per-insert reverbs too) | ❌ | **P1** |
| Effect presets ("Vocal shine", "Drum punch", "Lo-fi") — one click, then tweak | ❌ | P1 (huge for a learner) |
| dB-calibrated meters + clip indicators on master | ❌ | P1 |
| More insert tracks (grow past 8 on demand) | ❌ | P2 |
| Spectrum analyzer view on EQ | ❌ | P2 |

### 8. Editing ergonomics
| Capability | Status | Priority |
|---|---|---|
| Undo/redo 60 levels, keyboard shortcuts, double-click-reset knobs | ✅ | — |
| **Clipboard everywhere**: notes ✅, clips (shift-drag clone) ✅; steps rows (copy pattern row → another channel) pending | 🟡 | P1 |
| Replace `prompt()`/`confirm()` dialogs with proper in-app modals & right-click context menus (rename, channel routing, delete) | 🟡 | **P1** — the prompts feel broken next to the rest of the UI |
| Drag to reorder channels in the rack | ❌ | P2 |

### 9. Import / export
| Capability | Status | Priority |
|---|---|---|
| WAV export (offline render), .trex save/load with embedded audio, autosave | ✅ | — |
| **Audio file import** (drag-drop or picker → channel) | ✅ | shipped |
| **MP3/OGG export** (WAV files are huge for sharing; MediaRecorder can encode) | ❌ | **P1** |
| Stem export (one WAV per mixer track — for collabs/remixes) | ❌ | P2 |
| MIDI file import/export | ❌ | P2 |
| Multiple named project slots in-browser + project browser on splash | ❌ | P1 |

### 10. Feedback & learning
| Capability | Status | Priority |
|---|---|---|
| Hint bar, Help-mode tooltips on every control, F1 guide, 3 demo songs, AI co-producer with project editing | ✅ | — |
| Playhead everywhere it matters (rack ✅, playlist ✅, piano roll ❌ — add a moving line) | 🟡 | P1 |
| First-run interactive tour (spotlight: "click here → press space") | ❌ | P2 |
| AI awareness of new features as they land (automation, sends) — keep the action schema in sync | 🟡 | ongoing |

---

## Gap analysis — the "obvious missing things," named

1. **Nothing moves over time** — no automation. Every mix decision is frozen. (Pillar 6)
2. **You can't play music in** — ⏺ only records audio; playing the keys writes nothing. (Pillar 3)
3. **The playlist is paint-only** — clips can't be moved, resized, or copied; rearranging means delete-and-repaint. (Pillar 5)
4. **No loop region** — you can't cycle 8 bars while working on them. (Pillar 5)
5. **Nothing comes in from outside** — no drag-drop samples or audio files. (Pillars 1/9)
6. **Notes can't be selected/copied** — every melody is placed one click at a time. (Pillars 2/8)
7. **Velocity has no UI** — the data model supports it; there's no way to edit it per step. (Pillar 2)
8. **Recording starts cold and lands late** — no count-in, no latency compensation. (Pillar 4)
9. **No sends** — can't share one reverb across channels; no sidechain pump. (Pillar 7)
10. **Sounds aren't shapeable** — no ADSR/filter per channel; presets only. (Pillar 1)

## Milestone A — SHIPPED ✅ (2026-07-06)

All six P0 features are live. Remaining gaps continue at Milestone B below.

## Proposed build order

- **Milestone A — "Feels like a real DAW" (all P0):**
  1. Playlist clip editing (move/resize/copy/delete) + loop region
  2. Automation clips (min: mixer vol/pan, FX params, master)
  3. Note recording in pattern mode with count-in + quantize
  4. Piano-roll selection/copy/paste/duplicate/transpose
  5. Per-step velocity lane in the rack
  6. Drag-drop sample/audio import
- **Milestone B — "Sounds professional" (P1):** send buses + FX presets, latency compensation + take trim, Web MIDI, per-channel ADSR/filter, MP3 export, scale helper + chord stamp, proper modals/context menus, project browser, piano-roll playhead.
- **Milestone C — "Deep cuts" (P2):** sidechain, comping, stems, MIDI files, automation curve shapes, spectrum EQ, humanize, triplets, tour.

Acceptance test for Milestone A: *record a beat, play a melody in live, loop 8 bars, arrange by dragging clips, automate a filter sweep into the drop, drop in a downloaded sample — all without touching delete-and-redo.*
