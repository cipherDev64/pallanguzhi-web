// Animated Pallanguzhi — Vanilla JS (no build step)
// Board: 2 rows × 7 pits (indices 0..13)
// A owns 0..6 (bottom, L→R). B owns 7..13 (top, R→L visual).

const PIT_COUNT = 14, SIDE = 7;
const $  = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const S = {
  pits: new Array(PIT_COUNT).fill(0),
  player: "A",
  captured: { A: 0, B: 0 },
  rules: "classic",   // "classic" or "southern"
  seeds: 5,
  ai: false,
  animDelay: 220,     // ms per hop (adjusted by speed dropdown)
  hist: [],
  future: [],
  locking: false
};

// --- Helpers ---------------------------------------------------------------
const own = (i) => (i < SIDE ? "A" : "B");
const isMine = (i) => own(i) === S.player;
const next = (i) => (i + 1) % PIT_COUNT;
const oppIndex = (i) => 13 - i;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function clone() {
  return {
    pits: S.pits.slice(),
    player: S.player,
    captured: { A: S.captured.A, B: S.captured.B },
    rules: S.rules,
    seeds: S.seeds
  };
}
function pushHist() { S.hist.push(clone()); S.future.length = 0; }
function undo()      { if (!S.hist.length || S.locking) return; const prev = S.hist.pop(); S.future.push(clone()); Object.assign(S, prev); render(); }
function redo()      { if (!S.future.length || S.locking) return; const nxt  = S.future.pop(); S.hist.push(clone());  Object.assign(S, nxt);  render(); }

function legalMoves(p = S.player) {
  const start = p === "A" ? 0 : 7, end = start + SIDE, out = [];
  for (let i = start; i < end; i++) if (S.pits[i] > 0) out.push(i);
  return out;
}

function setBadge() {
  const badge = $("#turnBadge");
  badge.textContent = (S.player === "A" ? "A" : "B") + " to move";
  badge.className = "badge " + (S.player === "A" ? "a" : "b");
}
function updateScores() {
  $("#scoreA").textContent = S.captured.A;
  $("#scoreB").textContent = S.captured.B;
}

function pitEl(i) { return $(`.pit[data-idx="${i}"]`); }
function pitCenter(i) {
  const el = pitEl(i), wrap = $(".boardWrap");
  const r = el.getBoundingClientRect(), p = wrap.getBoundingClientRect();
  return { x: r.left - p.left + r.width / 2, y: r.top - p.top + r.height / 2 };
}

// --- Animation: fly a single coin from one pit to the next -----------------
async function fly(fromIdx, toIdx) {
  const layer = $("#flyLayer");
  const start = pitCenter(fromIdx), end = pitCenter(toIdx);
  const dot = document.createElement("div");
  dot.className = "fly";
  dot.style.left = `${start.x}px`;
  dot.style.top  = `${start.y}px`;
  layer.appendChild(dot);

  const dur = Math.max(120, S.animDelay);
  const t0 = performance.now();
  await new Promise(resolve => {
    function step(t) {
      const k = Math.min(1, (t - t0) / dur);
      const x = start.x + (end.x - start.x) * k;
      const y = start.y + (end.y - start.y) * k;
      dot.style.left = `${x}px`;
      dot.style.top  = `${y}px`;
      if (k < 1) requestAnimationFrame(step);
      else { layer.removeChild(dot); resolve(); }
    }
    requestAnimationFrame(step);
  });
}

// --- Rendering -------------------------------------------------------------
function render() {
  const board = $("#board");
  board.innerHTML = "";

  // Top row (B) visually right→left
  const top = document.createElement("div"); top.className = "row top";
  for (let i = 13; i >= 7; i--) top.appendChild(renderPit(i));

  // Bottom row (A) left→right
  const bot = document.createElement("div"); bot.className = "row bottom";
  for (let i = 0; i < 7; i++) bot.appendChild(renderPit(i));

  board.appendChild(top); board.appendChild(bot);
  setBadge(); updateScores(); reflectInteractivity();
  // Make the board focusable for keyboard play
  board.tabIndex = 0;
}

function renderPit(i) {
  const el = document.createElement("button");
  el.className = "pit";
  el.dataset.idx = i;
  el.dataset.owner = own(i);
  el.setAttribute("aria-label", `Pit ${i} owned by ${own(i)} with ${S.pits[i]} seeds`);

  const label = document.createElement("span");
  label.className = "label";
  label.textContent = `${own(i)} ${labelIdx(i)}`;

  const chips = document.createElement("div");
  chips.className = "chips";
  for (let c = 0; c < S.pits[i]; c++) {
    const dot = document.createElement("span");
    dot.className = "chip"; chips.appendChild(dot);
  }

  const count = document.createElement("span");
  count.className = "count";
  count.textContent = S.pits[i];

  el.appendChild(label); el.appendChild(chips); el.appendChild(count);
  el.addEventListener("click", () => tryPlay(i));
  return el;
}

function labelIdx(i) { return i < 7 ? i + 1 : (14 - i); }

// NEW: non-sticky interactivity (no native disabled attr)
function reflectInteractivity() {
  $$(".pit").forEach(p => {
    const idx = +p.dataset.idx;
    const enabled = isMine(idx) && S.pits[idx] > 0 && !S.locking && !gameOver();
    p.classList.toggle("enabled", enabled);
    p.classList.toggle("disabled", !enabled);
    p.tabIndex = enabled ? 0 : -1;
    p.setAttribute("aria-disabled", String(!enabled));
  });
}

function renderCountsOnly() {
  $$(".pit").forEach(el => {
    const i = +el.dataset.idx;
    el.querySelector(".count").textContent = S.pits[i];
    const chips = el.querySelector(".chips");
    const need = S.pits[i], have = chips.childElementCount;
    if (have < need) {
      for (let k = 0; k < need - have; k++) {
        const c = document.createElement("span"); c.className = "chip"; chips.appendChild(c);
      }
    } else if (have > need) {
      for (let k = 0; k < have - need; k++) chips.removeChild(chips.lastElementChild);
    }
  });
  reflectInteractivity();
}

// --- Gameplay --------------------------------------------------------------
// NEW: try/finally guarantees unlocking, handles AI no-move case
async function tryPlay(i) {
  if (S.locking) return;
  if (!isMine(i) || S.pits[i] === 0) return;

  pushHist();
  S.locking = true;
  try {
    await animatedMove(i);

    if (gameOver()) {
      finalize();
      render();
      return;
    }

    // Switch player
    S.player = S.player === "A" ? "B" : "A";
    render();

    // AI turn (if enabled). If AI has no move, finalize so UI doesn't look "stuck".
    if (S.ai && S.player === "B") {
      await sleep(350);
      const mv = pickAiMove();
      if (mv != null) {
        await tryPlay(mv);
      } else if (gameOver()) {
        finalize();
        render();
      }
    }
  } finally {
    S.locking = false;
    reflectInteractivity();
  }
}

async function animatedMove(startIdx) {
  let idx = startIdx;
  let inHand = S.pits[idx];
  S.pits[idx] = 0;
  renderCountsOnly();

  while (true) {
    while (inHand > 0) {
      const to = next(idx);
      await fly(idx, to);
      idx = to;
      S.pits[idx] += 1;
      renderCountsOnly();
      await sleep(S.animDelay * 0.35);
      inHand--;
    }
    // Relay sowing if last landed pit now has >1
    if (S.pits[idx] > 1) {
      inHand = S.pits[idx];
      S.pits[idx] = 0;
      renderCountsOnly();
      continue;
    }
    break;
  }

  // Classic capture: last seed landed in empty on your row → capture opposite
  if (S.rules === "classic" && own(idx) === S.player && S.pits[idx] === 1) {
    const opp = oppIndex(idx);
    const cap = S.pits[opp];
    if (cap > 0) {
      S.pits[opp] = 0;
      renderCountsOnly();
      S.captured[S.player] += cap;
      updateScores();
    }
  }
}

function gameOver() {
  return legalMoves("A").length === 0 || legalMoves("B").length === 0;
}

function finalize() {
  const aRem = sumRange(0, 6), bRem = sumRange(7, 13);
  if (aRem === 0) { S.captured.B += bRem; for (let i = 7; i < 14; i++) S.pits[i] = 0; }
  else if (bRem === 0) { S.captured.A += aRem; for (let i = 0; i < 7; i++) S.pits[i] = 0; }

  const a = S.captured.A, b = S.captured.B;
  const msg = a > b ? "Player A wins!" : (b > a ? "Player B wins!" : "Draw!");
  $("#turnBadge").textContent = "Game over — " + msg;
}

function sumRange(a, b) { let s = 0; for (let i = a; i <= b; i++) s += S.pits[i]; return s; }

// --- AI (simple heuristic) -------------------------------------------------
function pickAiMove() {
  const moves = legalMoves("B"); if (!moves.length) return null;
  let best = null, bestScore = -1;
  for (const m of moves) {
    const sc = scoreMove(m);
    if (sc > bestScore) { bestScore = sc; best = m; }
  }
  return best;
}
function scoreMove(startIdx) {
  const pits = S.pits.slice();
  let idx = startIdx, inHand = pits[idx]; pits[idx] = 0;
  while (true) {
    while (inHand > 0) { idx = (idx + 1) % PIT_COUNT; pits[idx] += 1; inHand--; }
    if (pits[idx] > 1) { inHand = pits[idx]; pits[idx] = 0; continue; }
    break;
  }
  let s = 0;
  if (S.rules === "classic" && own(idx) === "B" && pits[idx] === 1) s += pits[13 - idx] * 2 + 1;
  s += S.pits[startIdx]; // prefer long sow
  return s;
}

// --- Init & UI bindings ----------------------------------------------------
function init(seeds = 5, first = "A") {
  S.pits = new Array(PIT_COUNT).fill(seeds);
  S.player = first;
  S.captured = { A: 0, B: 0 };
  S.hist = [];
  S.future = [];
  render();
}

function bindUI() {
  $("#newGame").addEventListener("click", () => {
    S.seeds = +$("#seeds").value;
    S.rules = $("#rules").value;
    const first = $("#first").value;
    init(S.seeds, first);
  });
  $("#undo").addEventListener("click", undo);
  $("#redo").addEventListener("click", redo);
  $("#ai").addEventListener("change", e => S.ai = e.target.checked);
  $("#showHelp").addEventListener("click", () => $("#helpDialog").showModal());
  $("#speed").addEventListener("change", e => S.animDelay = +e.target.value);

  // Keyboard: number keys 1..7 select pits for current player
  $("#board").addEventListener("keydown", (e) => {
    const n = e.keyCode - 48; // '1'..'9'
    if (n >= 1 && n <= 7) {
      if (S.player === "A") tryPlay(n - 1);
      else {
        const map = { 1: 13, 2: 12, 3: 11, 4: 10, 5: 9, 6: 8, 7: 7 };
        tryPlay(map[n]);
      }
    }
  });
}

// Boot
(function main() {
  bindUI();
  S.animDelay = +$("#speed").value;
  S.rules     = $("#rules").value;
  S.seeds     = +$("#seeds").value;
  $("#ai").checked = false;
  init(S.seeds, $("#first").value);
  $("#helpDialog").showModal();
})();
