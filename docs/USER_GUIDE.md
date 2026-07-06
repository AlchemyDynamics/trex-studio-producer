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
- **Import audio files…** (or just drag WAV/MP3/OGG files anywhere onto the app) turns your own samples into playable channels.

## 3. Melodies and basslines — Piano Roll (F7)

**How it connects:** the Piano Roll doesn't have its own tracks — it's a zoomed-in editor for **one row of the Channel Rack**. A "piano track" is just a Grand Piano channel in the rack whose notes you write here. Rows with a melody show a mini note-preview in the rack (click it to jump back into the Piano Roll), and channels with notes are marked ♪ in the selector.

1. Add a melodic instrument: **＋ Track** in the Piano Roll toolbar, or ＋ next to any instrument in the Browser (then click the row's 🎹).
2. Pick the channel in the **RACK CHANNEL** dropdown at the top.
3. **Click** the grid to place a note. **Drag** to move it. Drag its **right edge** to stretch it. **Right-click** deletes.
4. **Scale highlight:** pick a key (try *A Minor*) in the Scale dropdown — in-key rows light up and roots glow, so wrong notes are hard to hit. **Chord mode:** set Draw to *Major* or *Minor* and every click places a full chord.
5. **Got a MIDI keyboard?** Plug it in (Chrome/Edge) — it just works, velocity and all, including into note recording.
6. Play notes live: click the **piano keys** on the left, or use your computer keyboard — **A S D F G H J K** are white keys, **W E T Y U** are the black keys, **Z / X** move octaves.
7. **Editing power tools:** Ctrl+drag = box-select notes · drag any selected note = move them all together · **Ctrl+C / Ctrl+V** copy-paste · **Ctrl+B** duplicates the selection to the right (instant 2× melody) · **Shift+↑/↓** transpose a semitone, **Ctrl+↑/↓** an octave · **Del** removes · **Ctrl+A** selects all · Esc deselects.
8. **Record your playing!** Hit the toolbar **⏺** to arm, then press Play (pattern mode). You get a 1-bar count-in click, then everything you play — screen keys or A–K — is written into the pattern, snapped to the grid. Loop keeps going so you can layer more each pass.
9. The **🎹 KEYS** dropdown picks the sound the keys play — Grand Piano by default, or Electric Piano, Organ, Church Organ, Harpsichord, Clavinet, Music Box, Accordion and every other melodic instrument. Choose "↳ Follow channel" to hear the selected channel's own sound instead. (Notes you place in the grid always play their channel's instrument during playback.)

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
5. **Rearrange freely:** drag a clip to move it (any track, any bar) · drag its **right edge** to resize/trim · **Shift+drag** clones it · **right-click** deletes it.
6. **Loop a section:** drag across the ruler to set a loop region (green brace) — playback cycles it while you polish that section. Right-click the ruler to clear the loop. Click the ruler to jump anywhere.

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
- **REV / DLY send knobs** (bottom of each strip): every track can send a copy of itself into one big shared **hall reverb** and a **tempo-synced echo**. This is how real mixes get glued — a little REV on drums, keys and vocals puts everyone in the same room.
- **★ Presets** (in the effects panel): one click to a pro chain — *Vocal Shine, Drum Punch, Lo-fi, Huge Space, Telephone, Bass Power* — then tweak the knobs from there.
- Watch the **Master meter** (top right): if it slams into the red — or the **CLIP** light comes on — lower the master or your loudest tracks.

## 5½. Automation — make the mix MOVE ⚡

Automation is the secret sauce of electronic music: knobs that turn themselves.

1. **Right-click any mixer fader or effect knob** and a purple automation lane appears under the Playlist tracks (or use **⚡ ＋ Auto** in the Playlist toolbar).
2. Click in the lane to add points; drag them to sculpt the curve. Values glide smoothly between points. Right-click a point to remove it; ✕ on the lane header removes the lane.
3. Classic moves: automate a **Filter cutoff** from low to high across 4 bars = build-up. Automate **Master volume** down then up = the pre-drop dip. Automate **Reverb mix** up at the end of a phrase = wash out.
4. Automation plays in SONG mode and is baked into your WAV exports.

## 6. Recording — Record (F8)

1. Plug in your mic or USB audio interface, open the **Record** view, hit **↻** to scan inputs and pick one.
2. Check **Play song while recording** — you'll get a **1-bar count-in click** so you start right on the beat. Use headphones if you enable **Monitor** (avoids feedback). Leave **Auto latency fix** on: it shifts your take back by the small delay every computer adds, so recordings land ON the beat.
3. Hit the big **⏺** — a **🎙 audio track appears in the Channel Rack immediately**. Perform, then hit ⏺ again to stop.
4. Your recording lands on that rack channel with step 1 armed, so pressing play triggers it with your beat. Move the step to change where it fires, or open it in the Piano Roll to pitch it up/down like a sampler.
5. The take also appears below with a waveform: click to audition, **→ Playlist** places it on the song timeline instead, **⬇ WAV** saves it as a file.
6. Recordings are embedded in your downloaded `.trex` project files, so a saved song reopens with its vocals intact.

## 7. Saving and exporting

- **✚ New** saves your current song (browser + `.trex` download) and opens a fresh blank project.
- The app **autosaves** to your browser every 15 seconds.
- **💾 Save** also downloads a `.trex` file — back it up or share it with friends (they open it with **📂 Open**).
- **⬇ WAV** now asks: **WAV** (studio quality, renders in seconds) or **Compressed** (about 10× smaller, encodes in real time — perfect for texting to friends).

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
| `Ctrl` + drag | Box-select notes (piano roll) |
| `Ctrl+C` / `Ctrl+V` / `Ctrl+B` | Copy / paste / duplicate-right notes |
| `Shift+↑↓` / `Ctrl+↑↓` | Transpose selection semitone / octave |
| `⏺` then `Space` | Record your playing into the pattern (1-bar count-in) |
| Drag on ruler | Set loop region (Playlist) |
| Drag up/down on a lit step | Step velocity (Channel Rack) |
| `Alt` + wheel over a note | Note velocity |
| Double-click a knob/fader | Reset to default |

Now go make something loud. 🦖🎵
