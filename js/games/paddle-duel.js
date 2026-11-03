/* PADDLE DUEL - a vertical paddle-and-ball duel against a CPU rival.
   Win a match (first to 7) and the next rival is faster and sharper. */
(function () {
  'use strict';
  const W = 360, H = 640;
  const PW = 72, PH = 10, B = 9;
  const CPU_Y = 72, PLAYER_Y = H - 72;
  const WIN_POINTS = 7;

  // Fold a coordinate back into [lo, hi] as if bouncing between walls.
  function fold(x, lo, hi) {
    const span = hi - lo;
    let m = (x - lo) % (2 * span);
    if (m < 0) m += 2 * span;
    return lo + (m > span ? 2 * span - m : m);
  }

  CG.register({
    id: 'paddle-duel',
    title: 'Paddle Duel',
    tagline: 'Out-rally a CPU rival that sharpens up every match you win.',
    color: '#4ef0ff',
    controls: {
      touch: ['DRAG ANYWHERE TO MOVE', 'EDGE HITS ANGLE THE BALL', 'FIRST TO 7 WINS'],
      keys: ['MOUSE OR { } ARROWS MOVE', 'EDGE HITS ANGLE THE BALL', 'FIRST TO 7 WINS'],
    },

    icon(g, w, h) {
      g.fillStyle = '#1c1c34';
      for (let x = 6; x < w; x += 12) g.fillRect(x, h / 2 - 1, 6, 2);
      g.fillStyle = '#ff4fd8'; g.fillRect(60, 16, 40, 6);
      g.fillStyle = '#4ef0ff'; g.fillRect(44, h - 22, 40, 6);
      g.fillStyle = '#fff'; g.fillRect(92, 70, 6, 6);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(84, 82, 5, 5); g.fillRect(77, 93, 4, 4);
    },

    create(api) {
      const { input, clamp, rand } = api;
      let player, cpu, ball, trail, pScore, cScore, match, score;
      let serveTimer, serveDir, msg, msgT, matchOver, rally;

      function reset() {
        match = 1;
        score = 0;
        newMatch();
      }

      function newMatch() {
        pScore = 0; cScore = 0; matchOver = 0;
        player = { x: W / 2, tx: null, vx: 0 };
        cpu = { x: W / 2, err: 0 };
        msg = 'MATCH ' + match; msgT = 1.6;
        serve(1);
      }

      function serve(dir) {
        ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, speed: 0, live: false };
        trail = [];
        serveDir = dir;
        serveTimer = 1.1;
        rally = 0;
      }

      const ballSpeed = () => Math.min(300 + 18 * (match - 1), 420);
      const cpuSpeed = () => Math.min(250 + 35 * (match - 1), 450);
      const cpuError = () => Math.max(14, 46 - 6 * (match - 1));

      function launch() {
        const a = rand(-0.45, 0.45);
        const s = ballSpeed();
        ball.speed = s;
        ball.vx = Math.sin(a) * s;
        ball.vy = Math.cos(a) * s * serveDir;
        ball.live = true;
        cpu.err = rand(-1, 1) * cpuError();
      }

      function hitPaddle(p, dir) {
        const off = clamp((ball.x - p.x) / (PW / 2 + B / 2), -1, 1);
        const ang = off * 1.0; // up to ~57 degrees
        ball.speed = Math.min(ball.speed + 14, 680);
        let vx = Math.sin(ang) * ball.speed + (p.vx || 0) * 0.12;
        let vy = Math.cos(ang) * ball.speed;
        // never let the ball go too flat (boring side-to-side bounces)
        vx = clamp(vx, -ball.speed * 0.85, ball.speed * 0.85);
        vy = Math.sqrt(Math.max(ball.speed * ball.speed - vx * vx, (ball.speed * 0.5) ** 2));
        ball.vx = vx;
        ball.vy = vy * dir;
        rally++;
        api.sfx('paddle');
        if (p === player) {
          // The CPU aims imperfectly, and gets shakier as rallies get long
          // and the ball gets fast, so every rally eventually ends.
          const fatigue = Math.max(0, ball.speed - 300) * 0.06 + Math.min(rally, 20) * 2;
          cpu.err = rand(-1, 1) * (cpuError() + fatigue);
        }
      }

      function pointWon(byPlayer) {
        ball.live = false;
        if (byPlayer) {
          pScore++;
          score += 100 * match;
          api.sfx('point');
        } else {
          cScore++;
          api.sfx('miss');
          api.shake(4, 0.25);
        }
        if (pScore >= WIN_POINTS) {
          score += 1000 * match;
          msg = 'YOU WIN!'; msgT = 2.2;
          matchOver = 2.2;
          api.sfx('win');
          match++;
        } else if (cScore >= WIN_POINTS) {
          msg = 'CPU WINS'; msgT = 2;
          matchOver = -1.6; // negative = game over countdown
        } else {
          serve(byPlayer ? -1 : 1);
        }
      }

      function update(dt) {
        // ---- player paddle
        const prev = player.x;
        if (input.pointer.moved || input.pointer.justDown) player.tx = input.pointer.x;
        const ax = input.axisX();
        if (ax) { player.tx = null; player.x += ax * 470 * dt; }
        else if (player.tx !== null) {
          const step = 1800 * dt;
          player.x += clamp(player.tx - player.x, -step, step);
        }
        player.x = clamp(player.x, PW / 2, W - PW / 2);
        player.vx = (player.x - prev) / dt;

        // ---- CPU paddle
        let target = W / 2;
        if (ball.live && ball.vy < 0) {
          const t = (CPU_Y + PH / 2 + B / 2 - ball.y) / ball.vy;
          target = fold(ball.x + ball.vx * t, B / 2, W - B / 2) + cpu.err;
        } else if (ball.live) {
          target = W / 2 + (ball.x - W / 2) * 0.35;
        }
        const cs = cpuSpeed() * dt;
        cpu.x = clamp(cpu.x + clamp(target - cpu.x, -cs, cs), PW / 2, W - PW / 2);

        if (msgT > 0) msgT -= dt;

        // ---- match transitions
        if (matchOver > 0) { matchOver -= dt; if (matchOver <= 0) newMatch(); return; }
        if (matchOver < 0) { matchOver += dt; if (matchOver >= 0) api.gameOver(score); return; }

        // ---- ball
        if (!ball.live) {
          serveTimer -= dt;
          if (serveTimer <= 0) launch();
          return;
        }
        trail.push({ x: ball.x, y: ball.y });
        if (trail.length > 6) trail.shift();

        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        if (ball.x < B / 2) { ball.x = B / 2; ball.vx = Math.abs(ball.vx); api.sfx('wall'); }
        else if (ball.x > W - B / 2) { ball.x = W - B / 2; ball.vx = -Math.abs(ball.vx); api.sfx('wall'); }

        if (ball.vy > 0 && ball.y + B / 2 >= PLAYER_Y - PH / 2 && ball.y - B / 2 <= PLAYER_Y + PH / 2 &&
            Math.abs(ball.x - player.x) <= PW / 2 + B / 2) {
          ball.y = PLAYER_Y - PH / 2 - B / 2;
          hitPaddle(player, -1);
        } else if (ball.vy < 0 && ball.y - B / 2 <= CPU_Y + PH / 2 && ball.y + B / 2 >= CPU_Y - PH / 2 &&
            Math.abs(ball.x - cpu.x) <= PW / 2 + B / 2) {
          ball.y = CPU_Y + PH / 2 + B / 2;
          hitPaddle(cpu, 1);
        }

        if (ball.y > H + 20) pointWon(false);
        else if (ball.y < -20) pointWon(true);
      }

      function draw(g, state) {
        const T = api.text;
        // court
        g.fillStyle = '#0b0b18';
        g.fillRect(0, 0, W, H);
        g.fillStyle = '#23233d';
        for (let x = 4; x < W; x += 20) g.fillRect(x, H / 2 - 2, 12, 4);
        g.fillRect(0, 0, 2, H); g.fillRect(W - 2, 0, 2, H);

        // big scores, CPU in upper half, player in lower half
        T(g, String(cScore), 24, H / 2 - 74, 8, 'rgba(255,79,216,0.35)');
        T(g, String(pScore), 24, H / 2 + 22, 8, 'rgba(78,240,255,0.35)');

        // HUD
        T(g, 'MATCH ' + match, 10, 10, 2, '#7d81a8');
        T(g, String(score), W - 10, 10, 2, '#fff', 'right');
        T(g, 'CPU', W - 10, H / 2 - 30, 2, '#ff4fd8', 'right');
        T(g, 'YOU', W - 10, H / 2 + 16, 2, '#4ef0ff', 'right');

        // paddles
        g.fillStyle = '#ff4fd8';
        g.fillRect(cpu.x - PW / 2, CPU_Y - PH / 2, PW, PH);
        g.fillStyle = '#4ef0ff';
        g.fillRect(player.x - PW / 2, PLAYER_Y - PH / 2, PW, PH);

        // ball + trail
        if (ball.live) {
          trail.forEach((p, i) => {
            g.fillStyle = 'rgba(255,255,255,' + (0.05 + i * 0.04) + ')';
            g.fillRect(p.x - B / 2, p.y - B / 2, B, B);
          });
          g.fillStyle = '#fff';
          g.fillRect(ball.x - B / 2, ball.y - B / 2, B, B);
        } else if (matchOver === 0 && Math.floor(serveTimer * 6) % 2 === 0) {
          g.fillStyle = '#fff';
          g.fillRect(ball.x - B / 2, ball.y - B / 2, B, B);
        }

        if (msgT > 0 && state === 'playing') {
          g.fillStyle = 'rgba(0,0,0,0.6)';
          g.fillRect(0, H / 2 - 34, W, 68);
          const col = msg === 'CPU WINS' ? '#ff4d6d' : msg === 'YOU WIN!' ? '#ffd23f' : '#fff';
          T(g, msg, W / 2, H / 2 - 14, 4, col, 'center');
        }
      }

      return { reset, update, draw, peek: () => ({ ball, player, match, pScore, cScore, score }) };
    },
  });
})();
