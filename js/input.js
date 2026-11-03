/* Unified input: keyboard, mouse and touch all feed one simple object.
   Positions are reported in the game's virtual coordinates (360 x 640). */
(function () {
  'use strict';
  const keys = new Set();      // currently held
  const pressed = new Set();   // went down since last frame
  const pointer = {
    x: 180, y: 320,
    down: false, justDown: false, justUp: false, moved: false,
    id: null,
    type: 'mouse',
  };
  let swipe = null;            // 'up' | 'down' | 'left' | 'right' | null
  let anchor = null;           // swipe anchor in virtual coords
  let canvas = null, enabled = false;
  const SWIPE_DIST = 18;

  const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

  window.addEventListener('keydown', (e) => {
    if (!enabled) return;
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  function toVirtual(e) {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 360;
    pointer.y = ((e.clientY - r.top) / r.height) * 640;
  }

  function attach(c) {
    canvas = c;
    c.addEventListener('pointerdown', (e) => {
      if (pointer.down && e.pointerId !== pointer.id) return; // ignore extra fingers
      e.preventDefault();
      pointer.id = e.pointerId;
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      toVirtual(e);
      pointer.type = e.pointerType || 'mouse';
      pointer.down = true;
      pointer.justDown = true;
      pointer.moved = true;
      anchor = { x: pointer.x, y: pointer.y };
    });
    c.addEventListener('pointermove', (e) => {
      if (pointer.down && e.pointerId !== pointer.id) return;
      // Mouse hover also steers (nice for paddle games on PC); touch only while down.
      if (!pointer.down && e.pointerType !== 'mouse') return;
      toVirtual(e);
      pointer.type = e.pointerType || 'mouse';
      pointer.moved = true;
      if (pointer.down && anchor) {
        const dx = pointer.x - anchor.x, dy = pointer.y - anchor.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) >= SWIPE_DIST) {
          swipe = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
          anchor = { x: pointer.x, y: pointer.y };
        }
      }
    });
    const end = (e) => {
      if (e.pointerId !== pointer.id) return;
      pointer.down = false;
      pointer.justUp = true;
      pointer.id = null;
      anchor = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  const LEFT = ['ArrowLeft', 'KeyA'], RIGHT = ['ArrowRight', 'KeyD'];
  const UP = ['ArrowUp', 'KeyW'], DOWN = ['ArrowDown', 'KeyS'];

  const input = {
    pointer,
    attach,
    setEnabled(v) { enabled = v; if (!v) { keys.clear(); this.endFrame(); } },
    held: (...codes) => codes.some((c) => keys.has(c)),
    hit: (...codes) => codes.some((c) => pressed.has(c)),
    axisX() { return (this.held(...RIGHT) ? 1 : 0) - (this.held(...LEFT) ? 1 : 0); },
    axisY() { return (this.held(...DOWN) ? 1 : 0) - (this.held(...UP) ? 1 : 0); },
    /** Direction just requested by arrow key or finger swipe. */
    dirPressed() {
      if (this.hit(...UP)) return 'up';
      if (this.hit(...DOWN)) return 'down';
      if (this.hit(...LEFT)) return 'left';
      if (this.hit(...RIGHT)) return 'right';
      return swipe;
    },
    /** Generic "action": tap, click, Space or Enter. */
    action() { return pointer.justDown || this.hit('Space', 'Enter'); },
    endFrame() {
      pressed.clear();
      pointer.justDown = pointer.justUp = pointer.moved = false;
      swipe = null;
    },
  };

  window.CG = window.CG || {};
  CG.input = input;
})();
