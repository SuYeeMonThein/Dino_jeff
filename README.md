# Little Dino's Love Run 💕

A cute, romantic endless-runner built as a gift — plain HTML, CSS, and
JavaScript, no frameworks, no build step, no image files (everything is
drawn with code on a `<canvas>`).

Help Little Dino run, jump over thorny bushes, and collect floating
hearts. Hit score milestones (100, 250, 450, 700, 1000) to reveal sweet
messages.

## Files

- `index.html` — page structure, HUD, start/game-over screens
- `style.css` — layout, fonts, the night-sky card frame
- `game.js` — all game logic (physics, drawing, collisions, messages)
- `README.md` — this file

## How to run it locally

**Easiest — VS Code Live Server:**

1. Open this folder (`game`) in VS Code.
2. Install the **"Live Server"** extension (by Ritwick Dey) from the
   Extensions panel, if you don't have it already.
3. Right-click `index.html` in the file explorer and choose
   **"Open with Live Server"**.
4. Your browser opens the game automatically (something like
   `http://127.0.0.1:5500`). Any edits you save will auto-reload.

**Without VS Code:** just double-click `index.html` to open it directly
in a browser — the game works fine opened as a local file too, since it
has no server-side dependencies.

## Editing the messages

All the romantic text lives in one place at the very top of
[`game.js`](game.js):

- `MILESTONES` — the score thresholds and banner messages.
- `HEART_WORDS` — the words that pop up when a heart is collected.

Just edit the strings/emoji there — no need to touch any other code.

## Controls

- **Space**, **↑ (Up Arrow)**, or **W** to jump
- Or **tap/click** anywhere on the game screen
- Hold the key/tap a little longer for a higher jump; tap quickly for a
  short hop

## Putting it online for free (to send a link)

### Option A — GitHub Pages

1. Create a new GitHub repository and push this folder to it:
   ```bash
   git init
   git add .
   git commit -m "Little Dino's Love Run"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
2. On GitHub, go to **Settings → Pages**.
3. Under "Build and deployment", set **Source** to "Deploy from a
   branch", pick the `main` branch and `/ (root)` folder, then **Save**.
4. After a minute, your game will be live at:
   `https://<your-username>.github.io/<repo-name>/`
5. Send that link to your partner. 💌

### Option B — Netlify (drag-and-drop, no git needed)

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag this whole `game` folder onto the page.
3. Netlify uploads it and gives you a live URL (like
   `https://random-name-123.netlify.app`) within seconds.
4. Optional: click "Site settings" to rename the subdomain to something
   more personal before sharing the link.

Both options are free and require no backend — the game is fully
static.

## Notes on how it's built

- **Delta-time physics**: movement uses `requestAnimationFrame` and the
  real elapsed time between frames (not a fixed per-frame step), so the
  game runs at the same speed regardless of screen refresh rate. The
  loop automatically pauses while the browser tab is hidden.
- **Collision detection**: simple AABB (axis-aligned bounding box)
  checks between the dino and obstacles/hearts, with hitboxes shrunk
  slightly (`HITBOX_SHRINK` in `game.js`) so near-misses feel fair
  instead of frustrating.
- **Best score**: saved to `localStorage` (wrapped in try/catch so it
  degrades gracefully in private browsing or if storage is blocked).
- **Accessibility**: respects `prefers-reduced-motion` by disabling
  star twinkling and bobbing animations for users who have that
  system setting on.
- **Crisp on high-DPI screens**: the canvas renders at a fixed logical
  resolution and is scaled using `devicePixelRatio`, so it stays sharp
  on phones and retina displays.

Enjoy, and good luck getting to 1000! ❤️
