# 🦖 Trex Studio Producer — User Guide

Welcome to your studio! This guide takes you from "never made music" to "finished song." Everything here is also available inside the app: hover any button or knob to see what it does, click **❓ Help** for full pop-up explanations, or press **F1**.

---

## 1. Your first beat (5 minutes)

1. Click **▶ Enter the Studio**. The demo song "First Beat" is loaded.
2. Press **Space**. That's a house beat. Press Space again to pause.
3. Go to the **Channel Rack** (F6). Each **row** is an instrument. Each **square** is a 16th note — one bar is 16 squares, grouped in 4 beats.
4. Click squares to add hits, **right-click** to remove them.

**The classic recipes:**
- **House / dance**: kick on squares 1, 5, 9, 13 ("four on the floor"), clap on 5 and 13, closed hat on all the "and"s (2, 4, 6, 8…).
- **Hip-hop / trap**: fewer kicks in a bouncy pattern, snare/clap on 5 and 13, hats on every square (add some accents).
- Rule of thumb: **kick = the pulse, snare/clap = the backbeat, hats = the energy.**

5. Try the knobs on each row: left knob = volume, right = pan (left/right speaker). The green light mutes a channel.
6. Drag the **BPM** number up/down to change speed. Try the **Swing** knob at ~30% and hear the groove change.

## 2. Adding instruments

The **Browser** on the left lists every sound:
- **Click** an instrument to hear it.
- Click the **＋** to add it as a new row in the Channel Rack.
- **Vintage Drum Kits** loads real sampled drum machines from the 1980s (TR-808, LinnDrum…) — needs internet, and totally worth it.

## 3. Melodies and basslines — Piano Roll (F7)

1. Add a melodic instrument (try **Grand Piano** or **Sub Bass**).
2. Open the **Piano Roll** and pick that channel at the top.
3. **Click** the grid to place a note. **Drag** to move it. Drag its **right edge** to stretch it. **Right-click** deletes.
4. Play notes live with your computer keyboard: **A S D F G H J K** are white keys, **W E T Y U** are the black keys, **Z / X** move octaves.

**Cheat codes for sounding good:**
- Stay "in key": start with only the white-key notes A, C, D, E, G (A minor pentatonic — everything sounds good together).
- Bass: keep notes low (below C3) and simple — often just the root note of your chord.
- Chords: stack 3 notes with one gap between each (C-E-G). Move the whole shape up/down to get new chords.

## 4. Building a song — Playlist (F5)

A song = patterns arranged over time.

1. In the Channel Rack, click **⧉ Clone** to make variations of your pattern (e.g. a version without the melody for the intro). Click **＋ Bar** to make a pattern longer — each press adds one bar (16 steps / 4 quarter notes) so a beat can grow into a longer phrase (up to 8 bars).
2. Open the **Playlist** and switch the transport to **SONG** mode.
3. Pick a pattern in "PAINT WITH", then **click** empty timeline cells to place it. Click a clip to remove it.
4. Classic structure: **Intro (drums only) → Build (add bass) → Drop/Chorus (everything) → Break (quiet) → Drop → Outro.**
5. Click anywhere on the **ruler** to jump there; **drag** the ruler for fine scrubbing.

## 5. Mixing — Mixer (F9)

Mixing = making everything fit together. The mixer opens in its **own floating window** — drag the title bar to move it, drag the bottom-right corner to resize it, and press **F9** (or ✕) to hide it. That way you can keep the Playlist or your recordings visible behind it while you mix.

- Every channel is routed to a mixer **insert** (right-click a channel name in the rack to change which one).
- **Faders** set loudness. Start with the kick loudest; fit everything else around it.
- **M** mutes, **S** solos (hear one track alone).
- Click a strip to open its **effects rack** on the right. Add up to 8 effects per strip:
  - **Reverb** = puts sound in a room. A little on claps/snares = instant polish.
  - **Echo Delay** = repeats. Great on melodies and vocals.
  - **Filter** = the DJ sweep. Automate the cutoff by hand while playing!
  - **EQ** = tone control. Cut lows on everything that isn't kick or bass.
  - **Compressor** = evens out loudness, adds punch.
  - **Distortion** = grit for basses and leads. **Chorus** = width and shimmer.
- Watch the **Master meter** (top right): if it slams into the red, lower the master or your loudest tracks.

## 6. Recording — Record (F8)

1. Plug in your mic or USB audio interface, open the **Record** view, hit **↻** to scan inputs and pick one.
2. Check **Play song while recording** to perform along with the beat. Use headphones if you enable **Monitor** (avoids feedback).
3. Hit the big **⏺**, perform, hit it again to stop.
4. Your take appears with a waveform: click it to audition, **→ Playlist** drops it into your song as an audio clip, **⬇ WAV** saves it as a file.

## 7. Saving and exporting

- **✚ New** saves your current song (browser + `.trex` download) and opens a fresh blank project.
- The app **autosaves** to your browser every 15 seconds.
- **💾 Save** also downloads a `.trex` file — back it up or share it with friends (they open it with **📂 Open**).
- **⬇ WAV** renders your entire song to a high-quality WAV file you can share, upload, or put on your phone.

## 8. The AI Co-Producer ✨

Click **✨ AI** and just ask, in plain English:
- *"Make a trap beat at 140 BPM"*
- *"Add a dreamy pad playing an F minor chord"*
- *"Put echo on the bell and make the bass louder"*
- *"Arrange my patterns into a 16-bar song"*
- *"Why does my mix sound muddy?"*

It answers AND applies the edits directly to your project (you can always Ctrl+Z). Setup: paste a Claude API key in the field at the bottom of the panel (ask a parent — console.anthropic.com).

## Shortcuts reference

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `L` | Switch Pattern ↔ Song mode |
| `F1` | This guide |
| `F5` / `F6` / `F7` / `F8` / `F9` | Playlist / Channel Rack / Piano Roll / Record / Mixer |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo |
| `Ctrl+S` | Save project |
| `A`–`K`, `W E T Y U` | Play notes (piano keys) |
| `Z` / `X` | Octave down / up |
| Right-click | Remove step / delete note / channel options |
| `Ctrl` + mouse wheel | Zoom (piano roll & playlist) |
| `Alt` + wheel over a note | Note velocity |
| Double-click a knob/fader | Reset to default |

Now go make something loud. 🦖🎵
