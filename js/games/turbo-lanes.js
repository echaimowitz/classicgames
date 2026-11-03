/* TURBO LANES - a night-time highway dash.
   Tap the left or right side of the screen to switch lanes. Weave through
   traffic, grab fuel cans before the tank runs dry, and dodge at the last
   second for CLOSE CALL bonuses. The road keeps getting faster. */
(function () {
  'use strict';
  const W = 360, H = 640;
  const ROAD_L = 40, ROAD_R = 320, LANES = 4;
  const LANE_W = (ROAD_R - ROAD_L) / LANES;
  const laneX = (i) => ROAD_L + LANE_W * (i + 0.5);
  const PLAYER_Y = H - 120;
  const PX = 2.6; // sprite pixel scale

  const CAR = [
    '..hcccccch..',
    '.cccccccccc.',
    'kccwwwwwwcck',
    'kcwwwwwwwwck',
    'kcwwwwwwwwck',
    '.cccccccccc.',
    '.ccdccccdcc.',
    '.ccdccccdcc.',
    '.cccccccccc.',
    '.cccccccccc.',
    'kccwwwwwwcck',
    'kcwwwwwwwwck',
    'kcccccccccck',
    '.cccccccccc.',
    '.tcccccccct.',
  ];
  const TRUCK = [
    '..hcccccch..',
    '.cccccccccc.',
    'kcwwwwwwwwck',
    'kcwwwwwwwwck',
    '.cccccccccc.',
    '..dddddddd..',
    'bbbbbbbbbbbb',
    'bddddddddddb',
    'bbbbbbbbbbbb',
    'kbbbbbbbbbbk',
    'kbbbbbbbbbbk',
    'bbbbbbbbbbbb',
    'bddddddddddb',
    'bbbbbbbbbbbb',
    'kbbbbbbbbbbk',
    'kbbbbbbbbbbk',
    'bbbbbbbbbbbb',
    'btbbbbbbbbtb',
  ];
  const TRAFFIC_COLORS = ['#ff4d6d', '#5ee35e', '#c77dff', '#ff8c42', '#4ecbff', '#e0e0f0'];

  CG.register({
    id: 'turbo-lanes',
    title: 'Turbo Lanes',
    tagline: 'Weave through night traffic, grab fuel, and chase close calls.',
    color: '#ff4fd8',
    controls: {
      touch: ['TAP LEFT / RIGHT SIDE', 'TO SWITCH LANES', 'GRAB FUEL BEFORE YOU RUN DRY'],
      keys: ['{ } ARROWS OR CLICK SIDES', 'TO SWITCH LANES', 'GRAB FUEL BEFORE YOU RUN DRY'],
    },

    icon(g, w, h, u) {
      g.fillStyle = '#101018'; g.fillRect(24, 0, 112, h);
      g.fillStyle = '#ff4fd8'; for (let y = 0; y < h; y += 16) g.fillRect(20, y, 4, 8);
      g.fillStyle = '#4ef0ff'; for (let y = 8; y < h; y += 16) g.fillRect(136, y, 4, 8);
      g.fillStyle = '#3a3a55'; for (let y = 4; y < h; y += 20) { g.fillRect(62, y, 3, 10); g.fillRect(98, y, 3, 10); }
      g.drawImage(u.sprite(CAR, { c: '#4ef0ff', d: '#2a8fa0', w: '#0b2030', h: '#fff6b0', t: '#ff2050', k: '#000' }, 2), 30, 70);
      g.drawImage(u.sprite(CAR, { c: '#ff4d6d', d: '#a02040', w: '#200b10', h: '#fff6b0', t: '#ff2050', k: '#000' }, 2), 104, 18);
      g.drawImage(u.sprite(TRUCK, { c: '#ffd23f', d: '#a08020', w: '#201a0b', h: '#fff6b0', t: '#ff2050', k: '#000', b: '#8a8fc0' }, 2), 68, 6);
    },

    create(api) {
      const { input, clamp, rand, randInt, pick } = api;
      let lane, px, laneFromX, laneT, tilt, cars, items, parts, texts;
      let speed, dist, score, lives, fuel, rowT, inv, crashT, outT, lastShift, posts, fuelBeepT, rowsSinceFuel;

      function reset() {
        lane = 1; px = laneX(1); laneFromX = px; laneT = 1; tilt = 0;
        cars = []; items = []; parts = []; texts = [];
        speed = 260; dist = 0; score = 0; lives = 3; fuel = 100;
        rowT = 1.2; inv = 0; crashT = 0; outT = 0; lastShift = -10; fuelBeepT = 0; rowsSinceFuel = 0;
        posts = [];
        for (let y = -40; y < H + 80; y += 160) posts.push(y);
      }

      const rel = () => speed * 0.62; // how fast traffic approaches

      function shift(d) {
        const nl = clamp(lane + d, 0, LANES - 1);
        if (nl === lane) return;
        laneFromX = px;
        lane = nl;
        laneT = 0;
        tilt = d;
        lastShift = dist;
        api.sfx('blip');
      }

      function spawnRow() {
        // block at most two lanes so there is always a way through
        const blocked = [];
        const n = Math.random() < Math.min(0.15 + dist / 40000, 0.6) ? 2 : 1;
        while (blocked.length < n) {
          const l = randInt(0, LANES - 1);
          if (!blocked.includes(l)) blocked.push(l);
        }
        blocked.forEach((l) => {
          const truck = Math.random() < 0.18;
          const art = truck ? TRUCK : CAR;
          const color = pick(TRAFFIC_COLORS);
          cars.push({
            lane: l, x: laneX(l), y: -art.length * PX, truck,
            h: art.length * PX, w: 12 * PX, color, passed: false,
          });
        });
        rowsSinceFuel++;
        const free = [0, 1, 2, 3].filter((l) => !blocked.includes(l));
        if (rowsSinceFuel >= 5 && Math.random() < 0.5) {
          rowsSinceFuel = 0;
          items.push({ x: laneX(pick(free)), y: -30, kind: 'fuel' });
        } else if (Math.random() < 0.12) {
          items.push({ x: laneX(pick(free)), y: -30, kind: 'star' });
        }
      }

      function burst(x, y, colors, n, sp) {
        for (let i = 0; i < n; i++) {
          const a = rand(0, Math.PI * 2), s = rand(30, sp || 220);
          parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: rand(0.3, 0.8), color: pick(colors) });
        }
      }

      function update(dt) {
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          p.x += p.vx * dt; p.y += p.vy * dt + speed * 0.3 * dt; p.t -= dt;
          if (p.t <= 0) parts.splice(i, 1);
        }
        for (let i = texts.length - 1; i >= 0; i--) { texts[i].y -= 40 * dt; texts[i].t -= dt; if (texts[i].t <= 0) texts.splice(i, 1); }

        // ---- out of fuel / out of cars: coast to a stop
        if (outT > 0) {
          speed = Math.max(0, speed - 400 * dt);
          outT -= dt;
          scroll(dt);
          if (outT <= 0) api.gameOver(score);
          return;
        }

        // ---- input
        const p = input.pointer;
        if (p.justDown) shift(p.x < W / 2 ? -1 : 1);
        else if (input.hit('ArrowLeft', 'KeyA')) shift(-1);
        else if (input.hit('ArrowRight', 'KeyD')) shift(1);

        if (laneT < 1) laneT = Math.min(1, laneT + dt / 0.12);
        const e = 1 - (1 - laneT) * (1 - laneT);
        px = laneFromX + (laneX(lane) - laneFromX) * e;
        tilt *= Math.pow(0.001, dt);

        // ---- speed, fuel, score
        if (crashT > 0) crashT -= dt;
        else speed = Math.min(speed + 5 * dt, 880);
        if (inv > 0) inv -= dt;
        fuel -= 3.4 * dt;
        if (fuel < 25) {
          fuelBeepT -= dt;
          if (fuelBeepT <= 0) { fuelBeepT = 0.6; api.tone({ f: 880, d: 0.05, v: 0.2 }); }
        }
        if (fuel <= 0) { fuel = 0; outT = 2; api.sfx('over'); return; }
        dist += speed * dt;
        score += speed * dt / 20;

        scroll(dt);

        // ---- spawn traffic rows on a timer that tightens with speed
        rowT -= dt;
        if (rowT <= 0) {
          rowT = Math.max(0.48, 1.05 - dist / 60000) * rand(0.9, 1.25);
          spawnRow();
        }

        // ---- collisions
        const pw = 12 * PX - 8, ph = CAR.length * PX - 8;
        for (let i = cars.length - 1; i >= 0; i--) {
          const c = cars[i];
          if (inv <= 0 && Math.abs(c.x - px) < (c.w - 8 + pw) / 2 && Math.abs(c.y + c.h / 2 - PLAYER_Y) < (c.h - 6 + ph) / 2) {
            cars.splice(i, 1);
            burst(c.x, c.y + c.h / 2, [c.color, '#ffd23f', '#fff'], 24);
            burst(px, PLAYER_Y, ['#4ef0ff', '#fff'], 12, 150);
            api.sfx('explode');
            api.shake(8, 0.45);
            lives--;
            if (lives <= 0) { outT = 1.6; return; }
            inv = 2;
            crashT = 1.2;
            speed = Math.max(220, speed * 0.6);
            continue;
          }
          // close call: dodged into the next lane just in time
          if (!c.passed && c.y > PLAYER_Y + ph / 2) {
            c.passed = true;
            if (Math.abs(c.lane - lane) === 1 && dist - lastShift < rel() * 0.45 && inv <= 0) {
              score += 100;
              texts.push({ x: (c.x + px) / 2, y: PLAYER_Y - 30, t: 0.8, s: 'CLOSE! +100', c: '#ffd23f' });
              api.sfx('bonus');
            }
          }
        }

        // ---- pickups
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          if (Math.abs(it.x - px) < 26 && Math.abs(it.y - PLAYER_Y) < 34) {
            items.splice(i, 1);
            if (it.kind === 'fuel') {
              fuel = Math.min(100, fuel + 40);
              texts.push({ x: it.x, y: PLAYER_Y - 40, t: 0.8, s: 'FUEL', c: '#5ee35e' });
              api.sfx('power');
            } else {
              score += 250;
              texts.push({ x: it.x, y: PLAYER_Y - 40, t: 0.8, s: '+250', c: '#ffd23f' });
              api.sfx('bonus');
            }
          }
        }
      }

      function scroll(dt) {
        const r = rel() * dt;
        cars.forEach((c) => { c.y += r; });
        for (let i = cars.length - 1; i >= 0; i--) if (cars[i].y > H + 20) cars.splice(i, 1);
        items.forEach((it) => { it.y += r; });
        for (let i = items.length - 1; i >= 0; i--) if (items[i].y > H + 30) items.splice(i, 1);
        for (let i = 0; i < posts.length; i++) {
          posts[i] += speed * dt;
          if (posts[i] > H + 80) posts[i] -= 160 * posts.length;
        }
      }

      function carSprite(color, truck) {
        const dark = color === '#e0e0f0' ? '#8a8fa8' : 'rgba(0,0,0,0.35)';
        return api.sprite(truck ? TRUCK : CAR, {
          c: color, d: dark, w: '#0b1424', h: '#fff6b0', t: '#ff2050', k: '#000', b: '#9aa0c8',
        }, 1);
      }

      function draw(g, state) {
        const T = api.text;
        // roadside
        g.fillStyle = '#07120c';
        g.fillRect(0, 0, W, H);
        g.fillStyle = '#121220';
        g.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, H);
        const off = dist % 40;
        // rumble strips
        for (let y = -40 + off; y < H; y += 40) {
          g.fillStyle = '#ff4fd8'; g.fillRect(ROAD_L - 6, y, 6, 20);
          g.fillStyle = '#4ef0ff'; g.fillRect(ROAD_R, y, 6, 20);
          g.fillStyle = '#2a2a3c'; g.fillRect(ROAD_L - 6, y + 20, 6, 20); g.fillRect(ROAD_R, y + 20, 6, 20);
        }
        // lane dashes
        g.fillStyle = '#3a3a55';
        const off2 = dist % 60;
        for (let l = 1; l < LANES; l++) {
          const x = ROAD_L + l * LANE_W - 1.5;
          for (let y = -60 + off2; y < H; y += 60) g.fillRect(x, y, 3, 28);
        }
        // street lights
        posts.forEach((y) => {
          [[14, 1], [W - 14, -1]].forEach(([x, s]) => {
            g.fillStyle = 'rgba(255,214,120,0.06)';
            g.beginPath(); g.arc(x + s * 18, y, 46, 0, Math.PI * 2); g.fill();
            g.fillStyle = '#3a3a55'; g.fillRect(x - 2, y - 2, 4, 14);
            g.fillStyle = '#ffd67a'; g.fillRect(x - 3, y - 6, 6, 5);
          });
        });

        // pickups
        items.forEach((it) => {
          if (it.kind === 'fuel') {
            g.fillStyle = '#5ee35e'; g.fillRect(it.x - 10, it.y - 12, 20, 24);
            g.fillStyle = '#1c4a28'; g.fillRect(it.x - 6, it.y - 6, 12, 12);
            g.fillStyle = '#5ee35e'; g.fillRect(it.x - 4, it.y - 16, 8, 5);
            T(g, 'F', it.x, it.y - 4, 1.2, '#5ee35e', 'center');
          } else {
            const s = 9 + Math.sin(dist / 30) * 2;
            g.fillStyle = '#ffd23f';
            g.fillRect(it.x - s, it.y - 2, s * 2, 4); g.fillRect(it.x - 2, it.y - s, 4, s * 2);
            g.fillStyle = '#fff'; g.fillRect(it.x - 3, it.y - 3, 6, 6);
          }
        });

        // traffic
        cars.forEach((c) => {
          const spr = carSprite(c.color, c.truck);
          g.drawImage(spr, Math.round(c.x - c.w / 2), Math.round(c.y), c.w, c.h);
          // tail-light glow
          g.fillStyle = 'rgba(255,32,80,0.18)';
          g.fillRect(c.x - c.w / 2, c.y + c.h, c.w, 8);
        });

        // player car + headlights
        const visible = outT > 0 && lives <= 0 ? false : inv <= 0 || Math.floor(inv * 10) % 2 === 0;
        if (visible) {
          g.fillStyle = 'rgba(255,246,176,0.08)';
          g.beginPath();
          g.moveTo(px - 10, PLAYER_Y - 20); g.lineTo(px - 40, PLAYER_Y - 190); g.lineTo(px + 40, PLAYER_Y - 190); g.lineTo(px + 10, PLAYER_Y - 20);
          g.closePath(); g.fill();
          const spr = carSprite('#4ef0ff', false);
          const w = 12 * PX, h = CAR.length * PX;
          g.save();
          g.translate(px, PLAYER_Y);
          g.rotate(tilt * 0.12);
          g.drawImage(spr, -w / 2, -h / 2, w, h);
          g.restore();
          if (speed > 500 && Math.random() < 0.5) {
            g.fillStyle = '#ff8c42';
            g.fillRect(px - 12, PLAYER_Y + h / 2, 3, rand(2, 7));
            g.fillRect(px + 9, PLAYER_Y + h / 2, 3, rand(2, 7));
          }
        }

        parts.forEach((p) => {
          g.globalAlpha = Math.min(1, p.t * 2.5);
          g.fillStyle = p.color;
          g.fillRect(p.x - 2, p.y - 2, 4, 4);
        });
        g.globalAlpha = 1;
        texts.forEach((t) => T(g, t.s, t.x, t.y, 2, t.c, 'center'));

        // HUD panel
        g.fillStyle = 'rgba(0,0,0,0.55)';
        g.fillRect(0, 0, W, 64);
        T(g, String(Math.floor(score)), 10, 10, 2, '#fff');
        T(g, Math.floor(speed / 3) + ' MPH', W / 2, 10, 2, speed > 700 ? '#ff4fd8' : '#7d81a8', 'center');
        let hearts = '';
        for (let i = 0; i < Math.max(0, lives); i++) hearts += '@';
        T(g, hearts, W - 10, 10, 2, '#ff4d6d', 'right');
        // fuel gauge
        T(g, 'FUEL', 10, 38, 2, fuel < 25 ? '#ff4d6d' : '#5ee35e');
        g.fillStyle = '#222238'; g.fillRect(64, 38, 200, 14);
        const low = fuel < 25 && Math.floor(dist / 80) % 2 === 0;
        g.fillStyle = low ? '#ff4d6d' : fuel < 25 ? '#ff8c42' : '#5ee35e';
        g.fillRect(66, 40, 196 * (fuel / 100), 10);
        T(g, (dist / 5280).toFixed(1) + ' MI', W - 10, 38, 2, '#7d81a8', 'right');

        if (outT > 0) T(g, lives <= 0 ? 'WRECKED!' : 'OUT OF FUEL!', W / 2, 260, 3, '#ff4d6d', 'center');
        else if (dist < 900 && state === 'playing') {
          T(g, api.isTouch ? '{ TAP SIDES }' : '{ ARROWS }', W / 2, 300, 2, '#cfd3ff', 'center');
        }
      }

      return { reset, update, draw, peek: () => ({ lane, cars, items, fuel, lives, score, speed, dist }) };
    },
  });
})();
