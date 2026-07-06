/* ============================================================
   Trex Studio Producer — Mixer UI
   Channel strips (fader, meter, pan, mute/solo) + FX rack panel
   for the selected strip. Meters animate from AnalyserNodes.
   ============================================================ */
'use strict';

const UIMixer = (() => {
  let selected = 0;

  // right-click on a knob/fader → automation lane in the playlist
  function autoLane(target) {
    Automation.createLane(target);
    UIPlaylist.render();
    App.showView('playlist');
    App.toast('⚡ Automation lane added for ' + Automation.laneName(target) + ' — draw the curve below the tracks');
  }

  function render() {
    const host = document.getElementById('mixer-strips');
    host.innerHTML = '';
    State.project.mixer.forEach((t, i) => {
      const strip = document.createElement('div');
      strip.className = 'strip' + (i === 0 ? ' master' : '') + (i === selected ? ' selected' : '');
      strip.dataset.hint = `${t.name}|A mixer strip: drag the fader for volume, knob for pan, M mutes, S solos. Click the strip to edit its effects on the right. Channels are routed here from the Channel Rack (right-click a channel name).`;
      strip.onclick = (e) => {
        if (e.target.closest('.fader-track, .knob, .ms')) return;
        selected = i; render(); renderFx();
      };

      const name = document.createElement('div');
      name.className = 'strip-name';
      name.textContent = t.name;
      name.ondblclick = () => { const n = prompt('Track name:', t.name); if (n) { t.name = n; render(); } };
      strip.appendChild(name);

      // pan knob
      if (i !== 0) {
        strip.appendChild(App.makeKnob({
          value: (t.pan + 1) / 2, min: 0, max: 1, small: true,
          hint: `Pan — ${t.name}|Places this track left/right in the stereo field. Right-click to automate it over the song.`,
          onChange: v => { t.pan = v * 2 - 1; Mixer.applyTrack(i); },
          format: v => { const p = Math.round((v * 2 - 1) * 100); return p === 0 ? 'C' : (p < 0 ? -p + 'L' : p + 'R'); },
          onContext: () => autoLane({ kind: 'mixerPan', track: i }),
        }));
      }

      // meter + fader
      const mf = document.createElement('div');
      mf.className = 'meter-fader';
      const meter = document.createElement('div');
      meter.className = 'meter';
      const fill = document.createElement('div');
      fill.className = 'fill'; fill.dataset.meterTrack = i;
      meter.appendChild(fill);
      mf.appendChild(meter);

      const track = document.createElement('div');
      track.className = 'fader-track';
      track.dataset.hint = `Volume fader — ${t.name}|Drag up/down to set loudness. Double-click resets to 80%. Right-click to automate it over the song (fades, build-ups).`;
      track.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        autoLane({ kind: 'mixerVol', track: i });
      });
      const thumb = document.createElement('div');
      thumb.className = 'fader-thumb';
      track.appendChild(thumb);
      positionThumb(thumb, track, t.volume);
      attachFader(track, thumb, t, i);
      mf.appendChild(track);
      strip.appendChild(mf);

      // mute/solo
      const ms = document.createElement('div');
      ms.className = 'ms';
      const m = document.createElement('button');
      m.className = 'mute' + (t.mute ? ' active' : ''); m.textContent = 'M';
      m.dataset.hint = `Mute — ${t.name}|Silences this track.`;
      m.onclick = () => { t.mute = !t.mute; Mixer.applyAll(); render(); };
      ms.appendChild(m);
      if (i !== 0) {
        const s = document.createElement('button');
        s.className = 'solo' + (t.solo ? ' active' : ''); s.textContent = 'S';
        s.dataset.hint = `Solo — ${t.name}|Hear ONLY this track (and other soloed tracks).`;
        s.onclick = () => { t.solo = !t.solo; Mixer.applyAll(); render(); };
        ms.appendChild(s);
      }
      strip.appendChild(ms);

      // sends to the shared reverb / delay buses
      if (i !== 0) {
        const sends = document.createElement('div');
        sends.className = 'sends';
        const mk = (label, key, hint) => {
          const wrap = document.createElement('div');
          wrap.className = 'send-wrap';
          wrap.appendChild(App.makeKnob({
            value: t[key] || 0, min: 0, max: 1, small: true,
            hint,
            onChange: v => { t[key] = v; Mixer.applyTrack(i); },
            format: v => Math.round(v * 100) + '%',
          }));
          const l = document.createElement('div');
          l.className = 'send-lbl'; l.textContent = label;
          wrap.appendChild(l);
          sends.appendChild(wrap);
        };
        mk('REV', 'sendReverb', `Reverb send — ${t.name}|Sends a copy of this track into one big shared hall reverb. Turn it up for space and depth — the mix's glue.`);
        mk('DLY', 'sendDelay', `Delay send — ${t.name}|Sends a copy into a shared tempo-synced echo. Great for vocals, leads and one-shot accents.`);
        strip.appendChild(sends);
      }

      const fxc = document.createElement('div');
      fxc.className = 'fx-count';
      fxc.textContent = t.fx.length ? t.fx.length + ' FX' : '';
      strip.appendChild(fxc);

      host.appendChild(strip);
    });
    renderFx();
  }

  function positionThumb(thumb, track, volume) {
    requestAnimationFrame(() => {
      const h = track.clientHeight - thumb.offsetHeight;
      thumb.style.top = (1 - volume) * h + 'px';
    });
  }

  function attachFader(track, thumb, t, i) {
    let dragging = false;
    const set = (clientY) => {
      const r = track.getBoundingClientRect();
      const h = r.height - thumb.offsetHeight;
      let v = 1 - (clientY - r.top - thumb.offsetHeight / 2) / h;
      v = Math.max(0, Math.min(1, v));
      t.volume = v;
      thumb.style.top = (1 - v) * h + 'px';
      Mixer.applyTrack(i);
      Hints.showValue(`${t.name} volume: ${Math.round(v * 100)}%`);
    };
    track.addEventListener('mousedown', (e) => { dragging = true; set(e.clientY); e.preventDefault(); });
    window.addEventListener('mousemove', (e) => { if (dragging) set(e.clientY); });
    window.addEventListener('mouseup', () => { dragging = false; });
    track.addEventListener('dblclick', () => { t.volume = 0.8; Mixer.applyTrack(i); positionThumb(thumb, track, 0.8); });
  }

  // ---------- FX presets: one click to a pro-sounding chain ----------
  const PRESETS = [
    { name: '✨ Vocal Shine', desc: 'Air on top, a touch of room, smooth compression — for voices and leads.',
      fx: [{ defId: 'eq3', values: { low: -2, mid: 0, high: 4 } }, { defId: 'compressor', values: { threshold: -20, ratio: 4, attack: 0.01, release: 0.25 } }, { defId: 'reverb', values: { size: 1.6, mix: 0.22 } }] },
    { name: '🥁 Drum Punch', desc: 'Tight compression and EQ snap — kick and snare hit harder.',
      fx: [{ defId: 'compressor', values: { threshold: -18, ratio: 5, attack: 0.005, release: 0.15 } }, { defId: 'eq3', values: { low: 4, mid: -1, high: 2 } }] },
    { name: '🎞 Lo-fi', desc: 'Dusty, warm, old-tape vibe — muffled highs and gentle grit.',
      fx: [{ defId: 'filter', values: { type: 'lowpass', cutoff: 2600, q: 0.8 } }, { defId: 'distortion', values: { drive: 16, tone: 3200, level: 0.75 } }] },
    { name: '🌌 Huge Space', desc: 'Cathedral reverb + long echoes — pads, intros, epic moments.',
      fx: [{ defId: 'reverb', values: { size: 3.6, mix: 0.45 } }, { defId: 'delay', values: { time: 0.42, feedback: 0.45, mix: 0.3 } }] },
    { name: '📞 Telephone', desc: 'Thin, crunchy radio/phone voice — a classic intro trick.',
      fx: [{ defId: 'filter', values: { type: 'bandpass', cutoff: 1600, q: 4 } }, { defId: 'distortion', values: { drive: 12, tone: 4000, level: 0.8 } }] },
    { name: '🔊 Bass Power', desc: 'Bigger lows with harmonics so the bass shows up on small speakers.',
      fx: [{ defId: 'eq3', values: { low: 5, mid: 0, high: 1 } }, { defId: 'distortion', values: { drive: 9, tone: 2800, level: 0.8 } }, { defId: 'compressor', values: { threshold: -16, ratio: 4, attack: 0.02, release: 0.2 } }] },
    { name: '🧼 Clean', desc: 'Removes every effect from this strip.', fx: [] },
  ];

  function pickPreset() {
    App.choose({
      title: '★ Effect presets — ' + State.project.mixer[selected].name,
      items: PRESETS.map(p => ({ label: p.name, desc: p.desc, color: '#ffd23b' })),
      onPick: (i) => {
        State.snapshot();
        Mixer.strips[selected].chain.load(PRESETS[i].fx.map(f => ({ ...f, bypassed: false })));
        State.project.mixer[selected].fx = Mixer.strips[selected].chain.serialize();
        render();
        App.toast(PRESETS[i].name + ' applied to ' + State.project.mixer[selected].name + ' — tweak the knobs from here');
      },
    });
  }

  // ---------- FX panel ----------
  function renderFx() {
    const t = State.project.mixer[selected];
    document.getElementById('fx-title').textContent = t.name + ' — Effects';
    const host = document.getElementById('fx-slots');
    host.innerHTML = '';
    const chain = Mixer.strips[selected] && Mixer.strips[selected].chain;
    if (!chain) return;

    chain.slots.forEach((slot, idx) => {
      const def = Effects.byId[slot.defId];
      const el = document.createElement('div');
      el.className = 'fx-slot' + (slot.bypassed ? ' bypassed' : '');

      const head = document.createElement('div');
      head.className = 'fx-head';
      const nm = document.createElement('span');
      nm.className = 'name'; nm.textContent = def.icon + ' ' + def.name;
      nm.dataset.hint = `${def.name}|${def.desc}`;
      head.appendChild(nm);
      const byp = document.createElement('button');
      byp.className = 'mini-btn'; byp.textContent = slot.bypassed ? 'Off' : 'On';
      byp.dataset.hint = 'Bypass|Temporarily turns the effect off so you can compare with/without.';
      byp.onclick = () => { Mixer.toggleFxBypass(selected, idx); renderFx(); };
      head.appendChild(byp);
      const del = document.createElement('button');
      del.className = 'icon-btn'; del.textContent = '✕';
      del.dataset.hint = 'Remove effect|Deletes this effect from the chain.';
      del.onclick = () => { Mixer.removeFx(selected, idx); render(); };
      head.appendChild(del);
      el.appendChild(head);

      const params = document.createElement('div');
      params.className = 'fx-params';
      def.params.forEach(p => {
        const wrap = document.createElement('div');
        wrap.className = 'fx-param';
        if (p.options) {
          const sel = document.createElement('select');
          p.options.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o; opt.textContent = o;
            if (slot.values[p.id] === o) opt.selected = true;
            sel.appendChild(opt);
          });
          sel.dataset.hint = `${p.name}|${p.hint}`;
          sel.onchange = () => { Mixer.setFxParam(selected, idx, p.id, sel.value); };
          wrap.appendChild(sel);
        } else {
          const val = document.createElement('div');
          val.className = 'val';
          const fmt = v => (p.unit === 'dB' || p.unit === ':1' ? v.toFixed(1) : (v >= 100 ? Math.round(v) : v.toFixed(2))) + (p.unit || '');
          val.textContent = fmt(slot.values[p.id]);
          const knob = App.makeKnob({
            value: normFor(p, slot.values[p.id]), min: 0, max: 1,
            hint: `${p.name} — ${def.name}|${p.hint} Right-click to automate this knob over the song.`,
            onChange: nv => {
              const v = denormFor(p, nv);
              Mixer.setFxParam(selected, idx, p.id, v);
              val.textContent = fmt(v);
            },
            format: nv => fmt(denormFor(p, nv)),
            onContext: () => autoLane({ kind: 'fxParam', track: selected, slot: idx, param: p.id }),
          });
          wrap.appendChild(knob);
          wrap.appendChild(val);
        }
        const lbl = document.createElement('div');
        lbl.className = 'lbl'; lbl.textContent = p.name;
        wrap.appendChild(lbl);
        params.appendChild(wrap);
      });
      el.appendChild(params);
      host.appendChild(el);
    });

    // add-effect buttons
    const add = document.getElementById('fx-add');
    add.innerHTML = '';
    const pre = document.createElement('button');
    pre.className = 'mini-btn';
    pre.style.borderColor = '#ffd23b';
    pre.textContent = '★ Presets';
    pre.dataset.hint = 'Effect presets|One click to a pro-sounding effect chain — Vocal Shine, Drum Punch, Lo-fi, Huge Space… then tweak the knobs.';
    pre.onclick = pickPreset;
    add.appendChild(pre);
    Effects.defs.forEach(def => {
      const b = document.createElement('button');
      b.className = 'mini-btn';
      b.textContent = '＋ ' + def.icon + ' ' + def.name;
      b.dataset.hint = `Add ${def.name}|${def.desc}`;
      b.onclick = () => { State.snapshot(); Mixer.addFx(selected, def.id); render(); };
      add.appendChild(b);
    });
  }

  function normFor(p, v) {
    if (p.log) return Math.log(v / p.min) / Math.log(p.max / p.min);
    return (v - p.min) / (p.max - p.min);
  }
  function denormFor(p, n) {
    if (p.log) return p.min * Math.pow(p.max / p.min, n);
    return p.min + n * (p.max - p.min);
  }

  // meters — called from app rAF loop
  function paintMeters() {
    document.querySelectorAll('[data-meter-track]').forEach(el => {
      const lvl = Mixer.level(parseInt(el.dataset.meterTrack, 10));
      el.style.height = Math.min(100, lvl * 130) + '%';
    });
  }

  return { render, paintMeters, get selected() { return selected; } };
})();
