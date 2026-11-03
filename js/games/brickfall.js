/* BRICKFALL - smash through hand-built brick layouts.
   Catch falling capsules: W = wide paddle, M = multi-ball, S = slow, @ = extra life. */
(function () {
  'use strict';
  const W = 360, H = 640;
  const COLS = 10, BW = 32, BH = 14, GAP = 2;
  const LEFT = (W - (COLS * (BW + GAP) - GAP)) / 2;
  const TOP = 104;
  const WALL_L = 4, WALL_R = W - 4, WALL_T = 44;
  const PADDLE_Y = H - 76, PH = 10;
  const R = 4; // ball radius (drawn as a square, 8px)

  // '.' empty, '1'-'3' hit points, '#' unbreakable
  const LEVELS = [
    ['..........',
     '1111111111',
     '1111111111',
     '1111111111',
     '1111111111',
     '1111111111'],
    ['....22....',
     '...2112...',
     '..211112..',
     '.21111112.',
     '2111111112',
     '.21111112.',
     '..211112..'],
    ['2222222222',
     '..........',
     '1111111111',
     '1.1.1.1.1.',
     '.1.1.1.1.1',
     '1111111111',
     '..........',
     '3333333333'],
    ['....11....',
     '...1221...',
     '..123321..',
     '.12333321.',
     '..123321..',
     '...1221...',
     '....11....'],
    ['1111111111',
     '1#11##11#1',
     '1111111111',
     '2222222222',
     '##..22..##',
     '1111111111',
     '1111111111'],
    ['1.2.1.2.1.',
     '.2.1.2.1.2',
     '1.2.1.2.1.',
     '.2.1.2.1.2',
     '3.3.3.3.3.',
     '.3.3.3.3.3'],
    ['..222222..',
     '.21111112.',
     '2131111312',
     '2111111112',
     '2131111312',
     '2113333112',
     '.21111112.',
     '..222222..'],
    ['3333333333',
     '3#......#3',
     '3#.2222.#3',
     '3#.2112.#3',
     '3#.2222.#3',
     '3#......#3',
     '3333..3333'],
  ];
  const ROW_COLORS = ['#ff4d6d', '#ff8c42', '#ffd23f', '#5ee35e', '#4ecbff', '#7b8cff', '#c77dff', '#ff4fd8'];
  const CAPS = {
    W: { color: '#4ef0ff', label: 'W' },
    M: { color: '#ffd23f', label: 'M' },
    S: { color: '#5ee35e', label: 'S' },
    L: { color: '#ff4d6d', label: '@' },
  };

  CG.register({
    id: 'brickfall',
    title: 'Brickfall',
    tagline: 'Smash 8 hand-built walls. Catch capsules for multi-ball and more.',
    color: '#ffd23f',
    controls: {
      touch: ['DRAG ANYWHERE TO MOVE', 'TAP TO LAUNCH THE BALL', 'CATCH THE CAPSULES!'],
      keys: ['MOUSE OR { } ARROWS MOVE', 'CLICK OR SPACE TO LAUNCH', 'CATCH THE CAPSULES!'],
    },

    icon(g, w, h) {
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 8; c++) {
          if ((r === 3 && c > 2 && c < 6) || (r === 4 && c > 1 && c < 7)) continue;
          g.fillStyle = ROW_COLORS[r];
          g.fillRect(8 + c * 18, 12 + r * 10, 16, 8);
        }
      }
      g.fillStyle = '#fff'; g.fillRect(84, 78, 6, 6);
      g.fillStyle = '#ffd23f'; g.fillRect(56, h - 18, 44, 6);
      g.fillStyle = '#5ee35e'; g.fillRect(124, 86, 14, 8);
    },

    create(api) {
      const { input, clamp, rand } = api;
      let bricks, balls, caps, parts, paddle, lives, score, level, msg, msgT;
      let wideT, slowT, launchHint, dead;

      function reset() {
        score = 0; lives = 3; level = 0;
        loadLevel();
      }

      function loadLevel() {
        const layout = LEVELS[level % LEVELS.length];
        const extra = Math.floor(level / LEVELS.length); // later loops are tougher
        bricks = [];
        layout.forEach((row, r) => {
          for (let c = 0; c < COLS; c++) {
            const ch = row[c];
            if (ch === '.' || !ch) continue;
            const solid = ch === '#';
            const hp = solid ? Infinity : Math.min(4, parseInt(ch, 10) + extra);
            bricks.push({
              x: LEFT + c * (BW + GAP), y: TOP + r * (BH + GAP),
              hp, max: hp, solid, color: ROW_COLORS[r % ROW_COLORS.length], flash: 0,
            });
          }
        });
        caps = []; parts = [];
        paddle = paddle || { x: W / 2, tx: null, w: 64 };
        paddle.w = 64;
        wideT = 0; slowT = 0; dead = 0;
        msg = 'LEVEL ' + (level + 1); msgT = 1.6;
        newBall();
      }

      const baseSpeed = () => Math.min(330 + level * 16, 480);

      function newBall() {
        balls = [{ x: paddle.x, y: PADDLE_Y - PH / 2 - R, vx: 0, vy: 0, speed: baseSpeed(), stuck: true, off: 0 }];
        launchHint = 0;
      }

      function launch(b) {
        const a = rand(-0.35, 0.35);
        b.vx = Math.sin(a) * b.speed;
        b.vy = -Math.cos(a) * b.speed;
        b.stuck = false;
        api.sfx('paddle');
      }

      function burst(x, y, color, n) {
        for (let i = 0; i < n; i++) {
          const a = rand(0, Math.PI * 2), s = rand(40, 180);
          parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: rand(0.3, 0.6), color });
        }
      }

      function hitBrick(br, ball) {
        if (br.solid) { api.sfx('hard'); br.flash = 0.12; return; }
        br.hp--;
        br.flash = 0.1;
        score += 10;
        ball.speed = Math.min(ball.speed + 3, 600);
        if (br.hp <= 0) {
          score += 25 * br.max;
          bricks.splice(bricks.indexOf(br), 1);
          burst(br.x + BW / 2, br.y + BH / 2, br.color, 8);
          api.sfx('brick');
          if (caps.length < 2 && Math.random() < 0.15) {
            const roll = Math.random();
            const type = roll < 0.08 ? 'L' : roll < 0.4 ? 'M' : roll < 0.7 ? 'W' : 'S';
            caps.push({ x: br.x + BW / 2, y: br.y + BH / 2, type });
          }
        } else api.sfx('hard');
      }

      function collideBricks(b) {
        for (let i = 0; i < bricks.length; i++) {
          const br = bricks[i];
          if (b.x + R <= br.x || b.x - R >= br.x + BW || b.y + R <= br.y || b.y - R >= br.y + BH) continue;
          // overlap depth on each axis decides which face we hit
          const ox = Math.min(b.x + R - br.x, br.x + BW - (b.x - R));
          const oy = Math.min(b.y + R - br.y, br.y + BH - (b.y - R));
          if (ox < oy) {
            b.vx = b.x < br.x + BW / 2 ? -Math.abs(b.vx) : Math.abs(b.vx);
            b.x += b.vx > 0 ? ox : -ox;
          } else {
            b.vy = b.y < br.y + BH / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);
            b.y += b.vy > 0 ? oy : -oy;
          }
          hitBrick(br, b);
          return; // one brick per step keeps bounces clean
        }
      }

      function setVel(b) {
        // re-normalise to the ball's speed, keep it from going too flat
        const len = Math.hypot(b.vx, b.vy) || 1;
        b.vx = (b.vx / len) * b.speed;
        b.vy = (b.vy / len) * b.speed;
        const minVy = b.speed * 0.3;
        if (Math.abs(b.vy) < minVy) {
          b.vy = (b.vy < 0 ? -1 : 1) * minVy;
          b.vx = Math.sign(b.vx || 1) * Math.sqrt(b.speed * b.speed - minVy * minVy);
        }
      }

      function update(dt) {
        if (msgT > 0) msgT -= dt;
        // particles always animate
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.t -= dt;
          if (p.t <= 0) parts.splice(i, 1);
        }
        bricks.forEach((br) => { if (br.flash > 0) br.flash -= dt; });

        if (dead > 0) {
          dead -= dt;
          if (dead <= 0) {
            if (lives <= 0) { api.gameOver(score); return; }
            paddle.w = 64; wideT = 0; slowT = 0; caps = [];
            newBall();
          }
          return;
        }

        // ---- paddle
        if (input.pointer.moved || input.pointer.justDown) paddle.tx = input.pointer.x;
        const ax = input.axisX();
        if (ax) { paddle.tx = null; paddle.x += ax * 480 * dt; }
        else if (paddle.tx !== null) {
          const step = 1900 * dt;
          paddle.x += clamp(paddle.tx - paddle.x, -step, step);
        }
        if (wideT > 0) { wideT -= dt; if (wideT <= 0) paddle.w = 64; }
        if (slowT > 0) slowT -= dt;
        paddle.x = clamp(paddle.x, WALL_L + paddle.w / 2, WALL_R - paddle.w / 2);

        // ---- launch stuck ball
        const wantLaunch = input.action() || input.hit('ArrowUp', 'KeyW');
        launchHint += dt;
        balls.forEach((b) => {
          if (!b.stuck) return;
          b.x = paddle.x + b.off;
          b.y = PADDLE_Y - PH / 2 - R;
          if (wantLaunch) launch(b);
        });

        // ---- balls
        const k = slowT > 0 ? 0.65 : 1;
        for (let i = balls.length - 1; i >= 0; i--) {
          const b = balls[i];
          if (b.stuck) continue;
          b.x += b.vx * dt * k;
          b.y += b.vy * dt * k;

          if (b.x - R < WALL_L) { b.x = WALL_L + R; b.vx = Math.abs(b.vx); api.sfx('wall'); }
          if (b.x + R > WALL_R) { b.x = WALL_R - R; b.vx = -Math.abs(b.vx); api.sfx('wall'); }
          if (b.y - R < WALL_T) { b.y = WALL_T + R; b.vy = Math.abs(b.vy); api.sfx('wall'); }

          // paddle bounce: where it lands on the paddle sets the angle
          if (b.vy > 0 && b.y + R >= PADDLE_Y - PH / 2 && b.y - R <= PADDLE_Y + PH / 2 &&
              b.x + R >= paddle.x - paddle.w / 2 && b.x - R <= paddle.x + paddle.w / 2) {
            const off = clamp((b.x - paddle.x) / (paddle.w / 2 + R), -1, 1);
            const ang = off * 1.1;
            b.vx = Math.sin(ang) * b.speed;
            b.vy = -Math.cos(ang) * b.speed;
            b.y = PADDLE_Y - PH / 2 - R;
            api.sfx('paddle');
          }

          collideBricks(b);
          setVel(b);

          if (b.y - R > H) balls.splice(i, 1);
        }

        if (balls.length === 0) {
          lives--;
          api.sfx(lives > 0 ? 'miss' : 'die');
          api.shake(5, 0.35);
          dead = lives > 0 ? 1.0 : 1.2;
          return;
        }

        // ---- capsules
        for (let i = caps.length - 1; i >= 0; i--) {
          const c = caps[i];
          c.y += 130 * dt;
          if (c.y + 7 >= PADDLE_Y - PH / 2 && c.y - 7 <= PADDLE_Y + PH / 2 &&
              Math.abs(c.x - paddle.x) <= paddle.w / 2 + 12) {
            caps.splice(i, 1);
            score += 50;
            if (c.type === 'W') { paddle.w = 100; wideT = 15; api.sfx('power'); }
            else if (c.type === 'S') { slowT = 10; api.sfx('power'); }
            else if (c.type === 'L') { lives = Math.min(lives + 1, 6); api.sfx('life'); }
            else if (c.type === 'M') {
              api.sfx('power');
              const src = balls.find((b) => !b.stuck) || balls[0];
              if (src.stuck) launch(src);
              [-0.5, 0.5].forEach((da) => {
                const a = Math.atan2(src.vx, -src.vy) + da;
                balls.push({ x: src.x, y: src.y, vx: Math.sin(a) * src.speed, vy: -Math.abs(Math.cos(a) * src.speed), speed: src.speed, stuck: false, off: 0 });
              });
            }
          } else if (c.y > H + 10) caps.splice(i, 1);
        }

        // ---- level clear?
        if (!bricks.some((br) => !br.solid)) {
          score += 500 * (level + 1);
          api.sfx('level');
          level++;
          loadLevel();
        }
      }

      function drawBrick(g, br) {
        if (br.solid) {
          g.fillStyle = br.flash > 0 ? '#fff' : '#6b6f8a';
          g.fillRect(br.x, br.y, BW, BH);
          g.fillStyle = '#a3a7c4'; g.fillRect(br.x, br.y, BW, 2);
          g.fillStyle = '#40435a'; g.fillRect(br.x, br.y + BH - 2, BW, 2);
          return;
        }
        g.fillStyle = br.flash > 0 ? '#fff' : br.color;
        g.fillRect(br.x, br.y, BW, BH);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(br.x, br.y, BW, 2);
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.fillRect(br.x, br.y + BH - 2, BW, 2);
        // tougher bricks show dark "rivets", one per extra hit point
        g.fillStyle = 'rgba(0,0,0,0.55)';
        for (let i = 1; i < br.hp; i++) g.fillRect(br.x + 5 + (i - 1) * 8, br.y + 5, 4, 4);
      }

      function draw(g, state) {
        const T = api.text;
        g.fillStyle = '#0a0a16';
        g.fillRect(0, 0, W, H);
        // walls
        g.fillStyle = '#2a2a48';
        g.fillRect(0, WALL_T - 4, W, 4);
        g.fillRect(0, WALL_T - 4, WALL_L, H);
        g.fillRect(WALL_R, WALL_T - 4, W - WALL_R, H);

        // HUD
        T(g, String(score), 10, 12, 2, '#fff');
        T(g, 'LV ' + (level + 1), W / 2, 12, 2, '#7d81a8', 'center');
        let hearts = '';
        for (let i = 0; i < Math.max(0, lives); i++) hearts += '@';
        T(g, hearts, W - 10, 12, 2, '#ff4d6d', 'right');

        bricks.forEach((br) => drawBrick(g, br));

        // capsules
        caps.forEach((c) => {
          const info = CAPS[c.type];
          g.fillStyle = info.color;
          g.fillRect(c.x - 12, c.y - 7, 24, 14);
          g.fillStyle = 'rgba(0,0,0,0.35)';
          g.fillRect(c.x - 12, c.y + 4, 24, 3);
          T(g, info.label, c.x, c.y - 5, 1.5, '#000', 'center');
        });

        // paddle
        if (dead <= 0 || lives > 0) {
          const pw = paddle.w;
          g.fillStyle = slowT > 0 ? '#5ee35e' : '#ffd23f';
          g.fillRect(paddle.x - pw / 2, PADDLE_Y - PH / 2, pw, PH);
          g.fillStyle = '#fff';
          g.fillRect(paddle.x - pw / 2, PADDLE_Y - PH / 2, pw, 2);
          g.fillStyle = '#ff8c42';
          g.fillRect(paddle.x - pw / 2, PADDLE_Y - PH / 2, 6, PH);
          g.fillRect(paddle.x + pw / 2 - 6, PADDLE_Y - PH / 2, 6, PH);
        }

        // balls
        if (dead <= 0) {
          g.fillStyle = '#fff';
          balls.forEach((b) => g.fillRect(b.x - R, b.y - R, R * 2, R * 2));
        }

        parts.forEach((p) => {
          g.globalAlpha = Math.min(1, p.t * 2.5);
          g.fillStyle = p.color;
          g.fillRect(p.x - 2, p.y - 2, 4, 4);
        });
        g.globalAlpha = 1;

        // power-up timers
        let y = H - 40;
        if (wideT > 0) { T(g, 'WIDE ' + Math.ceil(wideT), 10, y, 2, '#4ef0ff'); }
        if (slowT > 0) { T(g, 'SLOW ' + Math.ceil(slowT), W - 10, y, 2, '#5ee35e', 'right'); }

        if (dead <= 0 && balls.length && balls[0].stuck && msgT <= 0 && Math.floor(launchHint * 2) % 2 === 0) {
          T(g, api.isTouch ? 'TAP TO LAUNCH' : 'SPACE TO LAUNCH', W / 2, PADDLE_Y - 60, 2, '#cfd3ff', 'center');
        }
        if (msgT > 0 && state === 'playing') T(g, msg, W / 2, 300, 4, '#fff', 'center');
      }

      return { reset, update, draw, peek: () => ({ balls, paddle, level, lives, score, bricks: bricks.length }) };
    },
  });
})();
