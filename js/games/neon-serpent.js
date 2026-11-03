/* NEON SERPENT - steer a growing light-snake around the grid.
   Eat fruit to grow; every few bites you speed up. Golden fruit is worth more but vanishes. */
(function () {
  'use strict';
  const W = 360, H = 640;
  const CELL = 20, COLS = 17, ROWS = 26;
  const OX = (W - COLS * CELL) / 2, OY = 80;
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };

  CG.register({
    id: 'neon-serpent',
    title: 'Neon Serpent',
    tagline: 'Swipe to slither, eat to grow, and do not bite your own tail.',
    color: '#5ee35e',
    controls: {
      touch: ['SWIPE TO TURN', 'EAT FRUIT TO GROW', 'AVOID WALLS AND TAIL'],
      keys: ['ARROWS OR WASD TO TURN', 'EAT FRUIT TO GROW', 'AVOID WALLS AND TAIL'],
    },

    icon(g, w, h) {
      const cells = [[2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [6, 5], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [10, 5]];
      cells.forEach(([x, y], i) => {
        g.fillStyle = 'hsl(' + (120 + i * 6) + ',85%,' + (40 + i * 3) + '%)';
        g.fillRect(x * 12 + 2, y * 12 + 2, 10, 10);
      });
      g.fillStyle = '#ff4d6d'; g.fillRect(122, 86, 10, 10);
      g.fillStyle = '#ffd23f'; g.fillRect(38, 26, 10, 10);
    },

    create(api) {
      const { input, randInt } = api;
      let snake, dir, queue, grow, food, gold, goldT, eaten, score, moveT, dying, flashT, lastMove;

      function reset() {
        const cy = Math.floor(ROWS / 2) + 4;
        snake = [{ x: 6, y: cy }, { x: 5, y: cy }, { x: 4, y: cy }, { x: 3, y: cy }];
        dir = 'right'; queue = []; grow = 0; eaten = 0; score = 0;
        moveT = 0; dying = 0; flashT = 0; gold = null; goldT = 0; lastMove = 0;
        food = freeCell();
      }

      const level = () => 1 + Math.floor(eaten / 5);
      const speed = () => Math.min(6.5 + (level() - 1) * 0.9, 15); // moves per second

      function freeCell() {
        for (let tries = 0; tries < 500; tries++) {
          const c = { x: randInt(0, COLS - 1), y: randInt(0, ROWS - 1) };
          if (!snake.some((s) => s.x === c.x && s.y === c.y) &&
              !(food && food.x === c.x && food.y === c.y) &&
              !(gold && gold.x === c.x && gold.y === c.y)) return c;
        }
        return { x: 0, y: 0 };
      }

      function step() {
        if (queue.length) dir = queue.shift();
        const [dx, dy] = DIRS[dir];
        const head = { x: snake[0].x + dx, y: snake[0].y + dy };
        // walls
        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return die();
        // tail (the very last segment moves away this step unless we're growing)
        const body = grow > 0 ? snake : snake.slice(0, -1);
        if (body.some((s) => s.x === head.x && s.y === head.y)) return die();

        snake.unshift(head);
        if (grow > 0) grow--; else snake.pop();

        if (head.x === food.x && head.y === food.y) {
          const before = level();
          eaten++;
          grow += 2;
          score += 10 * level();
          food = freeCell();
          if (level() > before) { api.sfx('level'); flashT = 0.5; } else api.sfx('eat');
          if (eaten % 6 === 0 && !gold) { gold = freeCell(); goldT = 6; }
        } else if (gold && head.x === gold.x && head.y === gold.y) {
          score += 50 * level();
          grow += 3;
          gold = null;
          api.sfx('bonus');
        }
      }

      function die() {
        dying = 1.3;
        api.sfx('die');
        api.shake(5, 0.35);
      }

      function update(dt) {
        if (flashT > 0) flashT -= dt;
        if (dying > 0) {
          dying -= dt;
          if (dying <= 0) api.gameOver(score);
          return;
        }
        // queue up to 3 turns so quick swipes / key taps are never lost
        const d = input.dirPressed();
        if (d) {
          const lastDir = queue.length ? queue[queue.length - 1] : dir;
          if (d !== lastDir && d !== OPP[lastDir] && queue.length < 3) queue.push(d);
        }
        if (gold) { goldT -= dt; if (goldT <= 0) gold = null; }
        lastMove += dt;
        moveT += dt;
        const interval = 1 / speed();
        while (moveT >= interval && dying <= 0) {
          moveT -= interval;
          lastMove = 0;
          step();
        }
      }

      function draw(g) {
        const T = api.text;
        g.fillStyle = '#050a07';
        g.fillRect(0, 0, W, H);

        // HUD
        T(g, String(score), 10, 14, 2, '#fff');
        T(g, 'SPEED ' + level(), W / 2, 14, 2, flashT > 0 ? '#ffd23f' : '#7d81a8', 'center');
        T(g, 'LEN ' + snake.length, W - 10, 14, 2, '#5ee35e', 'right');

        // board
        g.fillStyle = '#0b1a10';
        g.fillRect(OX, OY, COLS * CELL, ROWS * CELL);
        g.fillStyle = '#16301e';
        for (let y = 0; y < ROWS; y++) {
          for (let x = 0; x < COLS; x++) g.fillRect(OX + x * CELL + CELL / 2 - 1, OY + y * CELL + CELL / 2 - 1, 2, 2);
        }
        g.strokeStyle = flashT > 0 ? '#ffd23f' : '#2c6b3f';
        g.lineWidth = 3;
        g.strokeRect(OX - 2, OY - 2, COLS * CELL + 4, ROWS * CELL + 4);

        // fruit (pulses)
        const pulse = (Math.sin(performance.now() / 150) + 1) * 1.5;
        g.fillStyle = '#ff4d6d';
        g.fillRect(OX + food.x * CELL + 3 - pulse / 2, OY + food.y * CELL + 3 - pulse / 2, CELL - 6 + pulse, CELL - 6 + pulse);
        g.fillStyle = '#5ee35e';
        g.fillRect(OX + food.x * CELL + CELL / 2, OY + food.y * CELL + 1, 3, 4);
        if (gold && (goldT > 2 || Math.floor(goldT * 8) % 2 === 0)) {
          g.fillStyle = '#ffd23f';
          g.fillRect(OX + gold.x * CELL + 2, OY + gold.y * CELL + 2, CELL - 4, CELL - 4);
          g.fillStyle = '#fff';
          g.fillRect(OX + gold.x * CELL + 5, OY + gold.y * CELL + 5, 4, 4);
        }

        // snake: gradient from bright head to deep tail
        const hidden = dying > 0 && Math.floor(dying * 10) % 2 === 0;
        if (!hidden) {
          const n = snake.length;
          for (let i = n - 1; i >= 0; i--) {
            const s = snake[i];
            const t = i / Math.max(1, n - 1);
            const color = dying > 0 ? '#ff4d6d' : 'hsl(' + Math.round(140 - t * 50) + ',90%,' + Math.round(62 - t * 28) + '%)';
            g.fillStyle = color;
            g.fillRect(OX + s.x * CELL + 1, OY + s.y * CELL + 1, CELL - 2, CELL - 2);
            // connect to the next segment so the body reads as one piece
            if (i > 0) {
              const p = snake[i - 1];
              g.fillRect(OX + Math.min(s.x, p.x) * CELL + 1 + (s.x !== p.x ? CELL / 2 : 0),
                OY + Math.min(s.y, p.y) * CELL + 1 + (s.y !== p.y ? CELL / 2 : 0),
                s.x !== p.x ? CELL - 2 : CELL - 2, s.y !== p.y ? CELL - 2 : CELL - 2);
            }
          }
          // eyes
          const h = snake[0];
          const [dx, dy] = DIRS[dir];
          const cx = OX + h.x * CELL + CELL / 2, cy = OY + h.y * CELL + CELL / 2;
          g.fillStyle = '#000';
          const ex = dy !== 0 ? 4 : 0, ey = dx !== 0 ? 4 : 0;
          g.fillRect(cx + dx * 3 - ex - 2, cy + dy * 3 - ey - 2, 4, 4);
          g.fillRect(cx + dx * 3 + ex - 2, cy + dy * 3 + ey - 2, 4, 4);
        }

        if (eaten === 0 && dying <= 0) {
          T(g, api.isTouch ? 'SWIPE TO TURN' : 'ARROWS TO TURN', W / 2, OY + ROWS * CELL + 12, 2, '#3f7a52', 'center');
        }
      }

      return { reset, update, draw, peek: () => ({ snake, food, gold, score, dir }) };
    },
  });
})();
