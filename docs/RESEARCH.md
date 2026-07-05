# Trex Studio Producer — Research Report

*Compiled 2026-07-05 from three parallel research passes: (1) FL Studio Producer Edition deep-dive, (2) competitive DAW landscape + Web Audio API architecture, (3) legally-redistributable sample sources.*

---

## Part 1 — FL Studio (Producer Edition): what we're honoring

### The core workflow (the thing to clone)

FL Studio's mental model is a **pattern-based pipeline**:

```
Browser (samples/presets)
   └─ drag → Channel Rack (channels = instruments, project-wide)
                 └─ notes live in → Patterns (steps + piano-roll data)
                                        └─ placed as clips → Playlist (song arrangement)
Channel audio ── routed by track number ──→ Mixer insert → effects → Master → output
```

Key architectural facts:
- **Channels belong to the project, not to a pattern.** Every pattern can hold data for any channel; the Channel Rack is a *view into the selected pattern*.
- **Patterns → Playlist**: patterns are painted into the Playlist as clips; the same pattern can appear many times, and editing the pattern updates every clip.
- The MVP loop: pick sounds → toggle steps → build pattern variations → paint them into the Playlist → route to mixer → add effects → export. That loop *is* FL Studio.

### Step sequencer
- Default grid: **16 steps = 1 bar** (each step = 16th note), visually grouped in 4s with alternating shading.
- Pattern length up to 512 steps; left-click adds, **right-click removes**.
- **Swing 0–100%** delays the even 16ths.
- Graph editor: per-step velocity/pan/pitch lanes.

### Piano roll (widely called the best in any DAW)
- Click = add note, right-click = delete, drag right edge = resize.
- Ghost notes from other channels; slide notes; chord stamp tool (huge learning aid).
- Snap grid, Ctrl+wheel zoom, Alt+wheel velocity.

### Playlist
- 500 tracks in FL 20+; tracks are **not bound** to instruments — any clip anywhere.
- Three clip types: pattern clips, audio clips, automation clips.

### Mixer
- FL 20/21/2024: 125 inserts + Master; **10 effect slots per track**, per-slot bypass.
- Per-track 3-band EQ, pan, stereo sep, mute/solo; sends between any inserts.
- Fader unity at 80% travel; internal 32-bit float — only the Master clips (great teaching point).

### Transport
- **Default tempo 130 BPM** (range 10–522). **PAT/SONG switch** is the heart of the workflow (`L` toggles).
- Space = play/stop, Ctrl+Space = play/pause, R = record, Ctrl+M metronome.
- **F5 Playlist, F6 Channel Rack, F7 Piano Roll, F9 Mixer** window shortcuts.
- Typing-keyboard-to-piano (two stacked QWERTY octaves).

### The hint bar — FL's self-teaching secret
Hovering *any* control shows its name/description in a hint bar; dragging a control streams its live value ("Channel volume: -5.2 dB"). **This is THE feature to clone for a learner — every knob teaches itself.** (We implement it as a bottom hint bar + a rich Help-mode tooltip.)

### Stock plugins worth emulating conceptually
| FL plugin | Concept | Our equivalent |
|---|---|---|
| 3x Osc | 3-osc subtractive starter synth | Synthesized instrument set (24 instruments) |
| Fruity Delay 2/3 | Tempo delay + feedback filter | Echo Delay |
| Fruity Reeverb 2 | Algorithmic room reverb | Reverb (generated impulse response) |
| Fruity Fast Dist | Simple waveshaper | Distortion |
| Fruity Filter | LP/BP/HP + cutoff/res | Filter |
| Fruity Limiter | Comp/limiter | Compressor + master safety limiter |
| Parametric EQ 2 | 7-band teaching EQ, ±18 dB | 3-Band EQ (low/mid/high, ±18 dB) |

### Reviews: what's praised / criticized
- **Praised**: lifetime free updates; fastest pattern-based beatmaking (Sound on Sound: "very efficient and very creative"); best-in-class piano roll; strong stock plugins; top-3 for beginners.
- **Criticized**: audio recording/comping is the weak flank; "loop-itis" (easy loops, hard finished songs — our Playlist nudges counter this); mixer routing learning curve (we auto-assign channels to inserts); cluttered UI for newcomers (we use one tabbed window instead of floating windows).

### Legal boundaries (research, not legal advice)
- **Protectable — do NOT copy**: the names "FL Studio"/"Fruity Loops"/"Image-Line", logos, graphics/skins/knob art, code, samples/presets, and near-pixel-identical aggregate look-and-feel (*Tetris v. Xio* is the cautionary case).
- **NOT protectable — free to build**: workflow ideas and methods of operation (17 U.S.C. §102(b), *Lotus v. Borland*), standard GUI elements (*Apple v. Microsoft*), genre-dictated elements like faders/knobs/grids/transport buttons (scènes à faire), functional interfaces (*Google v. Oracle*).
- **Our checklist (all satisfied)**: 100% original code ✓ original name + dinosaur branding ✓ deliberately different palette (Trex orange `#ff8c2b` / mint `#35d0a0` on `#17171c`, vs FL's orange-on-slate-blue `#34444E`) ✓ zero Image-Line assets ✓ all sounds synthesized or CC0/permissive ✓ different layout personality (tabbed views vs floating windows) ✓.

---

## Part 2 — Other DAWs: lessons taken

| DAW | Lesson we adopted |
|---|---|
| **Ableton Live** | Bar-quantized pattern/clip launching = "impossible to sound bad." Our pattern loop mode gives the same confidence. |
| **GarageBand** | **Never show an empty project.** Demo song loads on first run. Visual instrument selection. Smart chord-level input (our AI assist covers "make me a chord progression"). |
| **Logic Pro** | Quick Help hover tooltips on every control → our Help toggle. |
| **Soundtrap / BandLab** | Proof a full DAW works in-browser; friendly big-button UX; loop/preset browser with one-click preview → our Browser sidebar previews on click. |
| **Audiotool** | Modular routing is a learning-curve trap — keep routing invisible by default (channels auto-route to inserts). |
| **learningmusic.ableton.com** | Teach *inside* the instrument: tiny always-playable editable examples → our demo songs + step-by-step guide + hint system. |

**Onboarding patterns adopted**: demo song on first run; genre demos (house/trap/lo-fi); guided 60-second tour (F1 guide); contextual hover hints forever; can't-sound-bad defaults (snap on, sensible patterns preloaded).

**"Professional feel" table stakes** (all implemented): mixer strips with live meters, velocity piano roll, per-channel FX inserts, BPM + swing, waveforms for audio clips, undo/redo, keyboard shortcuts, WAV export, autosave. *Meters that dance are disproportionately important to perceived quality.*

---

## Part 3 — Web Audio API architecture (as built)

### Audio graph
```
[osc/buffer/mic source] → per-note gain(velocity) → pan
   → mixer insert: FX chain (delay/dist/filter/reverb/EQ/comp/chorus) → fader → panner → analyser
   → master: FX chain → fader → analyser
   → master gain → DynamicsCompressor (safety limiter) → analyser → destination
```
- One `AudioContext`, created inside the splash-button click (autoplay policy).
- Effects use dry/wet gain crossfades, never disconnect/reconnect (clicks).
- Reverb = `ConvolverNode` with a **generated noise impulse response** (no sample files).
- Distortion = `WaveShaperNode` sigmoid curve, 4x oversample.
- Master limiter (threshold -3 dB, ratio 20:1) so a kid stacking 16 loud tracks sounds "loud and pro," not broken.

### Rock-solid timing — the "Tale of Two Clocks" lookahead scheduler
`setInterval` (25 ms) wakes a scheduler that queues every note falling in the next **120 ms** using `AudioContext.currentTime` — sample-accurate even when the main thread stutters. UI playhead syncs by draining a `{step, time}` queue in `requestAnimationFrame`. Swing = delay odd 16ths by `swing × half-step`.

### Instrument synthesis recipes (all 24 instruments synthesized — zero downloads)
- **808 kick**: sine 160→38 Hz pitch drop + click transient. **Snare**: highpassed noise + 190 Hz triangle thump. **Clap**: bandpassed noise with 3-burst envelope. **Hats**: six detuned square oscillators (ratios 2/3/4.16/5.43/6.79/8.21) → highpass 7 kHz (the classic 808 metallic recipe).
- **Piano**: detuned triangle/sine partials + closing lowpass + fast-decay envelope. **E-piano**: FM tine (carrier + 14× modulator with fast decay). **Organ**: drawbar harmonics 1-2-3-4.
- **Strings/pad**: 4 detuned saws, slow attack, LFO shimmer on filter. **Brass**: saws + filter envelope that opens fast (the "blat"). **Super saw lead**: ±12 cent detuned saw stack. **Bell**: inharmonic FM (3.53× ratio).

### Recording
- `getUserMedia` with `echoCancellation/noiseSuppression/autoGainControl: false` — **music mode** (voice-chat processing ruins recordings).
- `enumerateDevices()` after first permission → every mic and audio-interface input appears in the picker.
- `MediaRecorder` → decode to `AudioBuffer` → playlist audio clip / WAV download. Requires HTTPS (GitHub Pages ✓).

### Export
- `OfflineAudioContext` renders the full arrangement faster than real time → 16-bit WAV encoder (44-byte RIFF header + interleaved PCM).

### Pitfalls handled
Autoplay unlock via splash; `exponentialRampToValueAtTime` never to 0; one cached noise buffer; per-note nodes are throwaway (GC-friendly); master limiter always on.

### Open-source prior art studied (architecture only, original code)
GridSound (vanilla-JS DAW, no build step — proof the approach scales), signal by ryohey (piano-roll interactions), Chris Wilson's metronome (scheduler), MDN Advanced Techniques.

---

## Part 4 — Free sample sources (legal analysis)

**Bottom line: skip the famous "free sample" sites — most forbid redistribution. The gold is the CC0/permissive GitHub ecosystem.**

### Tier 1 — verified redistributable / fetchable
| Source | License | What | How we use it |
|---|---|---|---|
| **danigb/samples** (danigb.github.io/samples) | per-folder permissive/CC0 | TR-808, LinnDrum LM-2, Roland CR-8000, Casio RZ-1, MFB-512 + 5 more kits as tiny ogg one-shots with JSON manifests, CORS `*` | **Live-loaded in-app** ("Vintage Drum Kits" in the Browser). The 808 set is the classic 1994 Michael Fischer "Technopolis" freeware set — redistributed universally for 30 years. |
| **Sonic Pi samples** (sonic-pi-net/sonic-pi, etc/samples) | every file individually **CC0** with documented provenance | ~180 one-shots: `bd_808`, `bd_haus`, acoustic kit, 25 `elec_*` synth hits, bass drops | Best future expansion pack (convert FLAC→ogg first) |
| **VCSL** (sgossner/VCSL) | CC0 | orchestral/acoustic one-shots, bells, mallets, drums | cherry-pick for an "orchestra" category later |
| **VSCO2 Community Edition** | CC0, ~3 GB | full orchestra | too big to bundle; source for hand-picked hits |
| **Freesound.org CC0 filter** | CC0 (verify per-file) | everything | manual curation source |

### Tier 2 — usable in music, CANNOT redistribute (so we don't)
MusicRadar SampleRadar (~78k samples), 99Sounds, **Philharmonia Orchestra** (no "as-is" rehosting), SampleSwap (unverifiable licenses). These are what the *user* can download personally into the app via drag-import — not what we bundle.

### Strategy chosen
1. **Synthesize all core instruments** (smaller, tweakable, works offline — and for 808-style sounds synthesis is *authentic*: the original 808 was analog synthesis).
2. **Live-fetch vintage kits** from danigb's GitHub Pages (CORS-open, licenses travel in-folder) with graceful offline fallback.
3. Recordings/imports stay local to the user's browser.

---

## Sources
FL manual (image-line.com/fl-studio-learning), Image-Line KB #632 (grid color), Sound on Sound FL 20.8 review, MusicRadar FL 21 review, MusicTech FL 20 review, Splice; web.dev "A Tale of Two Clocks", MDN Web Audio docs (advanced techniques, best practices, autoplay), Joe Sullivan hi-hat synthesis, sonoport & cofx.nl drum recipes, learningmusic.ableton.com, Ableton/GarageBand/Soundtrap/BandLab/Audiotool docs & reviews, GridSound, signal; Freesound FAQ, 99Sounds license, Philharmonia terms, freewavesamples license, danigb/samples, Sonic Pi samples README, VCSL/VSCO2, Bedroom Producers Blog; 17 U.S.C. §102(b), *Lotus v. Borland*, *Apple v. Microsoft*, *Google v. Oracle*, *Tetris Holding v. Xio*, *Data East v. Epyx*.
