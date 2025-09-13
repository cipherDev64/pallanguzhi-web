# Pallanguzhi (Ali Guli Mane) — Web

A polished, in-browser version of the South Indian traditional mancala game **Pallanguzhi** (also known as **Ali Guli Mane**). Built for a gameathon submission.

## Why this game?
Most gameathons see digital versions of Ludo, Chess, Carrom, or Kho-Kho. Pallanguzhi is comparatively rare online, culturally rich, and perfectly suited to the browser: turn-based, easy to learn, and strategic.

## Rules (Classic Variant)
- Board: 2 rows × 7 pits (14 total). Each pit starts with N seeds (choose 4/5/6).
- Turns: Pick **one of your pits**, take all its seeds, and sow 1 seed each counter‑clockwise into subsequent pits.
- **Relay sowing**: If your last seed lands in a pit that already had seeds, pick them up and continue sowing from there.
- **Capture**: If your last seed lands in an **empty pit on your side**, capture all seeds in the directly **opposite** pit (other row). Your turn ends after a capture.
- **End**: If a player has no legal move (all pits on their row are empty), remaining seeds are captured by the other side. Highest total wins.

> You can also select the _Southern variant_ (no capture, just chain sowing).

## Features
- Play **A vs B** or **A vs AI** (simple heuristic).
- **Undo/Redo** and **New Match** with selectable rules and seeds per pit.
- Keyboard play (`1..7` triggers pit 1..7 for current player).
- Fully responsive, mobile-friendly UI with subtle sound effects (muted by default on some browsers until user interaction).

---

## Run locally (WebStorm or any server)
1. **Open** this folder in **WebStorm** (`File → Open…`).
2. Right-click `index.html` → `Open in Browser` **or** run a simple server:
   - WebStorm: `Tools → Web Browsers → Chrome` (or `Built-in Preview`).
   - Node (optional): `npx serve .` then open the shown URL.
3. Play!

## Publish to GitHub via WebStorm
1. Create a new empty GitHub repo (public or public-shared).
2. In WebStorm:
   - `VCS → Enable Version Control Integration…` → select **Git**.
   - `Git → Manage Remotes…` → add your repo URL as `origin` (SSH or HTTPS).
   - `Commit…` (check all files) → message: `feat: initial Pallanguzhi web` → **Commit and Push**.
3. Verify on GitHub that files are present (`index.html`, `styles.css`, `script.js`, `assets/`, `vercel.json`, etc.).

## Deploy to Vercel
1. Install Vercel CLI (optional): `npm i -g vercel`.
2. From this folder, run: `vercel` and accept defaults.
   - Or connect repo on <https://vercel.com> → **New Project** → select repo → **Deploy**.
3. This is a static site, so no build step is required. `vercel.json` is included.

## Project structure
```
pallanguzhi-web/
├─ index.html
├─ styles.css
├─ script.js
├─ assets/
│  ├─ favicon.svg
│  ├─ sow.mp3          # placeholders (silent small files)
│  ├─ capture.mp3
│  └─ end.mp3
├─ vercel.json
├─ README.md
└─ LICENSE
```

## Tech
- HTML5/CSS3/JS (vanilla)
- No frameworks required
- Works offline if served from a static host

## License
MIT — see `LICENSE`.
