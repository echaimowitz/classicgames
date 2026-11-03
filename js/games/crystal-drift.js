/* CRYSTAL DRIFT - blast drifting space rocks into smaller and smaller pieces.
   Your ship aims and fires by itself; you steer. Shattered rocks drop crystals:
   grab them quickly in a row to build a combo multiplier. Glowing "rich" rocks
   always drop crystals. Watch out for homing seeker mines from wave 2. */
(function () {
  'use strict';
  const W = 360, H = 640;
  const SIZES = { 3: 30, 2: 18, 1: 10 };
  const ROCK_PTS = { 3: 20, 2: 50, 1: 100 };
  const SHIP_R = 9;

  function wrap(o, m) {
    m = m || 0;
    let dx = 0, dy = 0;
    if (o.x < -m) dx = W + 2 * m; else if (o.x > W + m) dx = -(W + 2 * m);
    if (o.y < -m) dy = H + 2 * m; else if (o.y > H + m) dy = -(H + 2 * m);
    o.x += dx; o.y += dy;
    return dx || dy ? [dx, dy] : null;
  }

  CG.register({
    id: 'crystal-drift',
    title: 'Crystal Drift',
    tagline: 'Shatter space rocks and scoop up crystals. Your ship aims itself.',
    color: '#4ecbff',
    controls: {
      touch: ['DRAG ANYWHERE TO FLY', 'SHIP AIMS AND FIRES ITSELF', 'GRAB CRYSTALS FOR COMBOS'],
      keys: ['MOUSE OR ARROWS TO FLY', 'SHIP AIMS AND FIRES ITSELF', 'GRAB CRYSTALS FOR COMBOS'],
    },

    icon(g, w, h) {
      const rock = (cx, cy, r, col, seed) => {
        g.strokeStyle = col; g.lineWidth = 2; g.beginPath();
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2, rr = r * (0.75 + ((seed * (i + 3) * 7) % 10) / 40);
          g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        g.closePath(); g.stroke();
      };
      rock(40, 38, 22, '#8a8fc0', 3); rock(122, 30, 14, '#4ef0ff', 5); rock(128, 88, 9, '#cfd3ff', 2);
      g.strokeStyle = '#4ecbff'; g.lineWidth = 2; g.beginPath();
      g.moveTo(80, 70); g.lineTo(70, 96); g.lineTo(80, 90); g.lineTo(90, 96); g.closePath(); g.stroke();
      g.fillStyle = '#ffd23f'; g.fillRect(96, 56, 3, 3); g.fillRect(104, 48, 3, 3);
      g.fillStyle = '#4ef0ff';
      g.beginPath(); g.moveTo(40, 92); g.lineTo(45, 98); g.lineTo(40, 104); g.lineTo(35, 98); g.fill();
    },

    create(api) {
      const { input, clamp, rand, randInt } = api;
      let ship, bullets, rocks, crystals, seekers, parts, texts;
      let score, lives, wave, waveT, fireT, combo, comboT, msg, msgT, nextLife, respawnT, overT, seekT, drag;

      function reset() {
        score = 0; lives = 3; wave = 0; nextLife = 10000;
        combo = 0; comboT = 0; respawnT = 0; overT = 0; fireT = 0;
        bullets = []; rocks = []; crystals = []; seekers = []; parts = []; texts = [];
        ship = newShip();
        drag = null;
        startWave();
      }

      function newShip() {
        return { x: W / 2, y: H / 2 + 60, vx: 0, vy: 0, angle: -Math.PI / 2, alive: true, inv: 2.5, tx: null, ty: null };
      }

      function makeRock(x, y, size, rich, vx, vy) {
        const r = SIZES[size];
        const n = 9 + size;
        const shape = [];
        for (let i = 0; i < n; i++) shape.push(rand(0.72, 1.08));
        if (vx === undefined) {
          const a = rand(0, Math.PI * 2), s = rand(28, 55) + wave * 9;
          vx = Math.cos(a) * s; vy = Math.sin(a) * s;
        }
        return { x, y, vx, vy, r, size, rich, shape, rot: rand(0, 6.3), spin: rand(-1.2, 1.2) };
      }

      function startWave() {
        wave++;
        msg = 'WAVE ' + wave; msgT = 1.6;
        seekT = wave >= 5 ? 5 : 9;
        const count = Math.min(2 + wave, 12);
        for (let i = 0; i < count; i++) {
          // spawn around the edges, away from the ship
          let x, y, tries = 0;
          do {
            x = rand(0, W); y = rand(0, H); tries++;
          } while (Math.hypot(x - ship.x, y - ship.y) < 170 && tries < 50);
          rocks.push(makeRock(x, y, 3, Math.random() < 0.25));
        }
      }

      function burst(x, y, color, n, speed) {
        for (let i = 0; i < n; i++) {
          const a = rand(0, Math.PI * 2), s = rand(20, speed || 160);
          parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: rand(0.3, 0.8), color });
        }
      }

      function addScore(n) {
        score += n;
        if (score >= nextLife) {
          nextLife += 10000; lives = Math.min(lives + 1, 6);
          api.sfx('life'); msg = 'EXTRA SHIP!'; msgT = 1.4;
        }
      }

      function breakRock(i) {
        const rk = rocks[i];
        rocks.splice(i, 1);
        addScore(ROCK_PTS[rk.size]);
        burst(rk.x, rk.y, rk.rich ? '#4ef0ff' : '#a3a7c4', 6 + rk.size * 4);
        if (rk.size > 1) {
          const speed = Math.hypot(rk.vx, rk.vy) * 1.35 + 20;
          const base = Math.atan2(rk.vy, rk.vx);
          [-1, 1].forEach((sgn) => {
            const a = base + sgn * rand(0.5, 1.1);
            rocks.push(makeRock(rk.x, rk.y, rk.size - 1, rk.rich, Math.cos(a) * speed, Math.sin(a) * speed));
          });
          api.sfx(rk.size === 3 ? 'explode' : 'hit');
        } else {
          api.sfx('hit');
          const drops = rk.rich ? 2 : Math.random() < 0.3 ? 1 : 0;
          for (let k = 0; k < drops; k++) {
            crystals.push({ x: rk.x, y: rk.y, vx: rk.vx * 0.3 + rand(-30, 30), vy: rk.vy * 0.3 + rand(-30, 30), t: 7, spin: rand(0, 6) });
          }
        }
      }

      function killShip() {
        ship.alive = false;
        burst(ship.x, ship.y, '#4ecbff', 30, 240);
        burst(ship.x, ship.y, '#fff', 12, 140);
        api.sfx('die');
        api.shake(8, 0.5);
        lives--;
        combo = 0;
        drag = null;
        if (lives <= 0) overT = 2; else respawnT = 1.6;
      }

      // pick something to shoot: seekers first (they're dangerous), then the nearest rock
      function findTarget() {
        let best = null, bestD = Infinity;
        seekers.forEach((s) => {
          const d = Math.hypot(s.x - ship.x, s.y - ship.y) - 120;
          if (d < bestD) { bestD = d; best = s; }
        });
        rocks.forEach((r) => {
          const d = Math.hypot(r.x - ship.x, r.y - ship.y) - r.r;
          if (d < bestD) { bestD = d; best = r; }
        });
        return best;
      }

      function moveShip(dt) {
        const p = input.pointer;
        const ax = input.axisX(), ay = input.axisY();
        if (ax || ay) {
          ship.tx = null; drag = null;
          ship.vx += ax * 900 * dt; ship.vy += ay * 900 * dt;
          const sp = Math.hypot(ship.vx, ship.vy);
          if (sp > 270) { ship.vx *= 270 / sp; ship.vy *= 270 / sp; }
        } else if (p.type !== 'mouse') {
          // touch: relative drag, so your finger never hides the ship
          if (p.justDown) drag = { px: p.x, py: p.y, sx: ship.x, sy: ship.y };
          if (!p.down) drag = null;
          if (drag) { ship.tx = drag.sx + (p.x - drag.px) * 1.4; ship.ty = drag.sy + (p.y - drag.py) * 1.4; }
          else ship.tx = null;
        } else if (p.moved) {
          ship.tx = p.x; ship.ty = p.y;
        }
        if (ship.tx !== null && !(ax || ay)) {
          let vx = (ship.tx - ship.x) * 9, vy = (ship.ty - ship.y) * 9;
          const sp = Math.hypot(vx, vy);
          if (sp > 420) { vx *= 420 / sp; vy *= 420 / sp; }
          ship.vx = vx; ship.vy = vy;
        } else if (!(ax || ay)) {
          const f = Math.pow(0.35, dt);
          ship.vx *= f; ship.vy *= f;
        }
        ship.x += ship.vx * dt;
        ship.y += ship.vy * dt;
        const shift = wrap(ship, 6);
        if (shift) {
          if (drag) { drag.sx += shift[0]; drag.sy += shift[1]; }
          if (ship.tx !== null) { ship.tx += shift[0]; ship.ty += shift[1]; }
        }
        if (Math.hypot(ship.vx, ship.vy) > 120 && Math.random() < 0.6) {
          const a = Math.atan2(ship.vy, ship.vx) + Math.PI + rand(-0.4, 0.4);
          parts.push({ x: ship.x, y: ship.y, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, t: 0.25, color: '#ff8c42' });
        }
      }

      function update(dt) {
        if (msgT > 0) msgT -= dt;
        if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt;
          if (p.t <= 0) parts.splice(i, 1);
        }
        for (let i = texts.length - 1; i >= 0; i--) { texts[i].y -= 30 * dt; texts[i].t -= dt; if (texts[i].t <= 0) texts.splice(i, 1); }

        if (overT > 0) { overT -= dt; if (overT <= 0) { api.gameOver(score); return; } }

        // ---- ship
        if (ship.alive) {
          moveShip(dt);
          if (ship.inv > 0) ship.inv -= dt;
          const target = findTarget();
          if (target) {
            const d = Math.hypot(target.x - ship.x, target.y - ship.y);
            const lead = d / 520;
            const aim = Math.atan2(target.y + target.vy * lead - ship.y, target.x + target.vx * lead - ship.x);
            let diff = aim - ship.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            ship.angle += clamp(diff, -12 * dt, 12 * dt);
            fireT -= dt;
            if (fireT <= 0 && Math.abs(diff) < 0.25 && d < 260) {
              fireT = 0.2;
              bullets.push({ x: ship.x + Math.cos(ship.angle) * 12, y: ship.y + Math.sin(ship.angle) * 12,
                vx: Math.cos(ship.angle) * 520, vy: Math.sin(ship.angle) * 520, t: 0.7 });
              api.sfx('shoot');
            }
          }
        } else if (respawnT > 0) {
          respawnT -= dt;
          if (respawnT <= 0) ship = newShip();
        }

        // ---- bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          b.x += b.vx * dt; b.y += b.vy * dt; b.t -= dt;
          wrap(b);
          if (b.t <= 0) { bullets.splice(i, 1); continue; }
          let hit = false;
          for (let j = rocks.length - 1; j >= 0; j--) {
            const r = rocks[j];
            if ((b.x - r.x) ** 2 + (b.y - r.y) ** 2 < r.r * r.r) { breakRock(j); hit = true; break; }
          }
          if (!hit) {
            for (let j = seekers.length - 1; j >= 0; j--) {
              const s = seekers[j];
              if ((b.x - s.x) ** 2 + (b.y - s.y) ** 2 < 14 * 14) {
                hit = true;
                s.hp--; s.flash = 0.08;
                if (s.hp <= 0) {
                  seekers.splice(j, 1);
                  addScore(250);
                  texts.push({ x: s.x, y: s.y, t: 0.9, s: '250', c: '#ff4d6d' });
                  burst(s.x, s.y, '#ff4d6d', 20, 200);
                  api.sfx('explode');
                } else api.sfx('hard');
                break;
              }
            }
          }
          if (hit) bullets.splice(i, 1);
        }

        // ---- rocks
        rocks.forEach((r) => {
          r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.spin * dt;
          wrap(r, r.r);
          if (ship.alive && ship.inv <= 0 && (r.x - ship.x) ** 2 + (r.y - ship.y) ** 2 < (r.r * 0.85 + SHIP_R) ** 2) killShip();
        });

        // ---- seeker mines (wave 3+)
        if (wave >= 2 && ship.alive) {
          seekT -= dt;
          if (seekT <= 0) {
            seekT = Math.max(3.5, 13 - wave * 0.8);
            const side = randInt(0, 3);
            const x = side === 0 ? -10 : side === 1 ? W + 10 : rand(0, W);
            const y = side === 2 ? -10 : side === 3 ? H + 10 : rand(0, H);
            seekers.push({ x, y, vx: 0, vy: 0, hp: 3, flash: 0, t: 0 });
          }
        }
        seekers.forEach((s) => {
          s.t += dt;
          if (s.flash > 0) s.flash -= dt;
          const tx = ship.alive ? ship.x : W / 2, ty = ship.alive ? ship.y : H / 2;
          const a = Math.atan2(ty - s.y, tx - s.x);
          const sp = Math.min(50 + wave * 8, 160);
          s.vx += (Math.cos(a) * sp - s.vx) * 1.5 * dt;
          s.vy += (Math.sin(a) * sp - s.vy) * 1.5 * dt;
          s.x += s.vx * dt; s.y += s.vy * dt;
          wrap(s, 12);
          if (ship.alive && ship.inv <= 0 && (s.x - ship.x) ** 2 + (s.y - ship.y) ** 2 < (11 + SHIP_R) ** 2) killShip();
        });

        // ---- crystals (magnetic when close)
        for (let i = crystals.length - 1; i >= 0; i--) {
          const c = crystals[i];
          c.t -= dt; c.spin += dt * 4;
          if (ship.alive) {
            const dx = ship.x - c.x, dy = ship.y - c.y, d = Math.hypot(dx, dy);
            if (d < 80) { c.vx += (dx / d) * 700 * dt; c.vy += (dy / d) * 700 * dt; }
            if (d < 16) {
              crystals.splice(i, 1);
              combo = Math.min(combo + 1, 8);
              comboT = 2.5;
              const pts = 25 * combo;
              addScore(pts);
              texts.push({ x: c.x, y: c.y - 10, t: 0.8, s: combo > 1 ? 'x' + combo : '+' + pts, c: '#4ef0ff' });
              api.sfx(combo > 3 ? 'bonus' : 'eat');
              continue;
            }
          }
          c.vx *= Math.pow(0.5, dt); c.vy *= Math.pow(0.5, dt);
          c.x += c.vx * dt; c.y += c.vy * dt;
          wrap(c);
          if (c.t <= 0) crystals.splice(i, 1);
        }

        // ---- next wave
        if (rocks.length === 0 && overT <= 0) {
          if (waveT === undefined || waveT <= 0) waveT = 1.6;
          waveT -= dt;
          if (waveT <= 0) { addScore(wave * 300); api.sfx('level'); startWave(); waveT = undefined; }
        }
      }

      function drawPoly(g, x, y, r, shape, rot) {
        g.beginPath();
        const n = shape.length;
        for (let i = 0; i < n; i++) {
          const a = rot + (i / n) * Math.PI * 2;
          const px = x + Math.cos(a) * r * shape[i], py = y + Math.sin(a) * r * shape[i];
          if (i) g.lineTo(px, py); else g.moveTo(px, py);
        }
        g.closePath();
      }

      function draw(g, state) {
        const T = api.text;
        g.fillStyle = '#03030a';
        g.fillRect(0, 0, W, H);
        // faint fixed stars
        g.fillStyle = '#23264a';
        for (let i = 0; i < 50; i++) g.fillRect((i * 97) % W, (i * 173) % H, 2, 2);

        g.lineWidth = 2;
        g.lineJoin = 'round';
        rocks.forEach((r) => {
          // draw wrapped copies near edges so rocks slide smoothly across
          for (const ox of [0, r.x < r.r ? W : r.x > W - r.r ? -W : null]) {
            if (ox === null) continue;
            for (const oy of [0, r.y < r.r ? H : r.y > H - r.r ? -H : null]) {
              if (oy === null) continue;
              drawPoly(g, r.x + ox, r.y + oy, r.r, r.shape, r.rot);
              if (r.rich) { g.fillStyle = 'rgba(78,240,255,0.10)'; g.fill(); }
              g.strokeStyle = r.rich ? '#4ef0ff' : r.size === 3 ? '#8a8fc0' : r.size === 2 ? '#a3a7c4' : '#cfd3ff';
              g.stroke();
            }
          }
        });

        crystals.forEach((c) => {
          if (c.t < 2 && Math.floor(c.t * 8) % 2) return;
          const s = 5 + Math.sin(c.spin) * 1.5;
          g.fillStyle = '#4ef0ff';
          g.beginPath(); g.moveTo(c.x, c.y - s - 2); g.lineTo(c.x + s, c.y); g.lineTo(c.x, c.y + s + 2); g.lineTo(c.x - s, c.y); g.closePath(); g.fill();
          g.fillStyle = '#fff'; g.fillRect(c.x - 1, c.y - 3, 2, 2);
        });

        seekers.forEach((s) => {
          const pulse = 10 + Math.sin(s.t * 8) * 2;
          g.save(); g.translate(s.x, s.y); g.rotate(s.t * 3);
          g.strokeStyle = s.flash > 0 ? '#fff' : '#ff4d6d';
          g.strokeRect(-pulse / 1.4, -pulse / 1.4, pulse * 1.41, pulse * 1.41);
          g.restore();
          g.fillStyle = s.flash > 0 ? '#fff' : '#ff4d6d';
          g.fillRect(s.x - 3, s.y - 3, 6, 6);
        });

        g.fillStyle = '#ffd23f';
        bullets.forEach((b) => g.fillRect(b.x - 2, b.y - 2, 4, 4));

        if (ship.alive && (ship.inv <= 0 || Math.floor(ship.inv * 10) % 2 === 0)) {
          g.save();
          g.translate(ship.x, ship.y);
          g.rotate(ship.angle + Math.PI / 2);
          g.strokeStyle = '#4ecbff';
          g.fillStyle = 'rgba(78,203,255,0.18)';
          g.beginPath();
          g.moveTo(0, -12); g.lineTo(9, 10); g.lineTo(0, 5); g.lineTo(-9, 10); g.closePath();
          g.fill(); g.stroke();
          g.restore();
        }

        parts.forEach((p) => {
          g.globalAlpha = Math.min(1, p.t * 2.5);
          g.fillStyle = p.color;
          g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
        });
        g.globalAlpha = 1;
        texts.forEach((t) => T(g, t.s, t.x, t.y, 2, t.c, 'center'));

        // HUD
        T(g, String(score), 10, 12, 2, '#fff');
        T(g, 'WAVE ' + wave, W / 2, 12, 2, '#7d81a8', 'center');
        for (let i = 0; i < lives - 1; i++) {
          g.save(); g.translate(W - 16 - i * 18, 20);
          g.strokeStyle = '#4ecbff'; g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath(); g.stroke();
          g.restore();
        }
        if (combo > 1) T(g, 'COMBO x' + combo, W / 2, 36, 2, '#4ef0ff', 'center');
        if (msgT > 0 && state === 'playing') T(g, msg, W / 2, H / 2 - 120, 4, msg === 'EXTRA SHIP!' ? '#ffd23f' : '#fff', 'center');
      }

      return { reset, update, draw, peek: () => ({ ship, rocks, wave, lives, score, seekers }) };
    },
  });
})();
