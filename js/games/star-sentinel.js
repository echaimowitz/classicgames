/* STAR SENTINEL - hold the line against waves of swooping alien drones.
   Your cannon fires automatically: just steer. Shoot a diving Warden for a twin-shot pickup. */
(function () {
  'use strict';
  const W = 360, H = 640;
  const PLAYER_Y = H - 84;
  const SPX = 2.5; // sprite pixel size

  // ---- original sprite designs ('#' = pixel) ----
  const SHIP = [
    '......#......',
    '.....###.....',
    '.....#.#.....',
    '....#####....',
    '.#..#####..#.',
    '.#.#######.#.',
    '#############',
    '###.#####.###',
    '##...###...##',
    '#.....#.....#',
  ];
  const DRONE = [[
    '....###....',
    '..#######..',
    '.##.###.##.',
    '###########',
    '..#.#.#.#..',
    '.#.......#.',
  ], [
    '....###....',
    '..#######..',
    '.##.###.##.',
    '###########',
    '.#.#.#.#.#.',
    '#.........#',
  ]];
  const STINGER = [[
    '#.........#',
    '##...#...##',
    '.##.###.##.',
    '..#######..',
    '...##.##...',
    '....###....',
    '.....#.....',
  ], [
    '...........',
    '#....#....#',
    '##..###..##',
    '.#########.',
    '...##.##...',
    '....###....',
    '.....#.....',
  ]];
  const WARDEN = [[
    '....#####....',
    '..#########..',
    '.###.###.###.',
    '#############',
    '#.#########.#',
    '#..#.....#..#',
    '..##.....##..',
  ], [
    '....#####....',
    '..#########..',
    '.###.###.###.',
    '#############',
    '.###########.',
    '..#.#...#.#..',
    '.#.........#.',
  ]];

  const TYPES = {
    drone:   { frames: DRONE,   color: '#5ee35e', hp: 1, pts: 50,  dive: 100, r: 12 },
    stinger: { frames: STINGER, color: '#ff4d6d', hp: 1, pts: 80,  dive: 160, r: 12 },
    warden:  { frames: WARDEN,  color: '#c77dff', hp: 2, pts: 150, dive: 400, r: 14 },
  };
  // formation rows: [type, first col, last col]
  const ROWS = [['warden', 2, 5], ['stinger', 1, 6], ['stinger', 0, 7], ['drone', 0, 7], ['drone', 0, 7]];
  const SLOT_W = 36, SLOT_H = 32, FORM_TOP = 92;

  function bezier(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  }

  CG.register({
    id: 'star-sentinel',
    title: 'Star Sentinel',
    tagline: 'Alien waves swoop and dive. Your cannon auto-fires: just steer.',
    color: '#c77dff',
    controls: {
      touch: ['DRAG ANYWHERE TO STEER', 'YOUR CANNON AUTO-FIRES', 'DODGE THE DIVERS!'],
      keys: ['MOUSE OR { } ARROWS STEER', 'YOUR CANNON AUTO-FIRES', 'DODGE THE DIVERS!'],
    },

    icon(g, w, h, u) {
      g.fillStyle = '#fff';
      [[12, 20], [140, 12], [30, 90], [150, 70], [70, 8], [110, 100]].forEach(([x, y]) => g.fillRect(x, y, 2, 2));
      for (let c = 0; c < 4; c++) g.drawImage(u.sprite(DRONE[0], '#5ee35e', 2), 28 + c * 28, 46);
      for (let c = 0; c < 2; c++) g.drawImage(u.sprite(WARDEN[0], '#c77dff', 2), 50 + c * 34, 16);
      g.drawImage(u.sprite(STINGER[1], '#ff4d6d', 2), 120, 70);
      g.drawImage(u.sprite(SHIP, '#4ef0ff', 2), 68, h - 26);
      g.fillStyle = '#ffd23f'; g.fillRect(80, 72, 2, 8);
    },

    create(api) {
      const { input, clamp, rand, pick } = api;
      let player, shots, bombs, enemies, parts, stars, pickups;
      let score, lives, wave, waveT, diveT, fireT, swayT, msg, msgT, nextLife, twinT, respawnT, overT;

      // starfield
      stars = [];
      for (let i = 0; i < 70; i++) {
        const layer = Math.random();
        stars.push({ x: rand(0, W), y: rand(0, H), s: 20 + layer * 90, b: layer });
      }

      function reset() {
        score = 0; lives = 3; wave = 0; nextLife = 10000;
        player = { x: W / 2, tx: null, alive: true, inv: 0 };
        shots = []; bombs = []; parts = []; pickups = [];
        twinT = 0; respawnT = 0; overT = 0; swayT = 0; fireT = 0;
        startWave();
      }

      function startWave() {
        wave++;
        enemies = [];
        msg = 'WAVE ' + wave; msgT = 1.8;
        diveT = 2.6;
        const rows = wave === 1 ? ROWS.slice(0, 4) : ROWS;
        let n = 0;
        rows.forEach((row, r) => {
          const [type, c0, c1] = row;
          for (let c = c0; c <= c1; c++) {
            const T = TYPES[type];
            const group = Math.floor(n / 6);
            const fromLeft = group % 2 === 0;
            enemies.push({
              type, T, hp: T.hp + (type === 'drone' && wave >= 6 ? 1 : 0),
              row: r, col: c, x: -50, y: -50,
              state: 'wait', delay: 1.4 + group * 1.25 + (n % 6) * 0.13,
              t: 0, side: fromLeft ? 1 : -1, flash: 0, vx: 0, vy: 0, fired: 0,
            });
            n++;
          }
        });
      }

      function slotPos(e) {
        const sway = Math.sin(swayT * 0.7) * 28;
        const breathe = 1 + Math.sin(swayT * 1.4) * 0.05;
        return {
          x: W / 2 + sway + (e.col - 3.5) * SLOT_W * breathe,
          y: FORM_TOP + e.row * SLOT_H,
        };
      }

      const diveSpeed = () => Math.min(170 + wave * 14, 320);
      const bombSpeed = () => Math.min(190 + wave * 10, 300);

      function startDive(e, follow) {
        e.state = 'dive';
        e.t = 0;
        e.vx = 0;
        e.vy = -90;            // little hop up before swooping down
        e.wob = rand(0.6, 1.2) * (Math.random() < 0.5 ? -1 : 1);
        e.fired = 0;
        e.leader = follow || null;
      }

      function spawnBurst(x, y, color, n, speed) {
        for (let i = 0; i < n; i++) {
          const a = rand(0, Math.PI * 2), s = rand(30, speed || 200);
          parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: rand(0.3, 0.8), color });
        }
      }

      function killPlayer() {
        player.alive = false;
        spawnBurst(player.x, PLAYER_Y, '#4ef0ff', 30, 260);
        spawnBurst(player.x, PLAYER_Y, '#fff', 14, 160);
        api.sfx('die');
        api.shake(8, 0.5);
        lives--;
        twinT = 0;
        if (lives <= 0) overT = 2;
        else respawnT = 1.6;
      }

      function addScore(n) {
        score += n;
        if (score >= nextLife) { lives = Math.min(lives + 1, 6); nextLife += 15000; api.sfx('life'); msg = 'EXTRA SHIP!'; msgT = 1.4; }
      }

      function update(dt) {
        swayT += dt;
        if (msgT > 0) msgT -= dt;
        stars.forEach((s) => { s.y += s.s * dt; if (s.y > H) { s.y = 0; s.x = rand(0, W); } });
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; p.vy *= 0.98; p.t -= dt;
          if (p.t <= 0) parts.splice(i, 1);
        }

        if (overT > 0) { overT -= dt; if (overT <= 0) { api.gameOver(score); return; } }

        // ---- player
        if (player.alive) {
          if (input.pointer.moved || input.pointer.justDown) player.tx = input.pointer.x;
          const ax = input.axisX();
          if (ax) { player.tx = null; player.x += ax * 300 * dt; }
          else if (player.tx !== null) {
            const step = 900 * dt;
            player.x += clamp(player.tx - player.x, -step, step);
          }
          player.x = clamp(player.x, 18, W - 18);
          if (player.inv > 0) player.inv -= dt;
          if (twinT > 0) twinT -= dt;

          fireT -= dt;
          if (fireT <= 0 && msgT < 1.2) {
            fireT = 0.2;
            if (twinT > 0) {
              shots.push({ x: player.x - 9, y: PLAYER_Y - 10 }, { x: player.x + 9, y: PLAYER_Y - 10 });
            } else shots.push({ x: player.x, y: PLAYER_Y - 14 });
            api.sfx('shoot');
          }
        } else if (respawnT > 0) {
          respawnT -= dt;
          if (respawnT <= 0) {
            player.alive = true; player.inv = 2.2; player.x = W / 2; player.tx = null;
            bombs = [];
          }
        }

        // ---- shots
        for (let i = shots.length - 1; i >= 0; i--) {
          shots[i].y -= 600 * dt;
          if (shots[i].y < -10) shots.splice(i, 1);
        }

        // ---- enemies
        diveT -= dt;
        const formation = enemies.filter((e) => e.state === 'form');
        const diving = enemies.filter((e) => e.state === 'dive').length;
        const maxDivers = Math.min(1 + Math.floor(wave / 2), 5);
        if (diveT <= 0 && formation.length && player.alive) {
          diveT = Math.max(0.6, 2.3 - wave * 0.15) * rand(0.7, 1.3);
          if (diving < maxDivers) {
            const leader = pick(formation);
            startDive(leader);
            // Wardens take up to two escorts with them
            if (leader.type === 'warden') {
              formation.filter((e) => e !== leader && e.row === 1 && Math.abs(e.col - leader.col) <= 1)
                .slice(0, 2).forEach((e) => startDive(e, leader));
            }
          }
        }

        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i];
          if (e.flash > 0) e.flash -= dt;
          const slot = slotPos(e);

          if (e.state === 'wait') {
            e.delay -= dt;
            if (e.delay <= 0) { e.state = 'enter'; e.t = 0; }
            continue;
          }
          if (e.state === 'enter') {
            e.t += dt / 1.9;
            const t = Math.min(1, e.t);
            const sx = e.side > 0 ? -30 : W + 30;
            const x1 = e.side > 0 ? W * 0.95 : W * 0.05;
            const x2 = e.side > 0 ? W * 0.1 : W * 0.9;
            e.x = bezier(sx, x1, x2, slot.x, t);
            e.y = bezier(260, 470, 300, slot.y, t);
            if (t >= 1) e.state = 'form';
          } else if (e.state === 'form') {
            e.x = slot.x; e.y = slot.y;
            if (player.alive && Math.random() < dt * (0.03 + wave * 0.012)) {
              bombs.push({ x: e.x, y: e.y + 10, vx: 0, vy: bombSpeed() * 0.8 });
            }
          } else if (e.state === 'dive') {
            e.t += dt;
            if (e.leader && !e.leader.dead && e.leader.state === 'dive') {
              // escorts fly in formation with their warden
              e.x = e.leader.x + (e.col - e.leader.col) * 26;
              e.y = e.leader.y + 26;
            } else {
              e.vy = Math.min(e.vy + 420 * dt, diveSpeed());
              const steer = clamp((player.x - e.x) * 1.4, -150, 150);
              e.vx = steer + Math.cos(e.t * 3.2) * 110 * e.wob;
              e.x += e.vx * dt;
              e.y += e.vy * dt;
            }
            e.x = clamp(e.x, 10, W - 10);
            // fire aimed shots on the way down
            const shotsAllowed = wave < 3 ? 1 : 2;
            if (e.fired < shotsAllowed && e.y > 170 + e.fired * 90 && e.y < PLAYER_Y - 140 && player.alive) {
              e.fired++;
              const dx = player.x - e.x, dy = PLAYER_Y - e.y;
              const len = Math.hypot(dx, dy);
              const s = bombSpeed();
              bombs.push({ x: e.x, y: e.y + 10, vx: (dx / len) * s * 0.6, vy: (dy / len) * s });
            }
            if (e.y > H + 30) { e.state = 'return'; e.y = -30; e.x = slot.x; e.leader = null; }
          } else if (e.state === 'return') {
            const dx = slot.x - e.x, dy = slot.y - e.y;
            const d = Math.hypot(dx, dy);
            const s = 220 * dt;
            if (d <= s) e.state = 'form';
            else { e.x += (dx / d) * s; e.y += (dy / d) * s; }
          }

          // shot vs enemy
          for (let j = shots.length - 1; j >= 0; j--) {
            const s = shots[j];
            if (Math.abs(s.x - e.x) < e.T.r && Math.abs(s.y - e.y) < e.T.r) {
              shots.splice(j, 1);
              e.hp--;
              e.flash = 0.08;
              if (e.hp <= 0) {
                const inAir = e.state === 'dive' || e.state === 'enter';
                const pts = inAir ? e.T.dive : e.T.pts;
                addScore(pts);
                spawnBurst(e.x, e.y, e.T.color, 14);
                spawnBurst(e.x, e.y, '#fff', 5, 120);
                if (inAir && pts >= 150) parts.push({ x: e.x, y: e.y, vx: 0, vy: -30, t: 0.9, text: String(pts) });
                if (e.type === 'warden' && e.state === 'dive') pickups.push({ x: e.x, y: e.y });
                e.dead = true;
                enemies.splice(i, 1);
                api.sfx('hit');
              } else api.sfx('hard');
              break;
            }
          }
          if (!enemies.includes(e)) continue;

          // enemy vs player
          if (player.alive && player.inv <= 0 && Math.abs(e.x - player.x) < 18 && Math.abs(e.y - PLAYER_Y) < 16) {
            spawnBurst(e.x, e.y, e.T.color, 12);
            e.dead = true;
            enemies.splice(i, 1);
            killPlayer();
          }
        }

        // ---- enemy bombs
        for (let i = bombs.length - 1; i >= 0; i--) {
          const b = bombs[i];
          b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.y > H + 10 || b.x < -10 || b.x > W + 10) { bombs.splice(i, 1); continue; }
          if (player.alive && player.inv <= 0 && Math.abs(b.x - player.x) < 11 && Math.abs(b.y - PLAYER_Y) < 12) {
            bombs.splice(i, 1);
            killPlayer();
          }
        }

        // ---- pickups (twin cannon)
        for (let i = pickups.length - 1; i >= 0; i--) {
          const p = pickups[i];
          p.y += 110 * dt;
          if (player.alive && Math.abs(p.x - player.x) < 22 && Math.abs(p.y - PLAYER_Y) < 20) {
            pickups.splice(i, 1);
            twinT = 12;
            addScore(200);
            api.sfx('power');
          } else if (p.y > H + 10) pickups.splice(i, 1);
        }

        // ---- wave cleared
        if (enemies.length === 0 && overT <= 0) {
          addScore(wave * 250);
          api.sfx('level');
          startWave();
        }
      }

      function draw(g, state) {
        const T = api.text;
        g.fillStyle = '#04040c';
        g.fillRect(0, 0, W, H);
        stars.forEach((s) => {
          g.fillStyle = s.b > 0.75 ? '#fff' : s.b > 0.4 ? '#8a8fc0' : '#3d4170';
          g.fillRect(s.x, s.y, s.b > 0.75 ? 2 : 1, s.b > 0.75 ? 2 : 1);
        });

        const frame = Math.floor(swayT * 3) % 2;
        enemies.forEach((e) => {
          if (e.state === 'wait') return;
          let color = e.T.color;
          if (e.type === 'warden' && e.hp < e.T.hp) color = '#ff8c42';
          if (e.flash > 0) color = '#fff';
          const spr = api.sprite(e.T.frames[frame], color, 1);
          const w = spr.width * SPX, h = spr.height * SPX;
          g.drawImage(spr, Math.round(e.x - w / 2), Math.round(e.y - h / 2), w, h);
        });

        shots.forEach((s) => {
          g.fillStyle = '#ffd23f';
          g.fillRect(s.x - 1.5, s.y - 6, 3, 12);
        });
        bombs.forEach((b) => {
          g.fillStyle = Math.floor(swayT * 12) % 2 ? '#ff4d6d' : '#fff';
          g.fillRect(b.x - 2.5, b.y - 5, 5, 10);
        });
        pickups.forEach((p) => {
          g.fillStyle = '#ffd23f';
          g.fillRect(p.x - 12, p.y - 8, 24, 16);
          T(g, 'x2', p.x, p.y - 5, 1.5, '#000', 'center');
        });

        if (player.alive && (player.inv <= 0 || Math.floor(player.inv * 10) % 2 === 0)) {
          const spr = api.sprite(SHIP, twinT > 0 ? '#ffd23f' : '#4ef0ff', 1);
          const w = spr.width * SPX, h = spr.height * SPX;
          g.drawImage(spr, Math.round(player.x - w / 2), Math.round(PLAYER_Y - h / 2), w, h);
          // engine flicker
          g.fillStyle = Math.random() < 0.5 ? '#ff8c42' : '#ffd23f';
          g.fillRect(player.x - 2, PLAYER_Y + h / 2, 4, rand(3, 8));
        }

        parts.forEach((p) => {
          g.globalAlpha = Math.min(1, p.t * 2);
          if (p.text) T(g, p.text, p.x, p.y, 2, '#ffd23f', 'center');
          else { g.fillStyle = p.color; g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }
        });
        g.globalAlpha = 1;

        // HUD
        T(g, String(score), 10, 12, 2, '#fff');
        T(g, 'WAVE ' + wave, W / 2, 12, 2, '#7d81a8', 'center');
        const mini = api.sprite(SHIP, '#4ef0ff', 1);
        for (let i = 0; i < lives - 1; i++) {
          g.drawImage(mini, W - 24 - i * 20, 10, 16, 12);
        }
        if (twinT > 0) T(g, 'TWIN ' + Math.ceil(twinT), 10, H - 30, 2, '#ffd23f');

        if (msgT > 0 && state === 'playing') T(g, msg, W / 2, 330, 4, msg === 'EXTRA SHIP!' ? '#ffd23f' : '#fff', 'center');
      }

      return { reset, update, draw };
    },
  });
})();
