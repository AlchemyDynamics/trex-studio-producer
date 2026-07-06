/* ============================================================
   Trex Studio Producer — Channel Rack UI
   Rows of instruments with LED mute, volume/pan knobs, and a
   16th-note step grid. Left-click adds a step, right-click
   removes (FL-style). Steps light up as they play.
   ============================================================ */
'use strict';

const UIRack = (() => {
  const $rows = () => document.getElementById('rack-rows');

  // velocity shown as fill height on lit steps
  function paintStep(el, step, color) {
    el.classList.toggle('on', step.on);
    if (step.on) {
      const h = Math.round(step.vel * 100);
      el.style.background = `linear-gradient(to top, ${color} ${h}%, ${color}33 ${h}%)`;
    } else {
      el.style.background = '';
    }
  }

  // drag-up/down on a lit step = velocity; plain click = toggle off
  let velDrag = null;
  window.addEventListener('mousemove', (e) => {
    if (!velDrag) return;
    const dy = velDrag.startY - e.clientY;
    if (!velDrag.moved && Math.abs(dy) < 4) return;
    velDrag.moved = true;
    velDrag.step.vel = Math.max(0.1, Math.min(1, velDrag.startVel + dy / 90));
    paintStep(velDrag.el, velDrag.step, velDrag.color);
    Hints.showValue('Step velocity: ' + Math.round(velDrag.step.vel * 100) + '%');
  });
  window.addEventListener('mouseup', () => {
    if (!velDrag) return;
    if (!velDrag.moved && velDrag.wasOn) {
      velDrag.step.on = false;                    // plain click on lit step = remove
      paintStep(velDrag.el, velDrag.step, velDrag.color);
    } else if (velDrag.moved) {
      Sequencer.preview(velDrag.channel, 60, velDrag.step.vel); // hear the accent
    }
    velDrag = null;
  });

  function render() {
    const host = $rows();
    host.innerHTML = '';
    const pattern = State.activePattern();

    for (const channel of State.project.channels) {
      const inst = Instruments.byId[channel.instrumentId] || Sampler.get(channel.instrumentId)
        || { name: channel.name, color: '#888', desc: '' };
      const row = document.createElement('div');
      row.className = 'rack-row';

      // LED (mute toggle, FL-style green light)
      const led = document.createElement('div');
      led.className = 'ch-led' + (channel.mute ? '' : ' on');
      led.dataset.hint = `Channel light|Green = this channel plays. Click to mute/unmute ${channel.name}.`;
      led.onclick = () => { channel.mute = !channel.mute; render(); };
      row.appendChild(led);

      // name (click = preview, dblclick = rename)
      const name = document.createElement('div');
      name.className = 'ch-name';
      name.textContent = channel.name;
      name.style.borderLeftColor = inst.color;
      name.dataset.hint = `${channel.name}|${inst.desc || 'Instrument channel.'} Click to hear it. Double-click to rename. Right-click for options.`;
      name.onclick = () => Sequencer.preview(channel);
      name.ondblclick = () => {
        const n = prompt('Channel name:', channel.name);
        if (n) { channel.name = n; render(); }
      };
      name.oncontextmenu = (e) => { e.preventDefault(); channelMenu(channel); };
      row.appendChild(name);

      // volume + pan knobs
      row.appendChild(App.makeKnob({
        value: channel.volume, min: 0, max: 1,
        hint: `Channel volume|How loud ${channel.name} is before it reaches the mixer. Drag up/down. Double-click resets.`,
        onChange: v => { channel.volume = v; },
        format: v => Math.round(v * 100) + '%',
      }));
      row.appendChild(App.makeKnob({
        value: (channel.pan + 1) / 2, min: 0, max: 1,
        hint: `Channel pan|Places ${channel.name} left or right in your headphones. Middle = center.`,
        onChange: v => { channel.pan = v * 2 - 1; },
        format: v => { const p = Math.round((v * 2 - 1) * 100); return p === 0 ? 'C' : (p < 0 ? -p + 'L' : p + 'R'); },
      }));

      // step grid
      const stepsEl = document.createElement('div');
      stepsEl.className = 'steps';
      const steps = State.stepsFor(pattern, channel.id);
      for (let i = 0; i < pattern.length; i++) {
        const s = document.createElement('div');
        s.className = 'step' + (Math.floor(i / 4) % 2 === 0 ? ' beat1' : '');
        s.style.setProperty('--ch-color', inst.color);
        s.dataset.step = i;
        s.dataset.hint = `Step ${i + 1}|One 16th note. Left-click adds a hit, right-click removes it. Drag up/down on a lit step to set its velocity (accent). Steps 1, 5, 9, 13 are the main beats.`;
        paintStep(s, steps[i], inst.color);
        s.onmousedown = (e) => {
          e.preventDefault();
          State.snapshot();
          if (e.button === 2) {
            steps[i].on = false;
            paintStep(s, steps[i], inst.color);
            return;
          }
          const wasOn = steps[i].on;
          if (!wasOn) {
            steps[i].on = true;
            Sequencer.preview(channel, 60, steps[i].vel);
            paintStep(s, steps[i], inst.color);
          }
          // drag vertically = velocity; plain click on a lit step = turn off
          velDrag = {
            el: s, step: steps[i], color: inst.color, channel,
            startY: e.clientY, startVel: steps[i].vel, wasOn, moved: false,
          };
        };
        s.oncontextmenu = (e) => e.preventDefault();
        stepsEl.appendChild(s);
      }
      row.appendChild(stepsEl);

      // row tools
      const tools = document.createElement('div');
      tools.className = 'row-tools';
      const pr = document.createElement('button');
      pr.className = 'icon-btn'; pr.textContent = '🎹';
      pr.dataset.hint = 'Open in Piano Roll|Write melodies and chords for this channel on the note grid.';
      pr.onclick = () => { App.setPianoChannel(channel.id); App.showView('piano'); };
      tools.appendChild(pr);
      const del = document.createElement('button');
      del.className = 'icon-btn'; del.textContent = '✕';
      del.dataset.hint = 'Delete channel|Removes this instrument row and its notes from every pattern.';
      del.onclick = () => {
        if (!confirm(`Delete channel "${channel.name}"?`)) return;
        State.snapshot();
        State.project.channels = State.project.channels.filter(c => c.id !== channel.id);
        render();
      };
      tools.appendChild(del);
      row.appendChild(tools);

      host.appendChild(row);
    }
    renderPatternControls();
  }

  function channelMenu(channel) {
    const track = prompt(
      `Channel options for "${channel.name}"\n\nMixer insert (1-8, current ${channel.mixerTrack}).\nEnter a number, or "p" + semitones to pitch (e.g. p-12):`,
      String(channel.mixerTrack));
    if (track == null) return;
    if (/^p/i.test(track)) {
      const semi = parseInt(track.slice(1), 10);
      if (!isNaN(semi)) channel.pitch = Math.max(-24, Math.min(24, semi));
    } else {
      const t = parseInt(track, 10);
      if (t >= 1 && t <= 8) channel.mixerTrack = t;
    }
    render();
  }

  function renderPatternControls() {
    const sel = document.getElementById('pattern-select');
    sel.innerHTML = '';
    State.project.patterns.forEach((p, i) => {
      const o = document.createElement('option');
      o.value = i; o.textContent = p.name;
      if (i === State.project.activePattern) o.selected = true;
      sel.appendChild(o);
    });
    // length select: 1–8 bars, always including the pattern's current length
    const lenSel = document.getElementById('pattern-len');
    lenSel.innerHTML = '';
    const curLen = State.activePattern().length;
    const lengths = new Set([16, 32, 48, 64, 80, 96, 112, 128, curLen]);
    [...lengths].sort((a, b) => a - b).forEach(len => {
      const o = document.createElement('option');
      o.value = len;
      const bars = len / 16;
      o.textContent = (bars === Math.round(bars) ? bars : bars.toFixed(2)) + (bars === 1 ? ' bar' : ' bars') + ' (' + len + ')';
      if (len === curLen) o.selected = true;
      lenSel.appendChild(o);
    });

    // playlist paint selector shares the pattern list
    const ps = document.getElementById('playlist-pattern');
    ps.innerHTML = '';
    State.project.patterns.forEach((p) => {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.name;
      ps.appendChild(o);
    });
  }

  // playhead highlight, called from the app's rAF loop
  let lastStep = -1;
  function paintPlayhead(step) {
    if (step === lastStep) return;
    lastStep = step;
    $rows().querySelectorAll('.step.playing').forEach(el => el.classList.remove('playing'));
    if (step == null || !Engine.transport.playing) return;
    if (Engine.transport.mode !== 'pattern') return;
    $rows().querySelectorAll(`.step[data-step="${step}"]`).forEach(el => el.classList.add('playing'));
  }

  function init() {
    document.getElementById('pattern-select').onchange = (e) => {
      State.project.activePattern = parseInt(e.target.value, 10);
      render(); UIPiano.render();
    };
    document.getElementById('pattern-add').onclick = () => {
      State.snapshot();
      State.project.patterns.push(State.newPattern('Pattern ' + (State.project.patterns.length + 1)));
      State.project.activePattern = State.project.patterns.length - 1;
      render(); UIPiano.render(); UIPlaylist.render();
    };
    document.getElementById('pattern-clone').onclick = () => {
      State.snapshot();
      const src = State.activePattern();
      const copy = JSON.parse(JSON.stringify(src));
      copy.id = 'pat' + Math.random().toString(36).slice(2, 9);
      copy.name = src.name + ' copy';
      State.project.patterns.push(copy);
      State.project.activePattern = State.project.patterns.length - 1;
      render(); UIPiano.render(); UIPlaylist.render();
    };
    document.getElementById('pattern-len').onchange = (e) => {
      State.snapshot();
      const pattern = State.activePattern();
      pattern.length = parseInt(e.target.value, 10);
      Object.keys(pattern.steps).forEach(chId => {
        const old = pattern.steps[chId];
        pattern.steps[chId] = Array.from({ length: pattern.length }, (_, i) => old[i % old.length] ? { ...old[i % old.length] } : { on: false, vel: 1 });
      });
      render();
    };
    document.getElementById('pattern-addbar').onclick = () => {
      const pattern = State.activePattern();
      if (pattern.length >= 128) { App.toast('Pattern is at its 8-bar max — clone it and keep building in the Playlist!'); return; }
      State.snapshot();
      pattern.length += 16;
      // extend existing step rows in place, new bar starts empty
      Object.keys(pattern.steps).forEach(chId => {
        const old = pattern.steps[chId] || [];
        pattern.steps[chId] = Array.from({ length: pattern.length },
          (_, i) => old[i] || { on: false, vel: 1 });
      });
      render();
      UIPiano.render();
      App.toast('＋ 1 bar — pattern is now ' + (pattern.length / 16) + ' bars');
    };
    document.getElementById('rack-add-channel').onclick = () => App.pickInstrument();
  }

  return { render, paintPlayhead, init };
})();
