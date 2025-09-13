/* Pallanguzhi (Ali Guli Mane) — Vanilla JS implementation
   Board: 2 rows × 7 pits, indices:
     Top row (player B) right-to-left: 13 12 11 10 9 8 7
     Bottom row (player A) left-to-right: 0 1 2 3 4 5 6
   We use a single 14-length array in circular order: 0..13 (counter-clockwise traversal).
   Ownership: pits 0..6 => A, pits 7..13 => B.
*/

const PIT_COUNT = 14;
const PITS_PER_SIDE = 7;

const qs = (s, el=document) => el.querySelector(s);
const qsa = (s, el=document) => [...el.querySelectorAll(s)];

const state = {
  pits: new Array(PIT_COUNT).fill(0),
  player: "A", // "A" bottom row, "B" top row
  captured: { A: 0, B: 0 },
  history: [], // {pits, player, captured}
  future: [],
  ruleset: "classic", // or "southern"
  seedsPerPit: 5,
  aiEnabled: false,
  sound: true,
  lock: false,
};

// Audio refs
const sowSound = qs("#sowSound");
const captureSound = qs("#captureSound");
const endSound = qs("#endSound");

function cloneState() {
  return {
    pits: state.pits.slice(),
    player: state.player,
    captured: { A: state.captured.A, B: state.captured.B },
    ruleset: state.ruleset,
    seedsPerPit: state.seedsPerPit
  };
}

function pushHistory() {
  state.history.push(cloneState());
  state.future.length = 0;
}

function undo() {
  if (!state.history.length) return;
  const prev = state.history.pop();
  state.future.push(cloneState());
  Object.assign(state, prev);
  render();
}

function redo() {
  if (!state.future.length) return;
  const next = state.future.pop();
  state.history.push(cloneState());
  Object.assign(state, next);
  render();
}

function pitOwner(i) {
  return i < PITS_PER_SIDE ? "A" : "B";
}

function isMyPit(i) {
  return pitOwner(i) === state.player;
}

function nextIndex(i) {
  return (i + 1) % PIT_COUNT;
}

function initBoard(seeds=5, first="A") {
  state.pits = state.pits.map(_ => seeds);
  state.player = first;
  state.captured = { A: 0, B: 0 };
  state.history = [];
  state.future = [];
  render();
  setStatus(`${playerName()} to move`);
}

function setStatus(text) {
  qs("#statusText").textContent = text;
}

function playerName(p=state.player) {
  return p === "A" ? "Player A" : "Player B";
}

function switchPlayer() {
  state.player = state.player === "A" ? "B" : "A";
}

function legalMoves(player=state.player) {
  const start = player === "A" ? 0 : 7;
  const end = start + PITS_PER_SIDE;
  const moves = [];
  for (let i=start; i<end; i++) {
    if (state.pits[i] > 0) moves.push(i);
  }
  return moves;
}

// Sowing logic with optional capture
function playFromPit(i) {
  if (state.lock) return;
  if (!isMyPit(i)) return;
  if (state.pits[i] === 0) return;

  pushHistory();
  state.lock = true;

  let idx = i;
  let inHand = state.pits[idx];
  state.pits[idx] = 0;

  while (true) {
    while (inHand > 0) {
      idx = nextIndex(idx);
      state.pits[idx] += 1;
      inHand--;
      if (state.sound) try { sowSound.currentTime = 0; sowSound.play().catch(()=>{});} catch {}
      renderCountsOnly(); // light update
    }
    // If we landed in a non-empty pit, relay sow
    if (state.pits[idx] > 1) {
      inHand = state.pits[idx];
      state.pits[idx] = 0;
      continue;
    }
    // We landed in an empty pit
    break;
  }

  // Capture (classic rules) if last seed landed in empty on your side
  if (state.ruleset === "classic" && pitOwner(idx) === state.player && state.pits[idx] === 1) {
    const opp = 13 - idx; // opposite pit in 2x7
    const capturedSeeds = state.pits[opp];
    if (capturedSeeds > 0) {
      state.pits[opp] = 0;
      state.captured[state.player] += capturedSeeds;
      if (state.sound) try { captureSound.currentTime = 0; captureSound.play().catch(()=>{});} catch {}
    }
  }

  // End turn
  if (isGameOver()) {
    finalizeGame();
  } else {
    switchPlayer();
    setStatus(`${playerName()} to move`);
    render();
    state.lock = false;
    // AI turn if enabled
    if (state.aiEnabled && state.player === "B") {
      setTimeout(aiTurn, 450);
    }
  }
}

function aiTurn() {
  // Simple heuristic AI:
  // 1) favor moves that end on empty on AI's side with capture
  // 2) otherwise pick move that yields highest immediate bonus sow length
  const moves = legalMoves("B");
  if (!moves.length) { finalizeGame(); return; }

  let best = null, bestScore = -1;
  for (const m of moves) {
    const score = scoreMove(m);
    if (score > bestScore) { bestScore = score; best = m; }
  }
  playFromPit(best);
}

function scoreMove(startIdx) {
  // Simulate one move lightly to compute heuristic score
  const pits = state.pits.slice();
  let idx = startIdx;
  let inHand = pits[idx];
  pits[idx] = 0;
  let last = idx;
  while (true) {
    while (inHand > 0) {
      idx = (idx + 1) % PIT_COUNT;
      pits[idx] += 1;
      inHand--;
    }
    // relay
    if (pits[idx] > 1) {
      inHand = pits[idx];
      pits[idx] = 0;
      continue;
    }
    last = idx;
    break;
  }
  let score = 0;
  // capture potential
  if (state.ruleset === "classic" && pitOwner(last) === "B" && pits[last] === 1) {
    const opp = 13 - last;
    score += pits[opp] * 2 + 1; // weight capture
  }
  // prefer keeping turn short (to switch if disadvantage? neutral here)
  // prefer distributing many seeds
  score += (state.pits[startIdx]); // sow length
  // prefer filling empties on our side
  const bSide = pits.slice(7, 14).filter(c => c>0).length;
  score += bSide * 0.1;
  return score;
}

function isGameOver() {
  return legalMoves("A").length === 0 || legalMoves("B").length === 0;
}

function finalizeGame() {
  // Sweep remaining seeds to the opponent with seeds left
  const aRem = state.pits.slice(0,7).reduce((a,b)=>a+b,0);
  const bRem = state.pits.slice(7,14).reduce((a,b)=>a+b,0);
  if (aRem > 0 && bRem > 0) {
    // both have something, no sweep
  } else if (aRem === 0) {
    state.captured.B += bRem;
    for (let i=7;i<14;i++) state.pits[i]=0;
  } else if (bRem === 0) {
    state.captured.A += aRem;
    for (let i=0;i<7;i++) state.pits[i]=0;
  }
  if (state.sound) try { endSound.currentTime = 0; endSound.play().catch(()=>{});} catch {}
  render();
  const a = state.captured.A, b = state.captured.B;
  const result = a > b ? "Player A wins!" : (b > a ? "Player B wins!" : "It's a draw!");
  setStatus(`Game over — ${result}`);
  state.lock = false;
}

function render() {
  const board = qs("#board");
  board.innerHTML = "";
  // Top row (B): render right-to-left to match physical boards
  const top = document.createElement("div");
  top.className = "row top";
  for (let i=13; i>=7; i--) top.appendChild(renderPit(i));
  const bottom = document.createElement("div");
  bottom.className = "row bottom";
  for (let i=0; i<7; i++) bottom.appendChild(renderPit(i));
  board.appendChild(top);
  board.appendChild(bottom);
  updateScores();
}

function renderCountsOnly() {
  qsa(".pit").forEach(el => {
    const idx = +el.dataset.idx;
    el.querySelector(".count").textContent = state.pits[idx];
  });
  updateScores();
}

function renderPit(i) {
  const el = document.createElement("button");
  el.className = "pit";
  el.dataset.idx = i;
  el.dataset.owner = pitOwner(i);
  el.setAttribute("aria-label", `Pit ${i} owned by ${pitOwner(i)} with ${state.pits[i]} seeds`);
  el.innerHTML = `<span class="label">${pitOwner(i)}${pitIndexLabel(i)}</span>
                  <span class="count">${state.pits[i]}</span>`;
  el.addEventListener("click", () => playFromPit(i));
  return el;
}

function pitIndexLabel(i){
  // A pits: 1..7 left-to-right; B pits: 1..7 right-to-left for player perspective
  if (i < 7) return ` ${i+1}`;
  return ` ${14-i}`;
}

function updateScores() {
  qs("#scoreA").textContent = state.captured.A;
  qs("#scoreB").textContent = state.captured.B;
}

function showRules() {
  qs("#dlgRules").showModal();
}

// UI bindings
qs("#btnNew").addEventListener("click", () => {
  const seeds = +qs("#selSeeds").value;
  const rules = qs("#selRules").value;
  const first = qs("#selFirst").value;
  state.seedsPerPit = seeds;
  state.ruleset = rules;
  initBoard(seeds, first);
});
qs("#btnRules").addEventListener("click", showRules);
qs("#btnUndo").addEventListener("click", undo);
qs("#btnRedo").addEventListener("click", redo);
qs("#chkAi").addEventListener("change", (e)=>{
  state.aiEnabled = e.target.checked;
  if (state.aiEnabled && state.player === "B") setTimeout(aiTurn, 400);
});
qs("#chkSound").addEventListener("change", (e)=>{
  state.sound = e.target.checked;
});

// Keyboard accessibility: numbers select pits for current player
qs("#board").addEventListener("keydown", (e)=>{
  const n = e.keyCode - 48; // '1'..'9'
  if (n>=1 && n<=7) {
    if (state.player === "A") {
      playFromPit(n-1);
    } else {
      // B pits are 13..7 (right-to-left), number 1 maps to 13, 7 maps to 7
      const map = {1:13,2:12,3:11,4:10,5:9,6:8,7:7};
      playFromPit(map[n]);
    }
  }
});

// Initialize
(function(){
  // read initial UI
  state.ruleset = qs("#selRules").value;
  state.seedsPerPit = +qs("#selSeeds").value;
  state.aiEnabled = qs("#chkAi").checked;
  state.sound = qs("#chkSound").checked;
  initBoard(state.seedsPerPit, qs("#selFirst").value);
  showRules();
})();
