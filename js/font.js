/* Pixel font: a hand-made 5x7 bitmap font so every game shares the same
   chunky retro lettering, with no web-font download (works offline). */
(function () {
  'use strict';
  const RAW = {
    'A': '01110 10001 10001 11111 10001 10001 10001',
    'B': '11110 10001 10001 11110 10001 10001 11110',
    'C': '01110 10001 10000 10000 10000 10001 01110',
    'D': '11100 10010 10001 10001 10001 10010 11100',
    'E': '11111 10000 10000 11110 10000 10000 11111',
    'F': '11111 10000 10000 11110 10000 10000 10000',
    'G': '01110 10001 10000 10111 10001 10001 01111',
    'H': '10001 10001 10001 11111 10001 10001 10001',
    'I': '01110 00100 00100 00100 00100 00100 01110',
    'J': '00111 00010 00010 00010 00010 10010 01100',
    'K': '10001 10010 10100 11000 10100 10010 10001',
    'L': '10000 10000 10000 10000 10000 10000 11111',
    'M': '10001 11011 10101 10101 10001 10001 10001',
    'N': '10001 10001 11001 10101 10011 10001 10001',
    'O': '01110 10001 10001 10001 10001 10001 01110',
    'P': '11110 10001 10001 11110 10000 10000 10000',
    'Q': '01110 10001 10001 10001 10101 10010 01101',
    'R': '11110 10001 10001 11110 10100 10010 10001',
    'S': '01111 10000 10000 01110 00001 00001 11110',
    'T': '11111 00100 00100 00100 00100 00100 00100',
    'U': '10001 10001 10001 10001 10001 10001 01110',
    'V': '10001 10001 10001 10001 10001 01010 00100',
    'W': '10001 10001 10001 10101 10101 10101 01010',
    'X': '10001 10001 01010 00100 01010 10001 10001',
    'Y': '10001 10001 10001 01010 00100 00100 00100',
    'Z': '11111 00001 00010 00100 01000 10000 11111',
    '0': '01110 10001 10011 10101 11001 10001 01110',
    '1': '00100 01100 00100 00100 00100 00100 01110',
    '2': '01110 10001 00001 00010 00100 01000 11111',
    '3': '11111 00010 00100 00010 00001 10001 01110',
    '4': '00010 00110 01010 10010 11111 00010 00010',
    '5': '11111 10000 11110 00001 00001 10001 01110',
    '6': '00110 01000 10000 11110 10001 10001 01110',
    '7': '11111 00001 00010 00100 01000 01000 01000',
    '8': '01110 10001 10001 01110 10001 10001 01110',
    '9': '01110 10001 10001 01111 00001 00010 01100',
    ' ': '00000 00000 00000 00000 00000 00000 00000',
    '.': '00000 00000 00000 00000 00000 01100 01100',
    ',': '00000 00000 00000 00000 01100 00100 01000',
    '!': '00100 00100 00100 00100 00100 00000 00100',
    '?': '01110 10001 00001 00010 00100 00000 00100',
    ':': '00000 01100 01100 00000 01100 01100 00000',
    '-': '00000 00000 00000 11111 00000 00000 00000',
    '+': '00000 00100 00100 11111 00100 00100 00000',
    '=': '00000 00000 11111 00000 11111 00000 00000',
    '/': '00000 00001 00010 00100 01000 10000 00000',
    "'": '01100 00100 01000 00000 00000 00000 00000',
    '<': '00010 00100 01000 10000 01000 00100 00010',
    '>': '01000 00100 00010 00001 00010 00100 01000',
    '(': '00010 00100 01000 01000 01000 00100 00010',
    ')': '01000 00100 00010 00010 00010 00100 01000',
    '*': '00000 00100 10101 01110 10101 00100 00000',
    'x': '00000 00000 10001 01010 00100 01010 10001', // small times sign
    '@': '00000 01010 11111 11111 01110 00100 00000', // heart
    '^': '00100 01110 11111 00100 00100 00100 00000', // up arrow
    '_': '00100 00100 00100 11111 01110 00100 00000', // down arrow
    '{': '00100 01000 11111 01000 00100 00000 00000', // left arrow
    '}': '00100 00010 11111 00010 00100 00000 00000', // right arrow
  };

  // Pre-compute each glyph as a list of horizontal runs [row, col, len]
  // so drawing is a handful of fillRects per character.
  const GLYPHS = {};
  for (const ch in RAW) {
    const rows = RAW[ch].split(' ');
    const runs = [];
    rows.forEach((row, r) => {
      let c = 0;
      while (c < 5) {
        if (row[c] === '1') {
          let len = 1;
          while (c + len < 5 && row[c + len] === '1') len++;
          runs.push([r, c, len]);
          c += len;
        } else c++;
      }
    });
    GLYPHS[ch] = runs;
  }

  function norm(str) {
    // Keep the special lowercase 'x' glyph, uppercase everything else.
    return String(str).replace(/[a-wyz]/g, (m) => m.toUpperCase());
  }

  function width(str, size) {
    const s = norm(str);
    return s.length ? (s.length * 6 - 1) * (size || 2) : 0;
  }

  /** Draw text. align: 'left' | 'center' | 'right'. y is the top edge. */
  function draw(g, str, x, y, size, color, align) {
    size = size || 2;
    const s = norm(str);
    const w = width(s, size);
    if (align === 'center') x -= w / 2;
    else if (align === 'right') x -= w;
    x = Math.round(x);
    y = Math.round(y);
    g.fillStyle = color || '#fff';
    for (let i = 0; i < s.length; i++) {
      const runs = GLYPHS[s[i]] || GLYPHS['?'];
      const ox = x + i * 6 * size;
      for (let k = 0; k < runs.length; k++) {
        const run = runs[k];
        g.fillRect(ox + run[1] * size, y + run[0] * size, run[2] * size, size);
      }
    }
  }

  /** Make a crisp standalone canvas label (used for HTML menu titles). */
  function label(str, size, color) {
    const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
    const c = document.createElement('canvas');
    const w = width(str, size), h = 7 * size;
    c.width = w * dpr;
    c.height = h * dpr;
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    draw(g, str, 0, 0, size, color);
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', str);
    return c;
  }

  window.CG = window.CG || {};
  CG.font = { draw, width, label };
})();
