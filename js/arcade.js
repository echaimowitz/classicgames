/* The arcade shell: menu, game loop, pause / game-over screens, scaling.
   Games plug in with CG.register({...}); see js/games/_template.js. */
(function () {
  'use strict';
  const W = 360, H = 640;          // every game uses this virtual screen
  const STEP = 1 / 120;            // fixed physics step (smooth + stable)
  const font = CG.font, input = CG.input, audio = CG.audio, store = CG.store;

  const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const games = [];
  CG.register = (def) => games.push(def);

  // ---- helpers handed to every game -------------------------------------
  const util = {
    rand: (a, b) => a + Math.random() * (b - a),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  };

  /** Turn an array of strings ('#' = pixel) into a cached sprite canvas. */
  const spriteCache = new Map();
  function sprite(rows, color, px) {
    px = px || 1;
    const key = rows.join('|') + color + px;
    let c = spriteCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = rows[0].length * px;
    c.height = rows.length * px;
    const g = c.getContext('2d');
    g.fillStyle = color;
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] !== '.' && row[x] !== ' ') g.fillRect(x * px, y * px, px, px);
    });
    spriteCache.set(key, c);
    return c;
  }

  // ---- DOM ---------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  let menuEl, playEl, canvas, g, wrap, stage, pauseBtn;

  // ---- runtime state -----------------------------------------------------
  let current = null, inst = null, state = 'menu';
  let raf = 0, last = 0, acc = 0, overAt = 0, lastScore = 0, newBest = false;
  let shakeT = 0, shakeAmt = 0;

  function makeApi(def) {
    return Object.assign({
      W, H, input, isTouch,
      sfx: audio.play,
      text: font.draw,
      textWidth: font.width,
      sprite,
      best: () => store.best(def.id),
      shake(amount, time) { shakeAmt = Math.max(shakeAmt, amount); shakeT = Math.max(shakeT, time || 0.3); },
      gameOver(score) {
        if (state !== 'playing') return;
        lastScore = Math.floor(score || 0);
        newBest = lastScore > store.best(def.id);
        if (newBest) store.setBest(def.id, lastScore);
        state = 'over';
        overAt = performance.now();
        audio.play(newBest ? 'win' : 'over');
        updatePauseBtn();
      },
    }, util);
  }

  // ---- screens -------------------------------------------------------------
  function buildMenu() {
    const logo = $('logo');
    logo.innerHTML = '';
    const big = window.innerWidth < 420 ? 4 : 5;
    logo.appendChild(font.label('CLASSIC', big, '#4ef0ff'));
    logo.appendChild(font.label('ARCADE', big, '#ff4fd8'));

    const grid = $('cart-grid');
    grid.innerHTML = '';
    games.forEach((def) => {
      const card = document.createElement('button');
      card.className = 'cart';
      card.style.setProperty('--c', def.color);
      card.setAttribute('aria-label', 'Play ' + def.title);

      const art = document.createElement('canvas');
      art.className = 'cart-art';
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      art.width = 160 * dpr; art.height = 120 * dpr;
      const ag = art.getContext('2d');
      ag.scale(dpr, dpr);
      ag.imageSmoothingEnabled = false;
      ag.fillStyle = '#05050b';
      ag.fillRect(0, 0, 160, 120);
      try { def.icon && def.icon(ag, 160, 120, Object.assign({ sprite, text: font.draw }, util)); } catch (e) { console.error(e); }
      card.appendChild(art);

      const t = document.createElement('div');
      t.className = 'cart-title';
      t.appendChild(font.label(def.title, 2, def.color));
      card.appendChild(t);

      const d = document.createElement('p');
      d.className = 'cart-desc';
      d.textContent = def.tagline;
      card.appendChild(d);

      const b = document.createElement('div');
      b.className = 'cart-best';
      const best = store.best(def.id);
      b.textContent = best ? 'BEST ' + best : 'NEW!';
      card.appendChild(b);

      card.addEventListener('click', () => { location.hash = '#/' + def.id; });
      grid.appendChild(card);
    });

    const soon = document.createElement('div');
    soon.className = 'cart soon';
    soon.innerHTML = '<div class="soon-inner">MORE<br>GAMES<br>COMING<br>SOON</div>';
    grid.appendChild(soon);
  }

  function showMenu() {
    stopLoop();
    state = 'menu';
    current = inst = null;
    input.setEnabled(false);
    playEl.hidden = true;
    menuEl.hidden = false;
    document.body.classList.remove('playing');
    buildMenu();
  }

  function launch(def) {
    current = def;
    inst = def.create(makeApi(def));
    inst.reset();
    state = 'ready';
    menuEl.hidden = true;
    playEl.hidden = false;
    document.body.classList.add('playing');
    $('play-title').innerHTML = '';
    $('play-title').appendChild(font.label(def.title, 2, def.color));
    input.setEnabled(true);
    resize();
    updatePauseBtn();
    startLoop();
  }

  function route() {
    const id = (location.hash.match(/^#\/([\w-]+)/) || [])[1];
    const def = id && games.find((x) => x.id === id);
    if (def) launch(def); else showMenu();
  }

  // ---- loop ----------------------------------------------------------------
  function startLoop() {
    stopLoop();
    last = performance.now();
    acc = 0;
    raf = requestAnimationFrame(frame);
  }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  function setPaused(p) {
    if (p && state === 'playing') state = 'paused';
    else if (!p && state === 'paused') { state = 'playing'; last = performance.now(); acc = 0; }
    updatePauseBtn();
  }
  function updatePauseBtn() {
    if (!pauseBtn) return;
    pauseBtn.classList.toggle('is-paused', state === 'paused');
    pauseBtn.disabled = !(state === 'playing' || state === 'paused');
    pauseBtn.setAttribute('aria-label', state === 'paused' ? 'Resume' : 'Pause');
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (input.hit('KeyP', 'Escape')) {
      if (state === 'playing') setPaused(true);
      else if (state === 'paused') setPaused(false);
      input.endFrame();
    }

    if (state === 'playing') {
      acc += dt;
      let steps = 0;
      while (acc >= STEP && state === 'playing') {
        inst.update(STEP);
        acc -= STEP;
        if (steps++ === 0) input.endFrame(); // one-shot inputs are seen once
      }
      if (shakeT > 0) shakeT -= dt;
    } else {
      if (state === 'ready' && input.action()) { state = 'playing'; audio.play('start'); updatePauseBtn(); }
      else if (state === 'paused' && input.action()) setPaused(false);
      else if (state === 'over' && input.action() && now - overAt > 800) {
        inst.reset();
        state = 'playing';
        audio.play('start');
        updatePauseBtn();
      }
      input.endFrame();
    }
    draw(now);
  }

  function draw(now) {
    g.save();
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    if (shakeT > 0 && state === 'playing') {
      const a = shakeAmt * Math.min(1, shakeT / 0.3);
      g.translate((Math.random() * 2 - 1) * a, (Math.random() * 2 - 1) * a);
    } else shakeAmt = 0;
    inst.draw(g, state);
    g.restore();
    drawOverlay(now);
  }

  function blink(now, rate) { return Math.floor(now / (rate || 500)) % 2 === 0; }

  function drawOverlay(now) {
    if (state === 'playing') return;
    const T = font.draw;
    g.fillStyle = 'rgba(0,0,0,0.68)';
    g.fillRect(0, 0, W, H);
    const cx = W / 2;
    if (state === 'ready') {
      const size = font.width(current.title, 4) > W - 24 ? 3 : 4;
      T(g, current.title, cx, 170, size, current.color, 'center');
      const lines = (isTouch ? current.controls.touch : current.controls.keys) || [];
      lines.forEach((l, i) => T(g, l, cx, 260 + i * 26, 2, '#cfd3ff', 'center'));
      if (blink(now, 450)) T(g, isTouch ? 'TAP TO START' : 'CLICK OR PRESS SPACE', cx, 420, 2, '#fff', 'center');
      const best = store.best(current.id);
      if (best) T(g, 'BEST ' + best, cx, 470, 2, '#ffd23f', 'center');
    } else if (state === 'paused') {
      T(g, 'PAUSED', cx, 250, 5, '#fff', 'center');
      if (blink(now, 500)) T(g, isTouch ? 'TAP TO RESUME' : 'CLICK OR PRESS SPACE', cx, 330, 2, '#cfd3ff', 'center');
    } else if (state === 'over') {
      T(g, 'GAME OVER', cx, 190, 5, '#ff4d6d', 'center');
      T(g, 'SCORE', cx, 270, 2, '#cfd3ff', 'center');
      T(g, String(lastScore), cx, 294, 4, '#fff', 'center');
      if (newBest) {
        if (blink(now, 300)) T(g, 'NEW HIGH SCORE!', cx, 350, 3, '#ffd23f', 'center');
      } else {
        T(g, 'BEST ' + store.best(current.id), cx, 354, 2, '#ffd23f', 'center');
      }
      if (now - overAt > 800 && blink(now, 450)) T(g, isTouch ? 'TAP TO PLAY AGAIN' : 'CLICK OR PRESS SPACE', cx, 430, 2, '#fff', 'center');
    }
  }

  // ---- sizing --------------------------------------------------------------
  function resize() {
    if (!stage || playEl.hidden) return;
    const aw = stage.clientWidth, ah = stage.clientHeight;
    const s = Math.max(0.1, Math.min(aw / W, ah / H));
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const cw = Math.floor(W * s), ch = Math.floor(H * s);
    wrap.style.width = cw + 'px';
    wrap.style.height = ch + 'px';
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    g.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    g.imageSmoothingEnabled = false;
  }

  // ---- sound toggle --------------------------------------------------------
  function syncSound() {
    const m = audio.isMuted();
    document.querySelectorAll('.sound-btn').forEach((b) => {
      b.classList.toggle('is-muted', m);
      b.setAttribute('aria-label', m ? 'Sound off' : 'Sound on');
      const t = b.querySelector('.sound-text');
      if (t) t.textContent = m ? 'SOUND OFF' : 'SOUND ON';
    });
  }

  // ---- boot ----------------------------------------------------------------
  function boot() {
    menuEl = $('menu'); playEl = $('play'); canvas = $('screen');
    wrap = $('screen-wrap'); stage = $('stage'); pauseBtn = $('pause-btn');
    g = canvas.getContext('2d');
    input.attach(canvas);

    $('back-btn').addEventListener('click', () => { location.hash = ''; });
    pauseBtn.addEventListener('click', () => setPaused(state === 'playing'));
    document.querySelectorAll('.sound-btn').forEach((b) =>
      b.addEventListener('click', () => { audio.setMuted(!audio.isMuted()); audio.unlock(); syncSound(); audio.play('blip'); }));
    syncSound();

    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 200));
    document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
    window.addEventListener('blur', () => setPaused(true));
    window.addEventListener('hashchange', route);
    // iOS Safari ignores user-scalable=no for pinch; block it explicitly.
    document.addEventListener('gesturestart', (e) => e.preventDefault());

    // "Add to Home Screen" tip on iPhone/iPad Safari when not installed yet.
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    if (ios && !standalone) $('install-hint').hidden = false;

    route();

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  CG.boot = boot;
  CG.debug = () => ({ state, inst });
  CG.games = games;
})();
