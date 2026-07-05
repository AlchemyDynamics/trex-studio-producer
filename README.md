# 🦖 Trex Studio Producer

**A complete music production studio in your browser.** Make beats, write melodies, record vocals through any mic or audio interface, mix with professional effects, and export your songs — no install, no account, no cost.

**▶ Play it now: https://alchemydynamics.github.io/trex-studio-producer/**

Inspired by the pattern-based workflow of professional DAWs like FL Studio — rebuilt from scratch, legally and originally, to be intuitive and fun for a young producer while staying complete in features.

![status](https://img.shields.io/badge/status-live-brightgreen) ![license](https://img.shields.io/badge/license-MIT-blue) ![deps](https://img.shields.io/badge/dependencies-zero-orange)

## What's inside

| | |
|---|---|
| 🥁 **Channel Rack** | Classic 16-step beat sequencer (up to 64 steps), per-channel volume/pan/pitch |
| 🎹 **Piano Roll** | Draw melodies and chords on a note grid; play live with your computer keyboard |
| 🎬 **Playlist** | Arrange patterns and recordings into full songs on a timeline, with fine scrubbing |
| 🎚 **Mixer** | Master + 8 insert strips, dancing meters, mute/solo, up to 8 effects per strip |
| 🎛 **Effects** | Echo delay, distortion, filter, reverb, 3-band EQ, compressor, chorus |
| 🎷 **24 Instruments** | All synthesized live — 808 & punch kicks, snare, clap, hats, piano, e-piano, organ, brass, strings, flute, bells, super-saw lead, sub bass and more |
| 📼 **Vintage kits** | Real TR-808, LinnDrum, CR-8000, Casio RZ-1 & MFB-512 samples (CC0/permissive, loaded on demand) |
| 🎙 **Recording** | Multi-take recording from any microphone or audio interface input, with live waveform monitoring |
| ⬇ **Export** | Render your whole song to WAV, save/load `.trex` project files, autosave |
| ❓ **Help everywhere** | Hover any control for a hint; toggle Help mode for full explanations; F1 opens the guide |
| ✨ **AI Co-Producer** | Toggle the AI panel and just ask: *"make a trap beat at 140"*, *"add reverb to the snare"*, *"write a piano melody in A minor"* — it edits your project for you (bring your own Claude API key) |

## Quick start

1. Open the app and click **▶ Enter the Studio**.
2. A demo beat is already loaded — press **Space**.
3. Click squares in the **Channel Rack** to change the beat.
4. Open the **Piano Roll** (F7), pick an instrument, click to add notes.
5. Switch to **SONG** mode and paint patterns into the **Playlist** (F5).
6. Mix it in the **Mixer** (F9), then hit **⬇ WAV** to export your track.

**Shortcuts:** `Space` play/pause · `L` pattern/song · `F5`–`F9` views · `Ctrl+Z` undo · `Ctrl+S` save · `A`–`K` play notes · `Z`/`X` octave · `F1` guide

## Running locally

No build step — it's plain HTML/CSS/JS:

```bash
git clone https://github.com/AlchemyDynamics/trex-studio-producer.git
cd trex-studio-producer
python3 -m http.server 8080   # any static server works
# open http://localhost:8080
```

(Recording requires HTTPS or localhost — both work.)

## AI Assist setup

Click **✨ AI**, paste a Claude API key from [console.anthropic.com](https://console.anthropic.com) into the field at the bottom of the panel. The key is stored only in your browser's localStorage and sent only to Anthropic's API.

## Legal & credits

- 100% original code, design, name and artwork. Not affiliated with or endorsed by Image-Line. "FL Studio" is a trademark of Image-Line Software — this project simply takes inspiration from pattern-based DAW workflow concepts, which are ideas, not protected expression.
- All built-in instruments are synthesized in real time with the Web Audio API — no third-party sound assets are bundled.
- Optional vintage drum kits stream from [danigb/samples](https://github.com/danigb/samples) (CC0/permissive one-shots, incl. the classic 1994 Michael Fischer freeware TR-808 set). Licenses travel with each kit folder.
- Research, plan and architecture notes: [docs/RESEARCH.md](docs/RESEARCH.md) · [docs/PLAN.md](docs/PLAN.md) · [docs/USER_GUIDE.md](docs/USER_GUIDE.md)

MIT © Alchemy Dynamics
