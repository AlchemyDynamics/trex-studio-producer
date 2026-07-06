/* ============================================================
   Trex Studio Producer — Automation
   Lanes of {tick, value} points (values normalized 0..1) that
   move mixer faders, pans, and effect parameters over the song.
   Applied live each scheduled step, and scheduled onto
   AudioParams during offline WAV export.

   target kinds:
     { kind:'masterVol' }
     { kind:'mixerVol', track }
     { kind:'mixerPan', track }
     { kind:'fxParam', track, slot, param }   (slot = chain index)
   ============================================================ */
'use strict';

const Automation = (() => {

  function lanes() { return State.project.automation; }

  function laneName(target) {
    const trackName = (t) => (State.project.mixer[t] ? State.project.mixer[t].name : 'Insert ' + t);
    switch (target.kind) {
      case 'masterVol': return 'Master · Volume';
      case 'mixerVol': return trackName(target.track) + ' · Volume';
      case 'mixerPan': return trackName(target.track) + ' · Pan';
      case 'fxParam': {
        const fx = (State.project.mixer[target.track] || { fx: [] }).fx[target.slot];
        const def = fx && Effects.byId[fx.defId];
        const p = def && def.params.find(x => x.id === target.param);
        return trackName(target.track) + ' · ' + (def ? def.name : '?') + ' · ' + (p ? p.name : target.param);
      }
      default: return 'Automation';
    }
  }

  // current normalized value of a target (so new lanes start where the knob is)
  function currentValue(target) {
    const m = State.project.mixer;
    switch (target.kind) {
      case 'masterVol': return Engine.master ? Math.min(1, Engine.master.gain.value) : 0.8;
      case 'mixerVol': return m[target.track] ? m[target.track].volume : 0.8;
      case 'mixerPan': return m[target.track] ? (m[target.track].pan + 1) / 2 : 0.5;
      case 'fxParam': {
        const fx = m[target.track] && m[target.track].fx[target.slot];
        const def = fx && Effects.byId[fx.defId];
        const p = def && def.params.find(x => x.id === target.param);
        if (!p || p.options) return 0.5;
        return Effects.norm(p, fx.values[target.param] != null ? fx.values[target.param] : p.def);
      }
      default: return 0.5;
    }
  }

  function createLane(target) {
    // one lane per target
    const existing = lanes().find(l => JSON.stringify(l.target) === JSON.stringify(target));
    if (existing) return existing;
    State.snapshot();
    const v = currentValue(target);
    const lane = {
      id: 'auto' + Math.random().toString(36).slice(2, 9),
      name: laneName(target),
      target,
      points: [{ tick: 0, value: v }],
    };
    lanes().push(lane);
    return lane;
  }

  function removeLane(id) {
    State.snapshot();
    State.project.automation = lanes().filter(l => l.id !== id);
  }

  // linear interpolation between points; flat before first / after last
  function valueAt(lane, tick) {
    const pts = lane.points;
    if (!pts.length) return null;
    if (tick <= pts[0].tick) return pts[0].value;
    for (let i = 1; i < pts.length; i++) {
      if (tick <= pts[i].tick) {
        const a = pts[i - 1], b = pts[i];
        const f = (tick - a.tick) / Math.max(1e-6, b.tick - a.tick);
        return a.value + (b.value - a.value) * f;
      }
    }
    return pts[pts.length - 1].value;
  }

  function setPoint(lane, tick, value) {
    tick = Math.max(0, Math.round(tick));
    value = Math.max(0, Math.min(1, value));
    const existing = lane.points.find(p => p.tick === tick);
    if (existing) existing.value = value;
    else {
      lane.points.push({ tick, value });
      lane.points.sort((a, b) => a.tick - b.tick);
    }
  }

  function deletePoint(lane, tick, tolerance = 2) {
    if (lane.points.length <= 1) return;
    let best = null, bestD = tolerance + 1;
    lane.points.forEach(p => {
      const d = Math.abs(p.tick - tick);
      if (d < bestD) { bestD = d; best = p; }
    });
    if (best && bestD <= tolerance) lane.points = lane.points.filter(p => p !== best);
  }

  // fx param definition for a lane (null if the fx slot vanished)
  function fxParamDef(target) {
    const fx = State.project.mixer[target.track] && State.project.mixer[target.track].fx[target.slot];
    const def = fx && Effects.byId[fx.defId];
    return def ? def.params.find(x => x.id === target.param) : null;
  }

  // ---- live application (called each scheduled step in song mode) ----
  function applyAtTick(tick, when) {
    for (const lane of lanes()) {
      const v = valueAt(lane, tick);
      if (v == null) continue;
      const t = lane.target;
      switch (t.kind) {
        case 'masterVol':
          if (Engine.master) Engine.master.gain.setTargetAtTime(v, Engine.ctx.currentTime, 0.02);
          break;
        case 'mixerVol':
          if (State.project.mixer[t.track]) {
            State.project.mixer[t.track].volume = v;
            Mixer.applyTrack(t.track);
          }
          break;
        case 'mixerPan':
          if (State.project.mixer[t.track]) {
            State.project.mixer[t.track].pan = v * 2 - 1;
            Mixer.applyTrack(t.track);
          }
          break;
        case 'fxParam': {
          const p = fxParamDef(t);
          const strip = Mixer.strips[t.track];
          if (!p || p.options || !strip || !strip.chain.slots[t.slot]) break;
          const real = Effects.denorm(p, v);
          const slot = strip.chain.slots[t.slot];
          const ap = slot.fx.params && slot.fx.params[t.param];
          if (ap) ap.setTargetAtTime(real, Engine.ctx.currentTime, 0.02);
          else slot.fx.set(t.param, real);
          slot.values[t.param] = real;
          break;
        }
      }
    }
  }

  // ---- offline application (WAV export): schedule AudioParams at `when` ----
  function applyOffline(offline, tick, when) {
    for (const lane of lanes()) {
      const v = valueAt(lane, tick);
      if (v == null) continue;
      const t = lane.target;
      switch (t.kind) {
        case 'masterVol':
          offline.masterGain.gain.setValueAtTime(v, when);
          break;
        case 'mixerVol': {
          const s = offline.strips[t.track];
          if (s && s.fader) s.fader.gain.setValueAtTime(s.audible === false ? 0 : v, when);
          break;
        }
        case 'mixerPan': {
          const s = offline.strips[t.track];
          if (s && s.panner) s.panner.pan.setValueAtTime(v * 2 - 1, when);
          break;
        }
        case 'fxParam': {
          const p = fxParamDef(t);
          const s = offline.strips[t.track];
          const slot = s && s.chain && s.chain.slots[t.slot];
          if (!p || p.options || !slot) break;
          const ap = slot.fx.params && slot.fx.params[t.param];
          if (ap) ap.setValueAtTime(Effects.denorm(p, v), when);
          break;
        }
      }
    }
  }

  return { lanes, createLane, removeLane, laneName, valueAt, setPoint, deletePoint, applyAtTick, applyOffline };
})();
