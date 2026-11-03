/* MAZE BANDIT - sneak through the vault and grab every coin.
   Four guard robots hunt you, each with its own personality:
     HOUND (red) follows your exact trail, SLY (pink) cuts you off ahead,
     ROVER (orange) wanders until it spots you, SENTRY (cyan, level 2+) patrols then pounces.
   Grab a FREEZE STAR to lock every guard in ice: frozen guards are harmless. */
(function () {
  'use strict';
  const W = 360, H = 640;
  const CELL = 24, COLS = 15, ROWS = 21;
  const OX = 0, OY = 74;
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const ORDER = ['up', 'left', 'down', 'right'];

  // Left halves (columns 0-7); each maze is mirrored to 15 columns.
  // '#' wall, '.' coin, 'o' freeze star, '-' guard pen (empty), 'P' player start.
  const HALVES = [
    ["########", "#o.....#", "#.##.#.#", "#.......", "#.##.###", "#....#..", "####.#.#", "####...-", "####.#--", "####.###", "#.......", "#.##.#.#", "#..#.#..", "##.#.#.#", "#.......", "#.###.#.", "#.......", "#.#.##.#", "#o#....P", "#.....##", "########"],
    ["########", "#o......", "#.#.###.", "#.#...#.", "#.###.#.", "#.......", "###.#.##", "###.#..-", "#...#.--", "#.#.#.##", "#.#.....", "#.#.###.", "#.......", "#.##.#.#", "#.#..#..", "#.#.##.#", "#......P", "#.###.#.", "#o..#.#.", "###.....", "########"],
    ["########", "#o..#...", "#.#.#.#.", "#.#.....", "#.###.##", "#.......", "#.#.##.#", "#.#..#.-", "#.##.#--", "#....###", "##.#....", "#..#.#.#", "#.##.#.#", "#......P", "#.##.###", "#.#.....", "#.#.#.#.", "#...#.#.", "#o#...#.", "#...#...", "########"]
  ];
  const MAZES = HALVES.map((m) => m.map((r) => r + r.slice(0, 7).split('').reverse().join('')));

  const BANDIT = [[
    '...yyyy...',
    '..yyyyyy..',
    '.yyyyyyyy.',
    '.kkkkkkkk.',
    '.kwkkkkwk.',
    '.yyyyyyyy.',
    '.yyyyyyyy.',
    '..yyyyyy..',
    '..y....y..',
    '.yy....yy.',
  ], [
    '...yyyy...',
    '..yyyyyy..',
    '.yyyyyyyy.',
    '.kkkkkkkk.',
    '.kwkkkkwk.',
    '.yyyyyyyy.',
    '.yyyyyyyy.',
    '..yyyyyy..',
    '...y..y...',
    '..yy..yy..',
  ]];
  const ROBOT = [[
    '....b.....',
    '...bbb....',
    '..bbbbbb..',
    '.bwwbbwwb.',
    '.bwwbbwwb.',
    '.bbbbbbbb.',
    '.bkbkbkbb.',
    '.bbbbbbbb.',
    '.b.b..b.b.',
    'b..b..b..b',
  ], [
    '.....b....',
    '....bbb...',
    '..bbbbbb..',
    '.bwwbbwwb.',
    '.bwwbbwwb.',
    '.bbbbbbbb.',
    '.bbkbkbkb.',
    '.bbbbbbbb.',
    '..b.bb.b..',
    '.b..bb..b.',
  ]];
  const GUARDS = [
    { kind: 'hound', color: '#ff4d6d', release: 0.5, corner: [13, 1] },
    { kind: 'sly', color: '#ff4fd8', release: 3, corner: [1, 1] },
    { kind: 'rover', color: '#ff8c42', release: 6, corner: [1, 19] },
    { kind: 'sentry', color: '#4ef0ff', release: 9, corner: [13, 19], minLevel: 2 },
  ];
  // global rhythm: guards back off to their corners now and then
  const MODES = [['scatter', 5], ['chase', 20], ['scatter', 5], ['chase', 22], ['scatter', 4], ['chase', 1e9]];

  CG.register({
    id: 'maze-bandit',
    title: 'Maze Bandit',
    tagline: 'Grab every coin in the vault while four guard robots hunt you.',
    color: '#ff8c42',
    controls: {
      touch: ['SWIPE TO CHANGE DIRECTION', 'GRAB EVERY COIN', 'STARS FREEZE THE GUARDS'],
      keys: ['ARROWS OR WASD TO MOVE', 'GRAB EVERY COIN', 'STARS FREEZE THE GUARDS'],
    },

    icon(g, w, h, u) {
      g.fillStyle = '#1a1a4a';
      [[0, 0, 160, 8], [0, 112, 160, 8], [0, 0, 8, 120], [152, 0, 8, 120], [28, 30, 40, 14], [92, 30, 40, 14], [28, 76, 40, 14], [92, 76, 40, 14]]
        .forEach(([x, y, ww, hh]) => g.fillRect(x, y, ww, hh));
      g.strokeStyle = '#4b5cff'; g.lineWidth = 2;
      [[28, 30, 40, 14], [92, 30, 40, 14], [28, 76, 40, 14], [92, 76, 40, 14]].forEach(([x, y, ww, hh]) => g.strokeRect(x, y, ww, hh));
      g.fillStyle = '#ffd23f';
      for (let x = 20; x < 150; x += 12) g.fillRect(x, 58, 3, 3);
      g.drawImage(u.sprite(BANDIT[0], { y: '#ffd23f', k: '#222', w: '#fff' }, 2), 36, 50);
      g.drawImage(u.sprite(ROBOT[0], { b: '#ff4d6d', w: '#fff', k: '#600' }, 2), 108, 50);
    },

    create(api) {
      const { input, rand, pick } = api;
      let grid, coins, coinsLeft, player, guards, level, score, lives;
      let wantDir, freezeT, readyT, caughtT, clearT, modeI, modeT, treasure, treasureT, coinsEaten, mazeCanvas, chain;
      let distMap = null, distFrom = '', startP = null;

      function reset() {
        level = 1; score = 0; lives = 3;
        loadLevel();
      }

      function loadLevel() {
        const rows = MAZES[(level - 1) % MAZES.length];
        grid = rows.map((r) => r.split(''));
        coinsLeft = 0;
        coinsEaten = 0;
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (grid[y][x] === '.') coinsLeft++;
        treasure = null; treasureT = 0;
        for (const k in cornerMaps) delete cornerMaps[k];
        startP = findChar('P');
        grid[startP[1]][startP[0]] = ' ';
        mazeCanvas = renderMaze();
        resetPositions();
      }

      function findChar(ch) {
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (grid[y][x] === ch) return [x, y];
        return null;
      }

      function resetPositions() {
        const [px, py] = startP;
        player = { cx: px, cy: py, dir: null, face: 'left', prog: 0, speed: 6.2, start: [px, py], anim: 0 };
        wantDir = null;
        const pen = [];
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (grid[y][x] === '-') pen.push([x, y]);
        pen.sort((a, b) => a[1] - b[1] || Math.abs(a[0] - 7) - Math.abs(b[0] - 7));
        guards = GUARDS.filter((gd) => !gd.minLevel || level >= gd.minLevel).map((gd, i) => {
          const [x, y] = pen[i % pen.length];
          return Object.assign({}, gd, { cx: x, cy: y, dir: null, prog: 0, wait: gd.release, mode: 'chase', anim: rand(0, 1) });
        });
        freezeT = 0; readyT = 1.6; caughtT = 0; clearT = 0; modeI = 0; modeT = MODES[0][1]; chain = 0;
        distMap = null; distFrom = '';
      }

      const isOpen = (x, y) => x >= 0 && x < COLS && y >= 0 && y < ROWS && grid[y][x] !== '#';
      const canGo = (e, d) => isOpen(e.cx + DIRS[d][0], e.cy + DIRS[d][1]);
      const guardSpeed = () => Math.min(4.3 + (level - 1) * 0.3, 6.0);

      // breadth-first "how many steps from here" maps, used for real path-finding
      function bfsFrom(sx, sy) {
        const m = new Array(COLS * ROWS).fill(1e9);
        const q = [[sx, sy]];
        m[sy * COLS + sx] = 0;
        for (let i = 0; i < q.length; i++) {
          const [x, y] = q[i];
          const d = m[y * COLS + x];
          for (const k of ORDER) {
            const nx = x + DIRS[k][0], ny = y + DIRS[k][1];
            if (isOpen(nx, ny) && m[ny * COLS + nx] > d + 1) { m[ny * COLS + nx] = d + 1; q.push([nx, ny]); }
          }
        }
        return m;
      }
      function playerDist() {
        const key = player.cx + ',' + player.cy;
        if (!distMap || distFrom !== key) { distFrom = key; distMap = bfsFrom(player.cx, player.cy); }
        return distMap;
      }
      const cornerMaps = {};
      function cornerDist(gd) {
        const key = gd.corner.join(',');
        return cornerMaps[key] || (cornerMaps[key] = bfsFrom(gd.corner[0], gd.corner[1]));
      }

      function chooseGuardDir(gd) {
        let opts = ORDER.filter((d) => canGo(gd, d) && d !== OPP[gd.dir]);
        if (!opts.length) opts = ORDER.filter((d) => canGo(gd, d));
        if (opts.length <= 1) return opts[0] || null;
        const dm = playerDist();
        const bfs = (d) => dm[(gd.cy + DIRS[d][1]) * COLS + gd.cx + DIRS[d][0]];
        const greedy = (tx, ty) => (d) => (gd.cx + DIRS[d][0] - tx) ** 2 + (gd.cy + DIRS[d][1] - ty) ** 2;
        const best = (score) => opts.reduce((a, b) => (score(b) < score(a) ? b : a));
        const here = dm[gd.cy * COLS + gd.cx];

        if (gd.mode === 'scatter') {
          const cm = cornerDist(gd);
          return best((d) => cm[(gd.cy + DIRS[d][1]) * COLS + gd.cx + DIRS[d][0]]);
        }
        if (gd.kind === 'hound') return best(bfs);
        if (gd.kind === 'sly') {
          const [dx, dy] = DIRS[player.dir || player.face] || [0, 0];
          if (here <= 3) return best(bfs);
          return best(greedy(player.cx + dx * 4, player.cy + dy * 4));
        }
        if (gd.kind === 'rover') {
          if (here <= 6) return best(bfs);
          return pick(opts);
        }
        // sentry: patrols its corner, pounces when you come within range
        if (here <= 8) return best(bfs);
        return Math.random() < 0.5 ? pick(opts) : best(greedy(gd.corner[0], gd.corner[1]));
      }

      function choosePlayerDir() {
        if (wantDir && canGo(player, wantDir)) return wantDir;
        if (player.dir && canGo(player, player.dir)) return player.dir;
        return null;
      }

      // grid-locked movement: entities travel centre-to-centre, choosing at each centre
      function move(e, dist, choose) {
        let guard = 0;
        while (dist > 1e-9 && guard++ < 8) {
          if (e.prog === 0) {
            const nd = choose(e);
            if (!nd) { e.dir = null; return; }
            e.dir = nd;
          }
          const step = Math.min(dist, 1 - e.prog);
          e.prog += step;
          dist -= step;
          if (e.prog >= 1 - 1e-9) {
            e.cx += DIRS[e.dir][0];
            e.cy += DIRS[e.dir][1];
            e.prog = 0;
            if (e === player) arrive();
          }
        }
      }

      function arrive() {
        const c = grid[player.cy][player.cx];
        if (c === '.') {
          grid[player.cy][player.cx] = ' ';
          coinsLeft--; coinsEaten++;
          score += 10;
          chain = Math.min(chain + 1, 24);
          api.tone({ f: 500 + chain * 18, d: 0.04, v: 0.25 });
          if (coinsEaten === 60 && !treasure) { treasure = player.start.slice(); treasureT = 9; }
        } else if (c === 'o') {
          grid[player.cy][player.cx] = ' ';
          score += 50;
          freezeT = Math.max(3, 7 - level * 0.5);
          api.sfx('power');
        }
        if (treasure && player.cx === treasure[0] && player.cy === treasure[1]) {
          score += 500 * level;
          treasure = null;
          api.sfx('bonus');
        }
      }

      const pos = (e) => {
        const [dx, dy] = e.dir ? DIRS[e.dir] : [0, 0];
        return [e.cx + dx * e.prog, e.cy + dy * e.prog];
      };

      function update(dt) {
        if (readyT > 0) { readyT -= dt; return; }
        if (clearT > 0) {
          clearT -= dt;
          if (clearT <= 0) { level++; lives = Math.min(lives + 1, 5); loadLevel(); }
          return;
        }
        if (caughtT > 0) {
          caughtT -= dt;
          if (caughtT <= 0) {
            if (lives <= 0) api.gameOver(score);
            else resetPositions();
          }
          return;
        }

        // ---- input: remember the latest requested direction
        const d = input.dirPressed();
        if (d) wantDir = d;
        if (input.held('ArrowUp', 'KeyW')) wantDir = 'up';
        else if (input.held('ArrowDown', 'KeyS')) wantDir = 'down';
        else if (input.held('ArrowLeft', 'KeyA')) wantDir = 'left';
        else if (input.held('ArrowRight', 'KeyD')) wantDir = 'right';

        // instant reverse in the middle of a corridor
        if (wantDir && player.dir && wantDir === OPP[player.dir] && player.prog > 0) {
          player.cx += DIRS[player.dir][0];
          player.cy += DIRS[player.dir][1];
          player.dir = wantDir;
          player.prog = 1 - player.prog;
        }
        const wasMoving = !!player.dir;
        move(player, player.speed * dt, choosePlayerDir);
        if (player.dir) { player.face = player.dir; player.anim += dt; }
        if (wasMoving && !player.dir) chain = 0;

        // ---- guard rhythm
        modeT -= dt;
        if (modeT <= 0 && modeI < MODES.length - 1) {
          modeI++; modeT = MODES[modeI][1];
          // guards turn around when the mode changes (a fair "tell")
          guards.forEach((gd) => { if (gd.wait <= 0 && gd.dir && gd.prog > 0) { gd.cx += DIRS[gd.dir][0]; gd.cy += DIRS[gd.dir][1]; gd.dir = OPP[gd.dir]; gd.prog = 1 - gd.prog; } });
        }
        if (freezeT > 0) freezeT -= dt;
        if (treasure) { treasureT -= dt; if (treasureT <= 0) treasure = null; }

        const [px, py] = pos(player);
        guards.forEach((gd) => {
          gd.anim += dt;
          gd.mode = MODES[modeI][0];
          if (gd.wait > 0) { gd.wait -= dt; return; }
          if (freezeT <= 0) {
            const sp = guardSpeed() * (gd.kind === 'hound' ? 0.92 : 1);
            move(gd, sp * dt, chooseGuardDir);
          }
          const [gx, gy] = pos(gd);
          if (freezeT <= 0 && Math.abs(gx - px) < 0.6 && Math.abs(gy - py) < 0.6) {
            lives--;
            caughtT = 1.6;
            api.sfx('die');
            api.shake(6, 0.4);
          }
        });
        if (caughtT > 0) return;

        if (coinsLeft <= 0) {
          score += 1000 * level;
          clearT = 2;
          api.sfx('level');
        }
      }

      function renderMaze() {
        const c = document.createElement('canvas');
        const S = 2;
        c.width = COLS * CELL * S; c.height = ROWS * CELL * S;
        const g = c.getContext('2d');
        g.scale(S, S);
        const hue = ['#4b5cff', '#c77dff', '#5ee35e'][(level - 1) % 3];
        for (let y = 0; y < ROWS; y++) {
          for (let x = 0; x < COLS; x++) {
            if (grid[y][x] !== '#') continue;
            const X = x * CELL, Y = y * CELL;
            g.fillStyle = '#12123a';
            g.fillRect(X, Y, CELL, CELL);
            g.fillStyle = hue;
            const wall = (dx, dy) => { const nx = x + dx, ny = y + dy; return nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS || grid[ny][nx] === '#'; };
            if (!wall(0, -1)) g.fillRect(X, Y, CELL, 3);
            if (!wall(0, 1)) g.fillRect(X, Y + CELL - 3, CELL, 3);
            if (!wall(-1, 0)) g.fillRect(X, Y, 3, CELL);
            if (!wall(1, 0)) g.fillRect(X + CELL - 3, Y, 3, CELL);
          }
        }
        return c;
      }

      function draw(g, state) {
        const T = api.text;
        const now = performance.now() / 1000;
        g.fillStyle = '#06060f';
        g.fillRect(0, 0, W, H);
        g.drawImage(mazeCanvas, OX, OY, COLS * CELL, ROWS * CELL);

        // coins + stars
        for (let y = 0; y < ROWS; y++) {
          for (let x = 0; x < COLS; x++) {
            const c = grid[y][x];
            const X = OX + x * CELL + CELL / 2, Y = OY + y * CELL + CELL / 2;
            if (c === '.') { g.fillStyle = '#ffd23f'; g.fillRect(X - 2, Y - 2, 4, 4); }
            else if (c === 'o') {
              const s = Math.floor(now * 4) % 2 ? 7 : 5;
              g.fillStyle = '#9ad8ff';
              g.fillRect(X - s, Y - 1.5, s * 2, 3); g.fillRect(X - 1.5, Y - s, 3, s * 2);
              g.fillStyle = '#fff'; g.fillRect(X - 2.5, Y - 2.5, 5, 5);
            }
          }
        }
        if (treasure && (treasureT > 2 || Math.floor(treasureT * 8) % 2 === 0)) {
          const X = OX + treasure[0] * CELL + CELL / 2, Y = OY + treasure[1] * CELL + CELL / 2;
          g.fillStyle = '#ff4fd8';
          g.beginPath(); g.moveTo(X, Y - 9); g.lineTo(X + 8, Y - 2); g.lineTo(X, Y + 9); g.lineTo(X - 8, Y - 2); g.closePath(); g.fill();
          g.fillStyle = '#fff'; g.fillRect(X - 3, Y - 4, 3, 3);
        }

        // guards
        guards.forEach((gd) => {
          const [gx, gy] = pos(gd);
          const X = OX + gx * CELL + CELL / 2, Y = OY + gy * CELL + CELL / 2;
          let col = gd.color;
          if (freezeT > 0) col = freezeT < 1.5 && Math.floor(now * 8) % 2 ? '#fff' : '#9ad8ff';
          const frame = freezeT > 0 ? 0 : Math.floor(gd.anim * 6) % 2;
          const spr = api.sprite(ROBOT[frame], { b: col, w: '#fff', k: 'rgba(0,0,0,0.5)' }, 1);
          const bob = gd.wait > 0 ? Math.sin(gd.anim * 6) * 1.5 : 0;
          g.drawImage(spr, Math.round(X - 10), Math.round(Y - 10 + bob), 20, 20);
          // pupils look where the guard is heading (or at you)
          const [dx, dy] = gd.dir ? DIRS[gd.dir] : [0, 1];
          g.fillStyle = freezeT > 0 ? '#4ecbff' : '#000';
          g.fillRect(Math.round(X - 6 + dx * 1.5 + 1), Math.round(Y - 4 + dy * 1.5), 2, 2);
          g.fillRect(Math.round(X + 2 + dx * 1.5 + 1), Math.round(Y - 4 + dy * 1.5), 2, 2);
        });

        // player
        const [px, py] = pos(player);
        const X = OX + px * CELL + CELL / 2, Y = OY + py * CELL + CELL / 2;
        if (!(caughtT > 0 && Math.floor(caughtT * 10) % 2 === 0)) {
          const frame = player.dir ? Math.floor(player.anim * 8) % 2 : 0;
          const spr = api.sprite(BANDIT[frame], { y: caughtT > 0 ? '#ff4d6d' : '#ffd23f', k: '#222', w: '#fff' }, 1);
          g.save();
          g.translate(Math.round(X), Math.round(Y));
          if (player.face === 'left') g.scale(-1, 1);
          g.drawImage(spr, -10, -10, 20, 20);
          // loot bag
          g.fillStyle = '#c9a26b';
          g.fillRect(-12, -2, 5, 7);
          g.restore();
        }

        // HUD
        T(g, String(score), 10, 14, 2, '#fff');
        T(g, 'LEVEL ' + level, W / 2, 14, 2, '#7d81a8', 'center');
        let hearts = '';
        for (let i = 0; i < Math.max(0, lives); i++) hearts += '@';
        T(g, hearts, W - 10, 14, 2, '#ff4d6d', 'right');
        T(g, 'COINS ' + coinsLeft, 10, 44, 2, '#ffd23f');
        if (freezeT > 0) T(g, 'FREEZE ' + Math.ceil(freezeT), W - 10, 44, 2, '#9ad8ff', 'right');

        const by = OY + ROWS * CELL + 14;
        if (readyT > 0 && state === 'playing') T(g, 'GET READY!', W / 2, by, 3, '#ffd23f', 'center');
        else if (clearT > 0) T(g, 'VAULT CLEARED! +@', W / 2, by, 3, '#5ee35e', 'center');
        else if (caughtT > 0) T(g, 'CAUGHT!', W / 2, by, 3, '#ff4d6d', 'center');
        else if (coinsEaten === 0) T(g, api.isTouch ? 'SWIPE TO MOVE' : 'ARROWS TO MOVE', W / 2, by + 4, 2, '#3c3c6c', 'center');
      }

      return { reset, update, draw, peek: () => ({ player, guards, level, lives, score, coinsLeft, grid }) };
    },
  });
})();
