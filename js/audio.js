/* Retro sound effects synthesized live with WebAudio: no audio files.
   iOS only allows sound after a user gesture, so we unlock on first touch. */
(function () {
  'use strict';
  let ac = null, master = null;
  let muted = CG.store.get('muted', false);

  function unlock() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.22;
      master.connect(ac.destination);
      // Older iOS needs a sound played inside the gesture to fully unlock.
      const b = ac.createBuffer(1, 1, 22050);
      const s = ac.createBufferSource();
      s.buffer = b;
      s.connect(master);
      s.start(0);
    }
    if (ac.state === 'suspended') ac.resume();
  }
  ['pointerdown', 'touchend', 'keydown'].forEach((ev) =>
    document.addEventListener(ev, unlock, { passive: true }));

  function tone(o) {
    if (!ac || muted) return;
    const t0 = ac.currentTime + (o.delay || 0);
    const d = o.d || 0.1;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f || 440, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + d);
    const v = o.v === undefined ? 0.5 : o.v;
    gain.gain.setValueAtTime(v, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + d + 0.02);
  }

  let noiseBuf = null;
  function noise(o) {
    if (!ac || muted) return;
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t0 = ac.currentTime + (o.delay || 0);
    const d = o.d || 0.3;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(o.f || 2000, t0);
    filter.frequency.exponentialRampToValueAtTime(o.f2 || 100, t0 + d);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(o.v === undefined ? 0.6 : o.v, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
    src.stop(t0 + d + 0.02);
  }

  const seq = (notes, type, step, d, v) =>
    notes.forEach((f, i) => tone({ f, type, d: d || step * 1.2, v, delay: i * step }));

  // Named presets so games just call CG.audio.play('bounce').
  const presets = {
    blip: () => tone({ f: 660, d: 0.05, v: 0.3 }),
    paddle: () => tone({ f: 440, d: 0.07, v: 0.45 }),
    wall: () => tone({ f: 260, d: 0.05, v: 0.35 }),
    brick: () => tone({ f: 520 + Math.random() * 160, d: 0.06, v: 0.35 }),
    hard: () => tone({ f: 180, d: 0.06, v: 0.4, type: 'triangle' }),
    point: () => seq([523, 784], 'square', 0.08, 0.1, 0.35),
    miss: () => tone({ f: 300, f2: 80, d: 0.4, v: 0.45, type: 'sawtooth' }),
    shoot: () => tone({ f: 1200, f2: 300, d: 0.08, v: 0.18, type: 'square' }),
    hit: () => noise({ d: 0.15, f: 4000, f2: 400, v: 0.4 }),
    explode: () => noise({ d: 0.6, f: 1800, f2: 60, v: 0.8 }),
    power: () => seq([523, 659, 784, 1047], 'square', 0.06, 0.08, 0.3),
    life: () => seq([784, 988, 1175, 1568], 'triangle', 0.08, 0.12, 0.45),
    eat: () => tone({ f: 600, f2: 1100, d: 0.08, v: 0.35 }),
    bonus: () => seq([880, 1175, 1760], 'square', 0.05, 0.07, 0.3),
    start: () => seq([392, 523, 659, 784], 'square', 0.07, 0.09, 0.3),
    level: () => seq([523, 659, 784, 659, 784, 1047], 'square', 0.08, 0.1, 0.3),
    win: () => seq([523, 659, 784, 1047, 784, 1047], 'triangle', 0.1, 0.14, 0.5),
    over: () => seq([392, 330, 262, 196], 'triangle', 0.16, 0.2, 0.5),
    die: () => { tone({ f: 500, f2: 60, d: 0.7, v: 0.45, type: 'sawtooth' }); noise({ d: 0.5, f: 1500, f2: 80, v: 0.4 }); },
  };

  function play(name) {
    if (muted || !ac) return;
    const p = presets[name];
    if (p) try { p(); } catch (e) { /* ignore */ }
  }

  function setMuted(m) {
    muted = !!m;
    CG.store.set('muted', muted);
    if (master) master.gain.value = muted ? 0 : 0.22;
  }

  CG.audio = { play, tone, noise, unlock, setMuted, isMuted: () => muted };
})();
