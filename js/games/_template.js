/* GAME TEMPLATE - copy this file to start a new game.
   1. Copy to js/games/my-game.js and change id / title / color.
   2. Add <script src="js/games/my-game.js"></script> to index.html (with the other games).
   3. Add 'js/games/my-game.js' to the FILES list in sw.js and bump VERSION.
   That's it: the menu card, start / pause / game-over screens, high scores,
   scaling and touch + keyboard input are all handled by the arcade shell.

   The screen is always 360 x 640 (portrait). (0,0) is the top-left corner. */
(function () {
  'use strict';
  const W = 360, H = 640;

  CG.register({
    id: 'my-game',                 // unique, used for saved high scores and the URL (#/my-game)
    title: 'My Game',              // keep it short: about 12 characters
    tagline: 'One sentence that sells the game on the menu card.',
    color: '#4ef0ff',              // accent colour for the card and title
    controls: {                    // up to 3 short lines (max ~26 characters each)
      touch: ['DRAG TO MOVE'],
      keys: ['ARROWS TO MOVE'],
    },

    // Optional: draw the menu-card picture on a 160 x 120 canvas.
    icon(g, w, h) {
      g.fillStyle = '#4ef0ff';
      g.fillRect(w / 2 - 8, h / 2 - 8, 16, 16);
    },

    // Called once when the game opens. `api` gives you:
    //   api.input   - pointer {x, y, down, justDown, moved}, axisX(), axisY(),
    //                 dirPressed() (arrow/WASD/swipe), action() (tap/Space), held(code), hit(code)
    //   api.sfx(name) - 'blip' 'paddle' 'wall' 'brick' 'hard' 'point' 'miss' 'shoot' 'hit'
    //                   'explode' 'power' 'life' 'eat' 'bonus' 'level' 'win' 'die'
    //   api.tone({ f: 440, f2: 880, d: 0.1, type: 'square', v: 0.4 }) - custom beep
    //   api.text(g, str, x, y, size, color, align) - pixel-font text
    //   api.sprite(['.#.', '###'], color) - cached pixel-art canvas
    //                 (color may be a palette like { a: '#f00', b: '#fff' } for multi-colour art)
    //   api.shake(amount, seconds), api.gameOver(score), api.isTouch
    //   api.rand(a, b), api.randInt(a, b), api.clamp(v, a, b), api.pick(array)
    create(api) {
      let x, score;

      function reset() {        // new game (also called on "play again")
        x = W / 2;
        score = 0;
      }

      function update(dt) {     // dt is in seconds (fixed 1/120)
        if (api.input.pointer.moved) x = api.input.pointer.x;
        x += api.input.axisX() * 300 * dt;
        x = api.clamp(x, 0, W);
        score += dt;
        // when the player loses: api.gameOver(Math.floor(score));
      }

      function draw(g) {
        g.fillStyle = '#000';
        g.fillRect(0, 0, W, H);
        g.fillStyle = '#4ef0ff';
        g.fillRect(x - 10, H - 80, 20, 20);
        api.text(g, String(Math.floor(score)), 10, 12, 2, '#fff');
      }

      return { reset, update, draw };
    },
  });
})();
