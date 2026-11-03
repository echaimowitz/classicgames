# Classic Arcade

Retro arcade games in the spirit of the classic home consoles: chunky pixels,
bleepy sounds, simple controls. Runs in any modern browser on **iPhone or PC**,
installs to the iPhone home screen like an app, and works offline.

No build step and no dependencies: just HTML, CSS and JavaScript.

## The games

| Game | Genre | Touch | Keyboard / mouse |
|---|---|---|---|
| **Paddle Duel** | Paddle duel vs. CPU | Drag anywhere | Mouse or ← → / A D |
| **Brickfall** | Brick breaker, 8 levels + power-ups | Drag, tap to launch | Mouse or ← →, Space to launch |
| **Star Sentinel** | Formation shooter (auto-fire) | Drag to steer | Mouse or ← → |
| **Neon Serpent** | Snake | Swipe to turn | Arrows / WASD |
| **Crystal Drift** | Rock-blasting space shooter (auto-aim) | Drag to fly | Mouse or arrows |
| **Maze Bandit** | Maze chase, 3 vaults, 4 guard personalities | Swipe to turn | Arrows / WASD |
| **Turbo Lanes** | Night-time lane racer with fuel | Tap left / right side | ← → or click sides |

`P` or `Esc` pauses on PC. The game auto-pauses if you switch apps. High
scores are saved on the device.

## Play it

**On a PC:** open `index.html` in a browser (double-clicking it works).

**On an iPhone:** the files need to be hosted somewhere. The easiest free
option is GitHub Pages:

1. On GitHub, open the repo's **Settings → Pages**.
2. Under *Build and deployment*, choose **Deploy from a branch**, branch
   `main`, folder `/ (root)`, then **Save**.
3. After a minute the site is live at
   `https://<your-username>.github.io/classicgames/`.
4. Open that link in **Safari** on the iPhone, tap **Share → Add to Home
   Screen**. It now launches full-screen like a normal app and works offline.

**Testing locally on your phone:** run `python3 -m http.server 8000` in this
folder and visit `http://<your-computer's-ip>:8000` from the phone (same Wi-Fi).

## Project layout

```
index.html            page shell + list of game scripts
css/style.css         menu + game-screen styling
js/font.js            5x7 pixel font used everywhere
js/audio.js           synthesized retro sound effects (WebAudio)
js/input.js           keyboard + mouse + touch + swipe in one place
js/storage.js         high scores / settings (localStorage)
js/arcade.js          menu, game loop, pause / game-over screens, scaling
js/games/*.js         one file per game
js/games/_template.js starting point for a new game
sw.js                 offline cache (service worker)
tools/smoke-test.js   headless test that plays every game
```

## Adding a new game

1. Copy `js/games/_template.js` to `js/games/your-game.js`, then give it a
   unique `id`, a `title` and a `color`.
2. Add `<script src="js/games/your-game.js"></script>` to `index.html`, next
   to the other games.
3. Add the file to the `FILES` list in `sw.js` and bump `VERSION` (e.g.
   `cg-v2`), so installed copies pick up the change.

The shell already handles the rest: the menu card, start, pause and game-over
screens, high scores, touch and keyboard input, sound, and scaling to any
screen. Every game draws on the same 360 × 640 portrait canvas. The template's
comments list the full `api`.

Whenever you change any file, bump `VERSION` in `sw.js`. Otherwise phones
that installed the app keep running the cached copy.

## Testing

```
python3 -m http.server 8765 &
node tools/smoke-test.js     # needs Playwright: npm i -g playwright
```

It opens every game at iPhone size, plays it with a bot until game over, and
fails if any JavaScript error occurs.
