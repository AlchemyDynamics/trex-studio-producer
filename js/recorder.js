/* ============================================================
   Trex Studio Producer — Recorder
   Multitrack audio capture from any mic / audio interface input:
   getUserMedia with music-grade constraints (no voice processing),
   device picker, live input waveform, MediaRecorder capture,
   takes decoded to AudioBuffers → playlist audio clips or WAV.
   ============================================================ */
'use strict';

const Recorder = (() => {
  let stream = null;
  let mediaRecorder = null;
  let chunks = [];
  let sourceNode = null, monitorGain = null, inputAnalyser = null;
  let recording = false;
  let takes = [];   // { name, buffer, sampleId }
  let takeCount = 0;

  const constraintsFor = (deviceId) => ({
    audio: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      // music mode: turn OFF the voice-chat processing that ruins recordings
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });

  async function openInput(deviceId) {
    closeInput();
    const ctx = Engine.ensureContext();
    stream = await navigator.mediaDevices.getUserMedia(constraintsFor(deviceId));
    sourceNode = ctx.createMediaStreamSource(stream);
    inputAnalyser = ctx.createAnalyser();
    inputAnalyser.fftSize = 2048;
    sourceNode.connect(inputAnalyser);
    monitorGain = ctx.createGain();
    monitorGain.gain.value = document.getElementById('rec-monitor-on').checked ? 1 : 0;
    inputAnalyser.connect(monitorGain);
    monitorGain.connect(Engine.master);
    return stream;
  }

  function closeInput() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    [sourceNode, monitorGain, inputAnalyser].forEach(n => { try { n && n.disconnect(); } catch (e) {} });
    stream = sourceNode = monitorGain = inputAnalyser = null;
  }

  async function refreshDevices() {
    const sel = document.getElementById('rec-device');
    try {
      // ask permission once so device labels are visible
      if (!stream) await openInput(undefined);
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter(d => d.kind === 'audioinput');
      sel.innerHTML = '';
      inputs.forEach((d, i) => {
        const o = document.createElement('option');
        o.value = d.deviceId;
        o.textContent = d.label || 'Input ' + (i + 1);
        sel.appendChild(o);
      });
      App.toast(inputs.length + ' audio input(s) found');
    } catch (err) {
      sel.innerHTML = '<option>⚠ mic permission needed</option>';
      App.toast('Microphone access denied or unavailable');
    }
  }

  async function toggleRecord() {
    if (recording) { stopRecord(); return; }
    const deviceId = document.getElementById('rec-device').value || undefined;
    try {
      await openInput(deviceId);
    } catch (err) {
      App.toast('Could not open input: ' + err.message);
      return;
    }
    chunks = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
      : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
    mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    mediaRecorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    mediaRecorder.onstop = finalizeTake;
    mediaRecorder.start();
    recording = true;
    document.getElementById('rec-btn').classList.add('recording');
    document.getElementById('btn-record').classList.add('active');
    if (document.getElementById('rec-play-along').checked && !Engine.transport.playing) {
      Engine.play();
      App.syncTransportButtons();
    }
    App.toast('● Recording…');
  }

  function stopRecord() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    recording = false;
    document.getElementById('rec-btn').classList.remove('recording');
    document.getElementById('btn-record').classList.remove('active');
  }

  async function finalizeTake() {
    const blob = new Blob(chunks, { type: chunks[0] ? chunks[0].type : 'audio/webm' });
    try {
      const arr = await blob.arrayBuffer();
      const buffer = await Engine.ctx.decodeAudioData(arr);
      takeCount++;
      const name = 'Take ' + takeCount;
      const sampleId = Sampler.addUserSample(name, buffer);
      takes.push({ name, buffer, sampleId });
      renderTakes();
      App.toast('✔ ' + name + ' recorded (' + buffer.duration.toFixed(1) + 's)');
    } catch (err) {
      App.toast('Could not decode recording: ' + err.message);
    }
  }

  function renderTakes() {
    const host = document.getElementById('takes-list');
    host.innerHTML = '';
    takes.forEach((take, idx) => {
      const el = document.createElement('div');
      el.className = 'take';
      const nm = document.createElement('span');
      nm.textContent = '🎙 ' + take.name;
      nm.style.cssText = 'font-size:11px;white-space:nowrap';
      el.appendChild(nm);

      const wave = document.createElement('canvas');
      wave.width = 400; wave.height = 36;
      drawWave(wave, take.buffer);
      wave.dataset.hint = 'Take waveform|Click to play/audition this recording.';
      wave.onclick = () => {
        Engine.ensureContext();
        const src = Engine.ctx.createBufferSource();
        src.buffer = take.buffer;
        src.connect(Engine.master);
        src.start();
      };
      el.appendChild(wave);

      const send = document.createElement('button');
      send.className = 'mini-btn'; send.textContent = '→ Playlist';
      send.dataset.hint = 'Send to Playlist|Places this take on the arrangement timeline as an audio clip at bar 1 (drag pattern clips around it).';
      send.onclick = () => {
        State.snapshot();
        const stepsLen = take.buffer.duration / Engine.secondsPerStep();
        State.project.audioClips.push({
          id: 'ac' + Math.random().toString(36).slice(2, 9),
          type: 'audio', name: take.name, sampleId: take.sampleId,
          track: Math.min(State.project.playlistTracks - 1, idx),
          start: 0, lengthSteps: stepsLen, gain: 0.9, mixerTrack: 0,
        });
        UIPlaylist.render();
        App.showView('playlist');
        App.toast(take.name + ' added to Playlist — switch to SONG mode to hear it');
      };
      el.appendChild(send);

      const dl = document.createElement('button');
      dl.className = 'mini-btn'; dl.textContent = '⬇ WAV';
      dl.dataset.hint = 'Download take|Saves this recording as a .wav file.';
      dl.onclick = () => App.download(Engine.encodeWav(take.buffer), take.name.replace(/\s/g, '_') + '.wav');
      el.appendChild(dl);

      const del = document.createElement('button');
      del.className = 'icon-btn'; del.textContent = '✕';
      del.dataset.hint = 'Delete take|Removes this recording.';
      del.onclick = () => { takes.splice(idx, 1); renderTakes(); };
      el.appendChild(del);

      host.appendChild(el);
    });
  }

  // live input waveform — from app rAF loop
  const waveData = new Uint8Array(2048);
  function paintMonitor() {
    const cv = document.getElementById('rec-monitor');
    if (!cv || !cv.offsetParent) return; // view hidden
    const c = cv.getContext('2d');
    if (cv.width !== cv.clientWidth) cv.width = cv.clientWidth;
    c.fillStyle = '#101014';
    c.fillRect(0, 0, cv.width, cv.height);
    if (!inputAnalyser) {
      c.fillStyle = '#61616e'; c.font = '11px sans-serif';
      c.fillText('Choose an input and press ⏺ — or ↻ to scan devices', 12, 20);
      return;
    }
    inputAnalyser.getByteTimeDomainData(waveData);
    c.strokeStyle = recording ? '#ff4d5e' : '#35d0a0';
    c.lineWidth = 1.5;
    c.beginPath();
    for (let i = 0; i < waveData.length; i++) {
      const x = (i / waveData.length) * cv.width;
      const y = (waveData[i] / 255) * cv.height;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke();
  }

  function drawWave(cv, buffer) {
    const c = cv.getContext('2d');
    c.fillStyle = '#101014';
    c.fillRect(0, 0, cv.width, cv.height);
    const data = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / cv.width));
    c.fillStyle = '#ff8c2b';
    for (let x = 0; x < cv.width; x++) {
      let min = 1, max = -1;
      for (let i = 0; i < step; i += 8) {
        const v = data[x * step + i] || 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const y1 = ((1 - max) / 2) * cv.height, y2 = ((1 - min) / 2) * cv.height;
      c.fillRect(x, y1, 1, Math.max(1, y2 - y1));
    }
  }

  function init() {
    document.getElementById('rec-btn').onclick = toggleRecord;
    document.getElementById('btn-record').onclick = () => {
      App.showView('record');
      toggleRecord();
    };
    document.getElementById('rec-refresh').onclick = refreshDevices;
    document.getElementById('rec-device').onchange = (e) => {
      if (stream) openInput(e.target.value).catch(() => App.toast('Could not switch input'));
    };
    document.getElementById('rec-monitor-on').onchange = (e) => {
      if (monitorGain) monitorGain.gain.value = e.target.checked ? 1 : 0;
    };
  }

  return { init, refreshDevices, paintMonitor, toggleRecord, get recording() { return recording; }, takes };
})();
