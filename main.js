// ===== STEP 6: Dark Energy I — cosmic expansion =====

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- GAME STATE ---
let gameState = "menu";
let currentSection = null; // "darkMatter1", "darkMatter2", or "darkEnergy1"

// --- MENU BUTTONS ---
const startButton = { x: canvas.width / 2 - 100, y: 270, width: 200, height: 50, label: "Start Game" };
const previewDM2Button = { x: canvas.width / 2 - 110, y: 332, width: 220, height: 32, label: "Preview: Dark Matter II" };
const previewDE1Button = { x: canvas.width / 2 - 110, y: 368, width: 220, height: 32, label: "Preview: Dark Energy I" };
const previewDE2Button = { x: canvas.width / 2 - 110, y: 404, width: 220, height: 32, label: "Preview: Dark Energy II" };
const previewFinalButton = { x: canvas.width / 2 - 110, y: 440, width: 220, height: 32, label: "Preview: Final Challenge" };

// --- THE SPACESHIP (same as Step 3/4/5) ---
const ship = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 24,
  speed: 4,
  lastPullMagnitude: 0
};

function clampShipToBounds() {
  const halfSize = ship.size / 2;
  if (ship.x < halfSize) ship.x = halfSize;
  if (ship.x > canvas.width - halfSize) ship.x = canvas.width - halfSize;
  if (ship.y < halfSize) ship.y = halfSize;
  if (ship.y > canvas.height - halfSize) ship.y = canvas.height - halfSize;
}

// --- STARFIELD (same as Step 3/4/5) ---
const stars = [];
const STAR_COUNT = 120;
for (let i = 0; i < STAR_COUNT; i++) {
  stars.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    radius: Math.random() * 1.5 + 0.5
  });
}

// --- KEYBOARD INPUT (same as Step 3/4/5) ---
const keysPressed = {};
window.addEventListener("keydown", function (event) {
  keysPressed[event.key.toLowerCase()] = true;
  handleAnyKeyPress();
});
window.addEventListener("keyup", function (event) {
  keysPressed[event.key.toLowerCase()] = false;
});

// A shared "science journal" — every fact unlocked in ANY section goes here.
const scienceJournal = [];

// Adds a fact to the journal, but only if it isn't already there. Without
// this, replaying a section (from a menu preview button, or the Final
// Challenge's "Play Again") would push the same fact in again every time.
function addJournalEntry(fact) {
  if (!scienceJournal.includes(fact)) {
    scienceJournal.push(fact);
  }
}

// A shared bottom text popup used by every section for facts/feedback messages.
let messagePopup = { text: "", framesLeft: 0 };
const MESSAGE_POPUP_DURATION = 260; // ~4 seconds at 60fps

// ===================================================================
// SHARED GRAVITY MATH (used by Dark Matter I AND II — NOT Dark Energy I)
// ===================================================================
const GRAVITY_STRENGTH = 7500;
const MIN_DIST = 50;
const MAX_SHIP_PULL_PER_FRAME = 3.5;

function computeGravityPull(px, py, blobs) {
  let totalX = 0;
  let totalY = 0;
  for (const blob of blobs) {
    const dx = blob.x - px;
    const dy = blob.y - py;
    const distance = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    const clampedDistance = Math.max(distance, MIN_DIST);
    const pullMagnitude = GRAVITY_STRENGTH / (clampedDistance * clampedDistance);
    totalX += (dx / distance) * pullMagnitude;
    totalY += (dy / distance) * pullMagnitude;
  }
  return { x: totalX, y: totalY };
}

function getActiveGravityBlobs() {
  if (currentSection === "darkMatter1") return darkMatter1.blobs;
  if (currentSection === "darkMatter2") return darkMatter2.blobs;
  if (currentSection === "finalChallenge") return finalChallenge.dmBlobs;
  return []; // Dark Energy sections have no invisible mass gravity at all
}
function isGravityActive() {
  if (currentSection === "darkMatter1") return darkMatter1.phase === "active";
  if (currentSection === "darkMatter2") return darkMatter2.phase === "exploring";
  if (currentSection === "finalChallenge") return finalChallenge.phase === "dmInvestigation";
  return false;
}

// Shared drifting dust particles (used by Dark Matter I & II only).
const gravityParticles = [];
const PARTICLE_COUNT = 45;
function createGravityParticles() {
  gravityParticles.length = 0;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    gravityParticles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4
    });
  }
}
function updateGravityParticles() {
  const blobs = getActiveGravityBlobs();
  for (const particle of gravityParticles) {
    const pull = computeGravityPull(particle.x, particle.y, blobs);
    particle.vx += pull.x * 0.03;
    particle.vy += pull.y * 0.03;
    particle.vx *= 0.99;
    particle.vy *= 0.99;
    particle.x += particle.vx;
    particle.y += particle.vy;
    if (particle.x < 0) particle.x = canvas.width;
    if (particle.x > canvas.width) particle.x = 0;
    if (particle.y < 0) particle.y = canvas.height;
    if (particle.y > canvas.height) particle.y = 0;
  }
}

function wrapText(text, centerX, startY, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let y = startY;
  for (const word of words) {
    const testLine = line + word + " ";
    if (ctx.measureText(testLine).width > maxWidth && line !== "") {
      ctx.fillText(line, centerX, y);
      line = word + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, centerX, y);
}

// ===================================================================
// SHARED SECTION OVERLAYS (intro screen + completion screen)
// ===================================================================
function drawIntroOverlay(mainLine, subLines, promptText) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.font = "26px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(mainLine, canvas.width / 2, 250);

  ctx.font = "16px sans-serif";
  ctx.fillStyle = "#aaaaaa";
  let y = 290;
  for (const line of subLines) {
    ctx.fillText(line, canvas.width / 2, y);
    y += 22;
  }

  ctx.fillStyle = "#66ff99";
  ctx.font = "15px sans-serif";
  ctx.fillText(promptText || "Press any key or click to begin", canvas.width / 2, y + 20);
}

const bottomActionButton = { x: canvas.width / 2 - 130, y: 420, width: 260, height: 44, label: "" };

function drawCompletionOverlay(titleText, bodyText, noteText, buttonLabel) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#66ff99";
  ctx.font = "26px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(titleText, canvas.width / 2, 190);

  ctx.fillStyle = "#ffffff";
  ctx.font = "15px sans-serif";
  wrapText(bodyText, canvas.width / 2, 235, 640, 22);

  ctx.fillStyle = "#888888";
  ctx.font = "13px sans-serif";
  ctx.fillText(noteText, canvas.width / 2, 340);

  bottomActionButton.label = buttonLabel;
  ctx.fillStyle = "#3355ff";
  ctx.fillRect(bottomActionButton.x, bottomActionButton.y, bottomActionButton.width, bottomActionButton.height);
  ctx.fillStyle = "#ffffff";
  ctx.font = "18px sans-serif";
  ctx.fillText(buttonLabel, canvas.width / 2, bottomActionButton.y + 28);
}

function drawMessagePopup() {
  if (messagePopup.framesLeft <= 0) return;
  const boxWidth = 640;
  const boxHeight = 70;
  const boxX = canvas.width / 2 - boxWidth / 2;
  const boxY = canvas.height - 100;

  ctx.fillStyle = "rgba(10, 10, 30, 0.85)";
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
  ctx.strokeStyle = "#5577ff";
  ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

  ctx.fillStyle = "#ffffff";
  ctx.font = "15px sans-serif";
  ctx.textAlign = "center";
  wrapText(messagePopup.text, canvas.width / 2, boxY + 28, boxWidth - 30, 20);
}

// ===================================================================
// DARK MATTER I (unchanged gameplay from Step 4)
// ===================================================================
function createDarkMatter1Section() {
  return {
    blobs: [
      { x: 150, y: 150 },
      { x: 650, y: 180 },
      { x: 400, y: 480 }
    ],
    pings: [
      { x: 220, y: 120, collected: false,
        fact: "Dark matter doesn't give off, reflect, or block light — that's why telescopes can't see it directly." },
      { x: 580, y: 250, collected: false,
        fact: "In the 1970s, astronomer Vera Rubin noticed galaxies spin in a way that only makes sense if extra, unseen mass is pulling on them." },
      { x: 400, y: 550, collected: false,
        fact: "Scientists estimate dark matter makes up about 27% of the universe — but we still don't know exactly what particles it's made of." },
      { x: 680, y: 480, collected: false,
        fact: "We can't see dark matter itself, but we CAN see its effects: it bends starlight and tugs on the paths of stars and gas." }
    ],
    collectedCount: 0,
    totalPings: 4,
    phase: "intro"
  };
}
let darkMatter1 = createDarkMatter1Section();

function updateDarkMatter1() {
  if (darkMatter1.phase !== "active") return;
  updateGravityParticles();

  const COLLECT_RADIUS = 22;
  for (const ping of darkMatter1.pings) {
    if (ping.collected) continue;
    const dx = ping.x - ship.x;
    const dy = ping.y - ship.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < COLLECT_RADIUS) {
      ping.collected = true;
      darkMatter1.collectedCount++;
      addJournalEntry(ping.fact);
      messagePopup = { text: ping.fact, framesLeft: MESSAGE_POPUP_DURATION };
    }
  }

  if (darkMatter1.collectedCount >= darkMatter1.totalPings) {
    darkMatter1.phase = "complete";
  }
  if (messagePopup.framesLeft > 0) messagePopup.framesLeft--;
}

function drawDataPings() {
  const pulse = 3 * Math.sin(Date.now() / 200);
  for (const ping of darkMatter1.pings) {
    if (ping.collected) continue;
    const r = 9 + pulse;
    ctx.fillStyle = "#ffdd33";
    ctx.beginPath();
    ctx.moveTo(ping.x, ping.y - r);
    ctx.lineTo(ping.x + r, ping.y);
    ctx.lineTo(ping.x, ping.y + r);
    ctx.lineTo(ping.x - r, ping.y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawDarkMatter1HUD() {
  ctx.textAlign = "left";
  ctx.fillStyle = "#cccccc";
  ctx.font = "16px sans-serif";
  ctx.fillText("Objective: Investigate the gravitational anomalies", 14, 24);
  ctx.fillStyle = "#ffdd33";
  ctx.font = "14px sans-serif";
  ctx.fillText("Research Data Pings: " + darkMatter1.collectedCount + " / " + darkMatter1.totalPings, 14, 44);
}

// ===================================================================
// DARK MATTER II (unchanged gameplay from Step 5)
// ===================================================================
const GRID_COLS = 4;
const GRID_ROWS = 3;
const CELL_W = canvas.width / GRID_COLS;
const CELL_H = canvas.height / GRID_ROWS;
const NORMALIZE_MAX = 3.0;

function cellIndexForPosition(x, y) {
  let col = Math.floor(x / CELL_W);
  let row = Math.floor(y / CELL_H);
  col = Math.max(0, Math.min(GRID_COLS - 1, col));
  row = Math.max(0, Math.min(GRID_ROWS - 1, row));
  return { col, row };
}
function getCellCenter(col, row) {
  return { x: col * CELL_W + CELL_W / 2, y: row * CELL_H + CELL_H / 2 };
}

function createDarkMatter2Section() {
  const rawBlobs = [
    { x: 300, y: 120 },
    { x: 680, y: 320 },
    { x: 150, y: 480 }
  ];
  const blobs = rawBlobs.map(b => {
    const cell = cellIndexForPosition(b.x, b.y);
    return { x: b.x, y: b.y, homeCol: cell.col, homeRow: cell.row, found: false };
  });

  const cells = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    const rowCells = [];
    for (let col = 0; col < GRID_COLS; col++) {
      rowCells.push({ revealed: false, reading: 0, confirmedFound: false });
    }
    cells.push(rowCells);
  }

  return {
    blobs,
    cells,
    probes: [
      { x: 340, y: 180, collected: false,
        fact: "Scientists can study the motion of visible matter — stars, gas, and dust — to learn about invisible mass nearby." },
      { x: 600, y: 260, collected: false,
        fact: "No single observation is enough. Astronomers combine many measurements to build a model of where unseen mass might be." },
      { x: 210, y: 450, collected: false,
        fact: "Gravitational lensing is one real technique: massive unseen objects can bend the path of light from things behind them." },
      { x: 700, y: 550, collected: false,
        fact: "Even with strong evidence for its gravity, scientists still don't know exactly what particles dark matter is made of." },
      { x: 450, y: 50, collected: false,
        fact: "This Gravity Map is a simplified game tool, not a real scientific map — real dark matter research takes years of data from many telescopes." }
    ],
    observationsCollected: 0,
    totalProbes: 5,
    foundCount: 0,
    totalToFind: 3,
    phase: "intro"
  };
}
let darkMatter2 = createDarkMatter2Section();

const driftAsteroids = [];
const ASTEROID_COUNT = 6;
function createDriftAsteroids() {
  driftAsteroids.length = 0;
  for (let i = 0; i < ASTEROID_COUNT; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    driftAsteroids.push({ x, y, prevX: x, prevY: y, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3 });
  }
}
function updateDriftAsteroids() {
  const blobs = getActiveGravityBlobs();
  for (const a of driftAsteroids) {
    a.prevX = a.x;
    a.prevY = a.y;
    const pull = computeGravityPull(a.x, a.y, blobs);
    a.vx += pull.x * 0.05;
    a.vy += pull.y * 0.05;
    a.vx *= 0.99;
    a.vy *= 0.99;
    a.x += a.vx;
    a.y += a.vy;
    if (a.x < 0) a.x = canvas.width;
    if (a.x > canvas.width) a.x = 0;
    if (a.y < 0) a.y = canvas.height;
    if (a.y > canvas.height) a.y = 0;
  }
}

function revealCell(col, row) {
  const cell = darkMatter2.cells[row][col];
  if (cell.revealed) return;
  cell.revealed = true;
  const center = getCellCenter(col, row);
  const pull = computeGravityPull(center.x, center.y, darkMatter2.blobs);
  cell.reading = Math.sqrt(pull.x * pull.x + pull.y * pull.y);
}

function updateDarkMatter2() {
  if (darkMatter2.phase !== "exploring") return;
  updateGravityParticles();
  updateDriftAsteroids();

  const shipCell = cellIndexForPosition(ship.x, ship.y);
  revealCell(shipCell.col, shipCell.row);

  const COLLECT_RADIUS = 22;
  for (const probe of darkMatter2.probes) {
    if (probe.collected) continue;
    const dx = probe.x - ship.x;
    const dy = probe.y - ship.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < COLLECT_RADIUS) {
      probe.collected = true;
      darkMatter2.observationsCollected++;
      addJournalEntry(probe.fact);
      messagePopup = { text: probe.fact, framesLeft: MESSAGE_POPUP_DURATION };
      const probeCell = cellIndexForPosition(probe.x, probe.y);
      revealCell(probeCell.col, probeCell.row);
    }
  }
  if (messagePopup.framesLeft > 0) messagePopup.framesLeft--;
}

function handleGravityMapGuess(col, row) {
  const cell = darkMatter2.cells[row][col];
  if (!cell.revealed) {
    messagePopup = { text: "Not enough data on this region yet. Explore nearby or find a probe first.", framesLeft: MESSAGE_POPUP_DURATION };
    return;
  }
  let matchedBlob = null;
  for (const blob of darkMatter2.blobs) {
    if (!blob.found && blob.homeCol === col && blob.homeRow === row) { matchedBlob = blob; break; }
  }
  if (matchedBlob) {
    matchedBlob.found = true;
    darkMatter2.foundCount++;
    cell.confirmedFound = true;
    messagePopup = {
      text: "Gravity signature confirmed! You've located a hidden mass. (" + darkMatter2.foundCount + "/" + darkMatter2.totalToFind + ")",
      framesLeft: MESSAGE_POPUP_DURATION
    };
    if (darkMatter2.foundCount >= darkMatter2.totalToFind) {
      darkMatter2.phase = "complete";
    }
  } else {
    messagePopup = {
      text: "Readings here show only weak background gravity — no hidden mass detected in this region. Keep investigating elsewhere.",
      framesLeft: MESSAGE_POPUP_DURATION
    };
  }
}

function drawHexagon(cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
function drawResearchProbes() {
  const pulse = 2 * Math.sin(Date.now() / 220);
  ctx.fillStyle = "#33ff88";
  for (const probe of darkMatter2.probes) {
    if (probe.collected) continue;
    drawHexagon(probe.x, probe.y, 9 + pulse);
    ctx.fill();
  }
}
function drawDriftAsteroids() {
  ctx.lineWidth = 2;
  for (const a of driftAsteroids) {
    const jumpDistance = Math.abs(a.x - a.prevX) + Math.abs(a.y - a.prevY);
    if (jumpDistance < 100) {
      ctx.strokeStyle = "rgba(255, 170, 102, 0.5)";
      ctx.beginPath();
      ctx.moveTo(a.prevX, a.prevY);
      ctx.lineTo(a.x, a.y);
      ctx.stroke();
    }
    ctx.fillStyle = "#ffaa66";
    ctx.beginPath();
    ctx.arc(a.x, a.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }
function readingColor(ratio) {
  ratio = Math.max(0, Math.min(1, ratio));
  let r, g, b;
  if (ratio < 0.5) {
    const t = ratio / 0.5;
    r = Math.round(lerp(60, 255, t)); g = 200; b = 60;
  } else {
    const t = (ratio - 0.5) / 0.5;
    r = 255; g = Math.round(lerp(200, 60, t)); b = 60;
  }
  return "rgb(" + r + "," + g + "," + b + ")";
}

const MAP_X = 600, MAP_TITLE_Y = 24, MAP_GRID_TOP = 34, CELL_PX = 42;

function drawGravityMapPanel() {
  ctx.fillStyle = "rgba(10, 10, 30, 0.55)";
  ctx.fillRect(MAP_X - 10, MAP_TITLE_Y - 16, CELL_PX * GRID_COLS + 20, (MAP_GRID_TOP - MAP_TITLE_Y) + CELL_PX * GRID_ROWS + 34);

  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "13px sans-serif";
  ctx.fillText("GRAVITY MAP", MAP_X, MAP_TITLE_Y);

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const cell = darkMatter2.cells[row][col];
      const x = MAP_X + col * CELL_PX;
      const y = MAP_GRID_TOP + row * CELL_PX;

      ctx.fillStyle = cell.revealed ? readingColor(cell.reading / NORMALIZE_MAX) : "#333344";
      ctx.fillRect(x, y, CELL_PX - 3, CELL_PX - 3);

      if (!cell.revealed) {
        ctx.fillStyle = "#8888aa";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("?", x + (CELL_PX - 3) / 2, y + (CELL_PX - 3) / 2 + 5);
        ctx.textAlign = "left";
      }
      if (cell.confirmedFound) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, CELL_PX - 7, CELL_PX - 7);
      }
    }
  }

  ctx.fillStyle = "#9999aa";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("(simplified game tool — not real data)", MAP_X, MAP_GRID_TOP + CELL_PX * GRID_ROWS + 14);
}

function drawDarkMatter2HUD() {
  ctx.textAlign = "left";
  ctx.fillStyle = "#cccccc";
  ctx.font = "16px sans-serif";
  ctx.fillText("Objective: Investigate and mark the hidden masses", 14, 24);
  ctx.fillStyle = "#33ff88";
  ctx.font = "14px sans-serif";
  ctx.fillText("Observations collected: " + darkMatter2.observationsCollected + " / " + darkMatter2.totalProbes, 14, 44);
  ctx.fillStyle = "#ff8866";
  ctx.fillText("Hidden masses located: " + darkMatter2.foundCount + " / " + darkMatter2.totalToFind, 14, 62);
  ctx.fillStyle = "#888888";
  ctx.font = "12px sans-serif";
  ctx.fillText("Click a measured region on the map if you think mass is hidden there.", 14, 82);
}

// ===================================================================
// DARK ENERGY I — cosmic expansion
// ===================================================================
//
// THE BIG IDEA: everything in this section has a fixed starting offset
// from one shared REFERENCE POINT (the middle of the level). Every frame
// we multiply that offset by a slowly growing "scaleFactor". That's it —
// one formula drives every moving thing in the whole section:
//
//     current position = reference point + (original offset * scaleFactor)
//
// Because farther-away things have a bigger offset, they move a bigger
// absolute distance for the same scaleFactor increase — exactly like real
// cosmic expansion, where more distant galaxies appear to recede faster
// even though space is stretching at the same rate everywhere.
//
// Note the ship is NOT part of this system. Nothing pushes the ship —
// only the WORLD around it rearranges, which is why this feels completely
// different from Dark Matter's gravity pull.

const REF_X = canvas.width / 2;
const REF_Y = canvas.height / 2;
const EXPANSION_RATE = 0.00007; // how fast the scaleFactor grows, per frame

const DARK_ENERGY_FACTS = [
  "The universe is expanding — space itself is stretching, carrying galaxies farther apart over time.",
  "On very large scales, galaxies are generally becoming farther apart as space expands between them.",
  "Scientists call the unknown cause of the universe's accelerating expansion ‘dark energy.’",
  "Scientists still don't know exactly what dark energy is — only that something is causing space to expand faster and faster."
];

// The core expansion formula, shared by Dark Energy I AND II: multiply an
// object's starting offset from the reference point by however much space
// has "stretched" so far (scaleFactor). Passing the scaleFactor in makes this
// reusable for any section that has its own independent scaleFactor.
function expandOffset(offset, scaleFactor) {
  return { x: REF_X + offset.dx * scaleFactor, y: REF_Y + offset.dy * scaleFactor };
}
function worldPos(offset) {
  return expandOffset(offset, darkEnergy1.scaleFactor);
}

// Shared solid-obstacle collision, used by both Dark Energy sections: if the
// ship overlaps a rock, push it back out so it can never clip through.
function resolveRockCollisions(rocks, scaleFactor) {
  for (const rock of rocks) {
    const pos = expandOffset(rock, scaleFactor);
    const dx = ship.x - pos.x;
    const dy = ship.y - pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    const minDistance = ship.size / 2 + rock.radius;
    if (distance < minDistance) {
      const overlap = minDistance - distance;
      ship.x += (dx / distance) * overlap;
      ship.y += (dy / distance) * overlap;
    }
  }
}

// Straight-line distance between two world positions (used to measure how
// far apart the marker galaxies currently are, in both Dark Energy sections).
function distanceBetween(posA, posB) {
  return Math.sqrt((posB.x - posA.x) ** 2 + (posB.y - posA.y) ** 2);
}

function createDarkEnergy1Section() {
  return {
    scaleFactor: 1.0,

    // Purely decorative galaxies at varied distances, so the player can see
    // that FARTHER ones drift apart faster than closer ones.
    decorativeGalaxies: [
      { dx: -250, dy: -180 }, { dx: 220, dy: -160 }, { dx: -300, dy: 150 },
      { dx: 280, dy: 190 }, { dx: -120, dy: -260 }, { dx: 150, dy: 260 }
    ],

    // The two "marker" galaxies whose distance we actually measure.
    markerGalaxies: { A: { dx: -300, dy: 0 }, B: { dx: 300, dy: 0 } },

    // Solid obstacles, in mirrored pairs. Because both rocks in a pair use
    // the SAME scaleFactor, the GAP between them grows too — a path that
    // widens as space expands, using the exact same formula as everything else.
    rocks: [
      { dx: -30, dy: -100, radius: 16 }, { dx: 30, dy: -100, radius: 16 },
      { dx: -30, dy: 140, radius: 16 }, { dx: 30, dy: 140, radius: 16 }
    ],

    stations: [
      { dx: -180, dy: -100, collected: false },
      { dx: 180, dy: -90, collected: false },
      { dx: -160, dy: 140, collected: false },
      { dx: 170, dy: 150, collected: false }
    ],

    observations: [], // recorded A-to-B distances, in the order collected
    visitedCount: 0,
    totalStations: 4,
    phase: "intro"
  };
}
let darkEnergy1 = createDarkEnergy1Section();

function updateDarkEnergy1() {
  if (darkEnergy1.phase !== "expanding") return;

  // Space stretches a little more every frame.
  darkEnergy1.scaleFactor += EXPANSION_RATE;

  // Rocks are solid: push the ship back out if it overlaps one.
  resolveRockCollisions(darkEnergy1.rocks, darkEnergy1.scaleFactor);
  clampShipToBounds();

  // Visiting a Research Station records the CURRENT distance between
  // the two marker galaxies — real, live data showing expansion in action.
  const COLLECT_RADIUS = 24;
  for (const station of darkEnergy1.stations) {
    if (station.collected) continue;
    const pos = worldPos(station);
    const dx = pos.x - ship.x;
    const dy = pos.y - ship.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < COLLECT_RADIUS) {
      station.collected = true;
      darkEnergy1.visitedCount++;

      const posA = worldPos(darkEnergy1.markerGalaxies.A);
      const posB = worldPos(darkEnergy1.markerGalaxies.B);
      const abDistance = Math.round(distanceBetween(posA, posB));
      darkEnergy1.observations.push(abDistance);

      const fact = DARK_ENERGY_FACTS[(darkEnergy1.visitedCount - 1) % DARK_ENERGY_FACTS.length];
      addJournalEntry(fact);
      messagePopup = { text: "Recorded distance: " + abDistance + " px — " + fact, framesLeft: MESSAGE_POPUP_DURATION };
    }
  }

  if (darkEnergy1.visitedCount >= darkEnergy1.totalStations) {
    darkEnergy1.phase = "complete";
  }
  if (messagePopup.framesLeft > 0) messagePopup.framesLeft--;
}

function drawDarkEnergy1World() {
  // A faint marker for the level's reference point — everything's
  // distance is measured from here.
  ctx.strokeStyle = "rgba(150, 150, 180, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(REF_X - 8, REF_Y); ctx.lineTo(REF_X + 8, REF_Y);
  ctx.moveTo(REF_X, REF_Y - 8); ctx.lineTo(REF_X, REF_Y + 8);
  ctx.stroke();

  // Decorative galaxies: small clusters of dots so they read as "galaxies",
  // not single stars.
  ctx.fillStyle = "rgba(200, 210, 255, 0.7)";
  for (const galaxy of darkEnergy1.decorativeGalaxies) {
    const pos = worldPos(galaxy);
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 * i) / 5;
      ctx.beginPath();
      ctx.arc(pos.x + Math.cos(angle) * 6, pos.y + Math.sin(angle) * 6, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // The line connecting the two marker galaxies, with a live distance readout.
  const posA = worldPos(darkEnergy1.markerGalaxies.A);
  const posB = worldPos(darkEnergy1.markerGalaxies.B);
  const liveDistance = Math.round(distanceBetween(posA, posB));

  ctx.strokeStyle = "rgba(255, 220, 120, 0.5)";
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(posA.x, posA.y);
  ctx.lineTo(posB.x, posB.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#ffdd88";
  ctx.font = "13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(liveDistance + " px", (posA.x + posB.x) / 2, (posA.y + posB.y) / 2 - 10);

  // Marker galaxies themselves (bigger, labeled A / B)
  for (const [label, pos] of [["A", posA], ["B", posB]]) {
    ctx.fillStyle = "#88bbff";
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px sans-serif";
    ctx.fillText(label, pos.x, pos.y - 16);
  }

  // Rocks (solid obstacles forming a widening gap)
  ctx.fillStyle = "#998877";
  for (const rock of darkEnergy1.rocks) {
    const pos = worldPos(rock);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, rock.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Research Stations (uncollected only)
  const pulse = 2 * Math.sin(Date.now() / 200);
  for (const station of darkEnergy1.stations) {
    if (station.collected) continue;
    const pos = worldPos(station);
    ctx.fillStyle = "#66ddff";
    ctx.fillRect(pos.x - 7 - pulse / 2, pos.y - 7 - pulse / 2, 14 + pulse, 14 + pulse);
  }
}

function drawDarkEnergy1HUD() {
  ctx.textAlign = "left";
  ctx.fillStyle = "#cccccc";
  ctx.font = "16px sans-serif";
  ctx.fillText("Objective: Measure how the universe is changing", 14, 24);

  ctx.fillStyle = "#66ddff";
  ctx.font = "14px sans-serif";
  ctx.fillText("Research Stations visited: " + darkEnergy1.visitedCount + " / " + darkEnergy1.totalStations, 14, 44);

  ctx.fillStyle = "#ffdd88";
  ctx.font = "12px sans-serif";
  if (darkEnergy1.observations.length > 0) {
    ctx.fillText("Recorded distances (px): " + darkEnergy1.observations.join(" → "), 14, 62);
  } else {
    ctx.fillText("Recorded distances (px): (visit a station to record one)", 14, 62);
  }
}

// ===================================================================
// DARK ENERGY II — accelerating expansion
// ===================================================================
//
// Dark Energy I used a CONSTANT expansion rate (scaleFactor grew by the
// same tiny amount every frame). Dark Energy II's whole point is that the
// RATE ITSELF grows over time — that's the actual scientific idea of an
// ACCELERATING expansion, not just an expanding one.
//
//   scaleFactor    += expansionRate        (space stretches a bit more...)
//   expansionRate  += ACCELERATION_AMOUNT   (...and that "bit more" itself grows)
//
// Both numbers change smoothly, once per frame, by a tiny fixed step — so
// nothing ever jumps or teleports. Early on, expansionRate is small, so
// growth feels a lot like Dark Energy I. Late in the section, expansionRate
// has grown several times larger, so the SAME formula produces noticeably
// bigger jumps in distance — the player feels the acceleration happen,
// instead of being told about it.

const DE2_INITIAL_EXPANSION_RATE = 0.00003; // slower start than Dark Energy I on purpose
const DE2_ACCELERATION_AMOUNT = 0.000000005; // how much faster expansion gets, per frame

const DARK_ENERGY2_FACTS = [
  "Scientists can measure how quickly distances between distant galaxies change over time.",
  "By comparing observations from different times, scientists can tell if the expansion rate itself is changing.",
  "Observations show that the universe's expansion is accelerating — it's not just expanding at a constant rate.",
  "Dark energy is the name scientists use for the unknown cause of this accelerating expansion.",
  "Scientists still don't know exactly what dark energy is."
];

function worldPosDE2(offset) {
  return expandOffset(offset, darkEnergy2.scaleFactor);
}

function createDarkEnergy2Section() {
  return {
    scaleFactor: 1.0,
    expansionRate: DE2_INITIAL_EXPANSION_RATE,
    elapsedFrames: 0,

    decorativeGalaxies: [
      { dx: -260, dy: -190 }, { dx: 230, dy: -170 }, { dx: -310, dy: 160 },
      { dx: 290, dy: 200 }, { dx: -130, dy: -270 }, { dx: 160, dy: 270 }
    ],
    markerGalaxies: { A: { dx: -320, dy: 0 }, B: { dx: 320, dy: 0 } },

    // Same widening-gap idea as Dark Energy I, reused with fresh positions.
    rocks: [
      { dx: -30, dy: -110, radius: 16 }, { dx: 30, dy: -110, radius: 16 },
      { dx: -30, dy: 150, radius: 16 }, { dx: 30, dy: 150, radius: 16 }
    ],

    stations: [
      { dx: -190, dy: -110, collected: false },
      { dx: 190, dy: -100, collected: false },
      { dx: 0, dy: -220, collected: false },
      { dx: -170, dy: 150, collected: false },
      { dx: 180, dy: 160, collected: false }
    ],

    observations: [], // one record per collected station, see updateDarkEnergy2()
    visitedCount: 0,
    totalStations: 5,
    phase: "intro"
  };
}
let darkEnergy2 = createDarkEnergy2Section();

function updateDarkEnergy2() {
  if (darkEnergy2.phase !== "expanding") return;

  darkEnergy2.elapsedFrames++;

  // --- THE ACCELERATION ITSELF ---
  // Space stretches a little more this frame (using the CURRENT rate)...
  darkEnergy2.scaleFactor += darkEnergy2.expansionRate;
  // ...and then the rate for NEXT frame gets a little bigger too.
  // This tiny second line is the entire difference between "expanding"
  // (Dark Energy I) and "accelerating expansion" (Dark Energy II).
  darkEnergy2.expansionRate += DE2_ACCELERATION_AMOUNT;

  resolveRockCollisions(darkEnergy2.rocks, darkEnergy2.scaleFactor);
  clampShipToBounds();

  const COLLECT_RADIUS = 24;
  for (const station of darkEnergy2.stations) {
    if (station.collected) continue;
    const pos = worldPosDE2(station);
    const dx = pos.x - ship.x;
    const dy = pos.y - ship.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < COLLECT_RADIUS) {
      station.collected = true;
      darkEnergy2.visitedCount++;

      // Record this moment's data: when, how far apart, and (from the
      // 2nd observation on) how much that changed since the last one.
      const posA = worldPosDE2(darkEnergy2.markerGalaxies.A);
      const posB = worldPosDE2(darkEnergy2.markerGalaxies.B);
      const distance_ = distanceBetween(posA, posB);
      const timeSeconds = darkEnergy2.elapsedFrames / 60; // 60 frames per second

      const previous = darkEnergy2.observations[darkEnergy2.observations.length - 1];
      const deltaDistance = previous ? distance_ - previous.distanceRaw : null;
      const deltaTime = previous ? timeSeconds - previous.timeSeconds : null;
      const measuredRate = (deltaDistance !== null && deltaTime > 0) ? deltaDistance / deltaTime : null;

      const record = {
        index: darkEnergy2.visitedCount,
        timeSeconds: Math.round(timeSeconds * 10) / 10,
        distance: Math.round(distance_),
        distanceRaw: distance_, // unrounded, used for the NEXT delta calculation
        measuredRate: measuredRate !== null ? Math.round(measuredRate * 10) / 10 : null
      };
      darkEnergy2.observations.push(record);

      const fact = DARK_ENERGY2_FACTS[(darkEnergy2.visitedCount - 1) % DARK_ENERGY2_FACTS.length];
      addJournalEntry(fact);

      let popupText = "Observation " + record.index + " (t=" + record.timeSeconds + "s): distance = " + record.distance + " px";
      if (record.measuredRate !== null) {
        popupText += ", rate ≈ " + record.measuredRate + " px/s";
      }
      popupText += " — " + fact;
      messagePopup = { text: popupText, framesLeft: MESSAGE_POPUP_DURATION };
    }
  }

  if (darkEnergy2.visitedCount >= darkEnergy2.totalStations) {
    darkEnergy2.phase = "complete";
  }
  if (messagePopup.framesLeft > 0) messagePopup.framesLeft--;
}

function drawDarkEnergy2World() {
  ctx.strokeStyle = "rgba(150, 150, 180, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(REF_X - 8, REF_Y); ctx.lineTo(REF_X + 8, REF_Y);
  ctx.moveTo(REF_X, REF_Y - 8); ctx.lineTo(REF_X, REF_Y + 8);
  ctx.stroke();

  ctx.fillStyle = "rgba(200, 230, 255, 0.7)";
  for (const galaxy of darkEnergy2.decorativeGalaxies) {
    const pos = worldPosDE2(galaxy);
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 * i) / 5;
      ctx.beginPath();
      ctx.arc(pos.x + Math.cos(angle) * 6, pos.y + Math.sin(angle) * 6, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const posA = worldPosDE2(darkEnergy2.markerGalaxies.A);
  const posB = worldPosDE2(darkEnergy2.markerGalaxies.B);
  const liveDistance = Math.round(distanceBetween(posA, posB));

  ctx.strokeStyle = "rgba(255, 150, 150, 0.5)";
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(posA.x, posA.y);
  ctx.lineTo(posB.x, posB.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#ffaaaa";
  ctx.font = "13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(liveDistance + " px", (posA.x + posB.x) / 2, (posA.y + posB.y) / 2 - 10);

  for (const [label, pos] of [["A", posA], ["B", posB]]) {
    ctx.fillStyle = "#ff9999";
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px sans-serif";
    ctx.fillText(label, pos.x, pos.y - 16);
  }

  ctx.fillStyle = "#998877";
  for (const rock of darkEnergy2.rocks) {
    const pos = worldPosDE2(rock);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, rock.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const pulse = 2 * Math.sin(Date.now() / 200);
  for (const station of darkEnergy2.stations) {
    if (station.collected) continue;
    const pos = worldPosDE2(station);
    ctx.fillStyle = "#66ddff";
    ctx.fillRect(pos.x - 7 - pulse / 2, pos.y - 7 - pulse / 2, 14 + pulse, 14 + pulse);
  }
}

function drawDarkEnergy2HUD() {
  ctx.textAlign = "left";
  ctx.fillStyle = "#cccccc";
  ctx.font = "16px sans-serif";
  ctx.fillText("Objective: Measure how the expansion rate changes over time", 14, 24);

  ctx.fillStyle = "#66ddff";
  ctx.font = "14px sans-serif";
  ctx.fillText("Research Stations visited: " + darkEnergy2.visitedCount + " / " + darkEnergy2.totalStations, 14, 44);

  // A live, ever-ticking-up readout of the CURRENT expansion rate, so the
  // player can watch the number itself grow even between observations.
  const instantRatePxPerSec = Math.round(640 * darkEnergy2.expansionRate * 60 * 10) / 10;
  ctx.fillStyle = "#ffaaaa";
  ctx.font = "12px sans-serif";
  ctx.fillText("Current expansion rate: ≈ " + instantRatePxPerSec + " px/s (watch this climb)", 14, 62);
}

// A minimal bar graph of measured expansion rate per observation — exactly
// the kind of "simple graph" a scientist might sketch to SEE a trend, not a
// precise scientific instrument.
function drawExpansionRateGraph() {
  const panelX = 600, panelY = 14, panelW = 180, panelH = 110;
  ctx.fillStyle = "rgba(10, 10, 30, 0.55)";
  ctx.fillRect(panelX, panelY, panelW, panelH);

  ctx.fillStyle = "#ffffff";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("EXPANSION RATE", panelX + 8, panelY + 16);

  const rates = darkEnergy2.observations
    .map(o => o.measuredRate)
    .filter(r => r !== null && r !== undefined);

  const axisX = panelX + 16, axisBottomY = panelY + panelH - 10, axisTopY = panelY + 30;
  ctx.strokeStyle = "#666688";
  ctx.beginPath();
  ctx.moveTo(axisX, axisTopY); ctx.lineTo(axisX, axisBottomY); ctx.lineTo(panelX + panelW - 10, axisBottomY);
  ctx.stroke();

  if (rates.length === 0) {
    ctx.fillStyle = "#8888aa";
    ctx.font = "11px sans-serif";
    ctx.fillText("(need 2+ observations)", panelX + 8, (axisTopY + axisBottomY) / 2);
    return;
  }

  const maxRate = Math.max(...rates);
  const barAreaWidth = panelX + panelW - 20 - axisX;
  const barWidth = Math.min(20, barAreaWidth / rates.length - 6);

  rates.forEach((rate, i) => {
    const barHeight = maxRate > 0 ? (rate / maxRate) * (axisBottomY - axisTopY) : 0;
    const barX = axisX + 8 + i * (barWidth + 6);
    ctx.fillStyle = "#ff8888";
    ctx.fillRect(barX, axisBottomY - barHeight, barWidth, barHeight);
  });

  ctx.fillStyle = "#9999aa";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("time →", panelX + panelW / 2, panelY + panelH - 2);
  ctx.textAlign = "left";
}

// ===================================================================
// FINAL CHALLENGE — combining Dark Matter + Dark Energy
// ===================================================================
//
// This section deliberately does NOT invent new physics. Part 1 reuses the
// exact same gravity system as Dark Matter I/II (computeGravityPull,
// gravityParticles, driftAsteroids). Part 2 reuses the exact same
// accelerating-expansion formula as Dark Energy II (expandOffset,
// scaleFactor += expansionRate; expansionRate += acceleration). The only
// things that are new here are the STATIONS, the phase flow that stitches
// the two investigations together, and the final analysis/ending screens.

// Short in-world flavor messages shown while investigating gravity —
// NOT science-journal facts by themselves; the one canonical fact gets
// added once ALL stations are visited (see updateFinalChallenge below).
const FINAL_DM_STATION_MESSAGES = [
  "Something unseen is affecting nearby objects.",
  "Nearby dust and asteroids are curving along unexpected paths.",
  "Your ship's path is drifting more than usual here.",
  "Gravitational measurement recorded."
];

function worldPosFinal(offset) {
  return expandOffset(offset, finalChallenge.scaleFactor);
}

function createFinalChallengeSection() {
  return {
    // --- Part 1: Dark Matter investigation ---
    dmBlobs: [
      { x: 200, y: 200 },
      { x: 600, y: 200 },
      { x: 400, y: 480 }
    ],
    dmStations: [
      { x: 260, y: 260, collected: false },
      { x: 560, y: 260, collected: false },
      { x: 260, y: 440, collected: false },
      { x: 560, y: 440, collected: false }
    ],
    dmStationsVisited: 0,
    totalDmStations: 4,

    // --- Part 2: Dark Energy investigation (reuses Dark Energy II's formula) ---
    scaleFactor: 1.0,
    expansionRate: DE2_INITIAL_EXPANSION_RATE,
    elapsedFrames: 0,
    markerGalaxies: { A: { dx: -280, dy: 0 }, B: { dx: 280, dy: 0 } },
    deStations: [
      { dx: -150, dy: -130, collected: false },
      { dx: 150, dy: -120, collected: false },
      { dx: -140, dy: 160, collected: false },
      { dx: 150, dy: 150, collected: false }
    ],
    deStationsVisited: 0,
    totalDeStations: 4,
    deObservations: [],

    // --- Part 3: Final analysis ---
    analysisSelected: { A: false, B: false },

    // intro -> dmInvestigation -> dmEvidence -> deTransition -> deInvestigation
    //       -> analysis -> ending -> journalView
    phase: "intro"
  };
}
let finalChallenge = createFinalChallengeSection();

// ----- Part 1 update: Dark Matter investigation -----
function updateFinalChallengeDarkMatter() {
  updateGravityParticles();
  updateDriftAsteroids();

  const COLLECT_RADIUS = 24;
  for (const station of finalChallenge.dmStations) {
    if (station.collected) continue;
    const dx = station.x - ship.x;
    const dy = station.y - ship.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < COLLECT_RADIUS) {
      station.collected = true;
      finalChallenge.dmStationsVisited++;
      const msg = FINAL_DM_STATION_MESSAGES[(finalChallenge.dmStationsVisited - 1) % FINAL_DM_STATION_MESSAGES.length];
      messagePopup = { text: msg, framesLeft: MESSAGE_POPUP_DURATION };
    }
  }

  if (finalChallenge.dmStationsVisited >= finalChallenge.totalDmStations) {
    // ONE careful, non-overclaiming fact for the whole investigation —
    // not "we found dark matter", just what the evidence is consistent with.
    addJournalEntry("The observations are consistent with the effects scientists attribute to dark matter.");
    finalChallenge.phase = "dmEvidence";
  }
}

// ----- Part 2 update: Dark Energy investigation -----
function updateFinalChallengeDarkEnergy() {
  finalChallenge.elapsedFrames++;

  // Same accelerating-expansion formula as Dark Energy II, just with this
  // section's own scaleFactor/expansionRate so it doesn't touch DE2's state.
  finalChallenge.scaleFactor += finalChallenge.expansionRate;
  finalChallenge.expansionRate += DE2_ACCELERATION_AMOUNT;

  const COLLECT_RADIUS = 24;
  for (const station of finalChallenge.deStations) {
    if (station.collected) continue;
    const pos = worldPosFinal(station);
    const dx = pos.x - ship.x;
    const dy = pos.y - ship.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < COLLECT_RADIUS) {
      station.collected = true;
      finalChallenge.deStationsVisited++;

      const posA = worldPosFinal(finalChallenge.markerGalaxies.A);
      const posB = worldPosFinal(finalChallenge.markerGalaxies.B);
      const currentDistance = distanceBetween(posA, posB);
      const timeSeconds = finalChallenge.elapsedFrames / 60;

      const previous = finalChallenge.deObservations[finalChallenge.deObservations.length - 1];
      const deltaDistance = previous ? currentDistance - previous.distanceRaw : null;
      const deltaTime = previous ? timeSeconds - previous.timeSeconds : null;
      const measuredRate = (deltaDistance !== null && deltaTime > 0) ? deltaDistance / deltaTime : null;

      const record = {
        index: finalChallenge.deStationsVisited,
        timeSeconds: Math.round(timeSeconds * 10) / 10,
        distance: Math.round(currentDistance),
        distanceRaw: currentDistance,
        measuredRate: measuredRate !== null ? Math.round(measuredRate * 10) / 10 : null
      };
      finalChallenge.deObservations.push(record);

      let popupText = "Observation " + record.index + " (t=" + record.timeSeconds + "s): distance = " + record.distance + " px";
      if (record.measuredRate !== null) popupText += ", rate ≈ " + record.measuredRate + " px/s";
      messagePopup = { text: popupText, framesLeft: MESSAGE_POPUP_DURATION };
    }
  }

  if (finalChallenge.deStationsVisited >= finalChallenge.totalDeStations) {
    addJournalEntry("Measurements show that cosmic expansion is accelerating.");
    finalChallenge.phase = "analysis";
  }
}

function updateFinalChallenge() {
  if (finalChallenge.phase === "dmInvestigation") {
    updateFinalChallengeDarkMatter();
  } else if (finalChallenge.phase === "deInvestigation") {
    updateFinalChallengeDarkEnergy();
  }
  if (messagePopup.framesLeft > 0) messagePopup.framesLeft--;
}

// ----- Drawing: Part 1 world (gravity investigation) -----
function drawFinalChallengeDarkMatterWorld() {
  drawGravityParticles();
  drawDriftAsteroids();

  const pulse = 2 * Math.sin(Date.now() / 220);
  ctx.fillStyle = "#cc99ff";
  for (const station of finalChallenge.dmStations) {
    if (station.collected) continue;
    drawHexagon(station.x, station.y, 9 + pulse);
    ctx.fill();
  }
}

// ----- Drawing: Part 2 world (expansion investigation) -----
function drawFinalChallengeDarkEnergyWorld() {
  const posA = worldPosFinal(finalChallenge.markerGalaxies.A);
  const posB = worldPosFinal(finalChallenge.markerGalaxies.B);
  const liveDistance = Math.round(distanceBetween(posA, posB));

  ctx.strokeStyle = "rgba(200, 180, 255, 0.5)";
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(posA.x, posA.y);
  ctx.lineTo(posB.x, posB.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#ddbbff";
  ctx.font = "13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(liveDistance + " px", (posA.x + posB.x) / 2, (posA.y + posB.y) / 2 - 10);

  for (const [label, pos] of [["A", posA], ["B", posB]]) {
    ctx.fillStyle = "#bb88ff";
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px sans-serif";
    ctx.fillText(label, pos.x, pos.y - 16);
  }

  const pulse = 2 * Math.sin(Date.now() / 200);
  for (const station of finalChallenge.deStations) {
    if (station.collected) continue;
    const pos = worldPosFinal(station);
    ctx.fillStyle = "#66ddff";
    ctx.fillRect(pos.x - 7 - pulse / 2, pos.y - 7 - pulse / 2, 14 + pulse, 14 + pulse);
  }
}

// Objectives checklist HUD — shared across both investigation phases so the
// player always sees the big picture, not just the current sub-task.
function drawFinalChallengeHUD() {
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "16px sans-serif";
  ctx.fillText("FINAL INVESTIGATION", 14, 24);

  ctx.font = "14px sans-serif";
  ctx.fillStyle = "#cccccc";
  const dmDone = finalChallenge.dmStationsVisited >= finalChallenge.totalDmStations;
  const deDone = finalChallenge.deStationsVisited >= finalChallenge.totalDeStations;
  const analysisDone = finalChallenge.analysisSelected.A && finalChallenge.analysisSelected.B;

  ctx.fillStyle = dmDone ? "#88ff99" : "#cccccc";
  ctx.fillText((dmDone ? "☑" : "☐") + " Find evidence of unseen mass", 14, 46);
  ctx.fillStyle = deDone ? "#88ff99" : "#cccccc";
  ctx.fillText((deDone ? "☑" : "☐") + " Measure accelerating expansion", 14, 66);
  ctx.fillStyle = analysisDone ? "#88ff99" : "#cccccc";
  ctx.fillText((analysisDone ? "☑" : "☐") + " Connect the observations", 14, 86);

  if (finalChallenge.phase === "dmInvestigation") {
    ctx.fillStyle = "#cc99ff";
    ctx.font = "13px sans-serif";
    ctx.fillText("Gravitational measurements: " + finalChallenge.dmStationsVisited + " / " + finalChallenge.totalDmStations, 14, 108);
  } else if (finalChallenge.phase === "deInvestigation") {
    ctx.fillStyle = "#66ddff";
    ctx.font = "13px sans-serif";
    ctx.fillText("Observation stations: " + finalChallenge.deStationsVisited + " / " + finalChallenge.totalDeStations, 14, 108);
  }
}

// ----- Final Analysis (evidence cards) -----
const analysisCardA = { x: 170, y: 300, width: 140, height: 100, label: "A", title: "Gravitational Effects" };
const analysisCardB = { x: 330, y: 300, width: 140, height: 100, label: "B", title: "Accelerating Expansion" };
const analysisCardC = { x: 490, y: 300, width: 140, height: 100, label: "C", title: "Visible Stars" };

function handleAnalysisCardClick(card) {
  if (card.label === "C") {
    messagePopup = {
      text: "Visible stars are important to look at, but by themselves they don't reveal unseen mass or show how fast the universe is expanding. Try again.",
      framesLeft: MESSAGE_POPUP_DURATION
    };
    return;
  }
  if (card.label === "A") {
    finalChallenge.analysisSelected.A = true;
    messagePopup = { text: "Correct! Gravitational effects are how scientists infer unseen mass.", framesLeft: MESSAGE_POPUP_DURATION };
  } else if (card.label === "B") {
    finalChallenge.analysisSelected.B = true;
    messagePopup = { text: "Correct! Accelerating expansion is measured by comparing observations over time.", framesLeft: MESSAGE_POPUP_DURATION };
  }
}

function drawEvidenceCard(card, selected) {
  ctx.fillStyle = selected ? "rgba(100, 220, 140, 0.35)" : "rgba(30, 30, 60, 0.7)";
  ctx.fillRect(card.x, card.y, card.width, card.height);
  ctx.strokeStyle = selected ? "#66ff99" : "#5577ff";
  ctx.lineWidth = 2;
  ctx.strokeRect(card.x, card.y, card.width, card.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "20px sans-serif";
  ctx.fillText(card.label, card.x + card.width / 2, card.y + 34);

  ctx.font = "13px sans-serif";
  wrapText(card.title, card.x + card.width / 2, card.y + 58, card.width - 16, 16);

  if (selected) {
    ctx.fillStyle = "#66ff99";
    ctx.font = "18px sans-serif";
    ctx.fillText("✓", card.x + card.width / 2, card.y + card.height - 10);
  }
}

function drawFinalAnalysis() {
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "26px sans-serif";
  ctx.fillText("FINAL ANALYSIS", canvas.width / 2, 90);

  ctx.font = "14px sans-serif";
  ctx.fillStyle = "#88bbff";
  ctx.fillText("DARK MATTER: Observed gravitational effects suggest the presence of unseen mass.", canvas.width / 2, 130);
  ctx.fillStyle = "#ff9999";
  ctx.fillText("DARK ENERGY: Measurements show that cosmic expansion is accelerating.", canvas.width / 2, 155);

  ctx.fillStyle = "#cccccc";
  ctx.font = "15px sans-serif";
  ctx.fillText("Which observations helped reveal the two mysteries?", canvas.width / 2, 210);
  ctx.font = "12px sans-serif";
  ctx.fillStyle = "#888888";
  ctx.fillText("(Choose the two correct pieces of evidence. Wrong picks just let you try again.)", canvas.width / 2, 230);

  drawEvidenceCard(analysisCardA, finalChallenge.analysisSelected.A);
  drawEvidenceCard(analysisCardB, finalChallenge.analysisSelected.B);
  drawEvidenceCard(analysisCardC, false);

  if (finalChallenge.analysisSelected.A && finalChallenge.analysisSelected.B) {
    ctx.fillStyle = "#66ff99";
    ctx.font = "15px sans-serif";
    wrapText(
      "Final conclusion: Scientists use observations and evidence to study things they cannot directly see.",
      canvas.width / 2, 440, 620, 22
    );

    bottomActionButton.label = "Continue";
    ctx.fillStyle = "#3355ff";
    ctx.fillRect(bottomActionButton.x, bottomActionButton.y, bottomActionButton.width, bottomActionButton.height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "18px sans-serif";
    ctx.fillText(bottomActionButton.label, canvas.width / 2, bottomActionButton.y + 28);
  }

  drawMessagePopup();
}

// ----- "What I Learned" ending screen -----
const reviewJournalButton = { x: canvas.width / 2 - 140, y: 380, width: 280, height: 40, label: "Review Science Journal" };
const playAgainButton = { x: canvas.width / 2 - 140, y: 432, width: 280, height: 40, label: "Play Again" };
const returnMenuButtonFinal = { x: canvas.width / 2 - 140, y: 484, width: 280, height: 40, label: "Return to Main Menu" };

function drawButton(btn) {
  ctx.fillStyle = "#3355ff";
  ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
  ctx.fillStyle = "#ffffff";
  ctx.font = "16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(btn.label, btn.x + btn.width / 2, btn.y + btn.height / 2 + 5);
}

function drawWhatILearnedScreen() {
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "34px sans-serif";
  ctx.fillText("WHAT I LEARNED", canvas.width / 2, 60);

  ctx.font = "bold 20px sans-serif";
  ctx.fillStyle = "#88bbff";
  ctx.fillText("🌌 DARK MATTER", canvas.width / 2, 115);
  ctx.font = "16px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Scientists infer unseen matter from its gravitational effects.", canvas.width / 2, 142);

  ctx.font = "bold 20px sans-serif";
  ctx.fillStyle = "#ff9999";
  ctx.fillText("🚀 DARK ENERGY", canvas.width / 2, 185);
  ctx.font = "16px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Scientists observe that the universe's expansion is accelerating.", canvas.width / 2, 212);

  ctx.font = "bold 20px sans-serif";
  ctx.fillStyle = "#ffdd88";
  ctx.fillText("🔭 THE BIG IDEA", canvas.width / 2, 255);
  ctx.font = "16px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Scientists can learn about things they cannot directly see", canvas.width / 2, 282);
  ctx.fillText("by studying their effects and collecting evidence.", canvas.width / 2, 306);

  ctx.font = "italic 15px sans-serif";
  ctx.fillStyle = "#aaaaaa";
  ctx.fillText("The universe still has mysteries left to solve.", canvas.width / 2, 345);

  drawButton(reviewJournalButton);
  drawButton(playAgainButton);
  drawButton(returnMenuButtonFinal);
}

// ----- Curated Science Journal review screen -----
const journalBackButton = { x: canvas.width / 2 - 100, y: 520, width: 200, height: 40, label: "Back" };

function drawJournalSection(headerText, headerColor, bullets, startY) {
  ctx.textAlign = "left";
  ctx.font = "bold 18px sans-serif";
  ctx.fillStyle = headerColor;
  ctx.fillText(headerText, 100, startY);

  ctx.font = "15px sans-serif";
  ctx.fillStyle = "#e0e0e0";
  let y = startY + 24;
  for (const bullet of bullets) {
    ctx.fillText("• " + bullet, 110, y);
    y += 22;
  }
  return y;
}

function drawJournalView() {
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "28px sans-serif";
  ctx.fillText("SCIENCE JOURNAL", canvas.width / 2, 50);

  drawJournalSection("1. Dark Matter", "#88bbff", [
    "Dark matter cannot be directly seen with ordinary light.",
    "Scientists infer its presence from gravitational effects.",
    "It may help explain how galaxies and larger structures behave.",
    "Scientists do not yet know exactly what dark matter is."
  ], 95);

  drawJournalSection("2. Dark Energy", "#ff9999", [
    "The universe is expanding.",
    "The expansion is accelerating.",
    "Scientists call the unknown cause of this acceleration dark energy.",
    "Scientists do not yet know exactly what dark energy is."
  ], 225);

  drawJournalSection("3. How Scientists Investigate", "#ffdd88", [
    "Scientists collect observations.",
    "They measure changes.",
    "They compare different observations.",
    "They build models to explain evidence.",
    "Scientific ideas can remain partly unknown while evidence is still being collected."
  ], 355);

  ctx.textAlign = "left";
  drawButton(journalBackButton);
}

// ===================================================================
// SHIP MOVEMENT (shared)
// ===================================================================
function updateShip() {
  let dx = 0;
  let dy = 0;

  if (keysPressed["w"] || keysPressed["arrowup"]) dy -= 1;
  if (keysPressed["s"] || keysPressed["arrowdown"]) dy += 1;
  if (keysPressed["a"] || keysPressed["arrowleft"]) dx -= 1;
  if (keysPressed["d"] || keysPressed["arrowright"]) dx += 1;

  if (dx !== 0 && dy !== 0) {
    dx *= 0.7071;
    dy *= 0.7071;
  }

  ship.x += dx * ship.speed;
  ship.y += dy * ship.speed;

  let shipPullMagnitude = 0;
  if (isGravityActive()) {
    const blobs = getActiveGravityBlobs();
    const pull = computeGravityPull(ship.x, ship.y, blobs);
    shipPullMagnitude = Math.sqrt(pull.x * pull.x + pull.y * pull.y);
    if (shipPullMagnitude > MAX_SHIP_PULL_PER_FRAME) {
      const scale = MAX_SHIP_PULL_PER_FRAME / shipPullMagnitude;
      pull.x *= scale;
      pull.y *= scale;
      shipPullMagnitude = MAX_SHIP_PULL_PER_FRAME;
    }
    ship.x += pull.x;
    ship.y += pull.y;
  }

  clampShipToBounds();
  ship.lastPullMagnitude = shipPullMagnitude;
}

function handleAnyKeyPress() {
  if (currentSection === "darkMatter1" && darkMatter1.phase === "intro") darkMatter1.phase = "active";
  if (currentSection === "darkMatter2" && darkMatter2.phase === "intro") darkMatter2.phase = "exploring";
  if (currentSection === "darkEnergy1" && darkEnergy1.phase === "intro") darkEnergy1.phase = "expanding";
  if (currentSection === "darkEnergy2" && darkEnergy2.phase === "intro") darkEnergy2.phase = "expanding";
  if (currentSection === "finalChallenge") {
    if (finalChallenge.phase === "intro") finalChallenge.phase = "dmInvestigation";
    else if (finalChallenge.phase === "deTransition") finalChallenge.phase = "deInvestigation";
  }
}

// ===================================================================
// DRAWING
// ===================================================================
function drawMenu() {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.font = "40px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("DARK MATTER", canvas.width / 2, 170);

  ctx.font = "18px sans-serif";
  ctx.fillStyle = "#aaaaaa";
  ctx.fillText("A Space Exploration Game", canvas.width / 2, 205);

  ctx.fillStyle = "#3355ff";
  ctx.fillRect(startButton.x, startButton.y, startButton.width, startButton.height);
  ctx.fillStyle = "#ffffff";
  ctx.font = "20px sans-serif";
  ctx.fillText(startButton.label, canvas.width / 2, startButton.y + 32);

  for (const btn of [previewDM2Button, previewDE1Button, previewDE2Button, previewFinalButton]) {
    ctx.fillStyle = "#222244";
    ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
    ctx.fillStyle = "#aaaaee";
    ctx.font = "14px sans-serif";
    ctx.fillText(btn.label, canvas.width / 2, btn.y + 22);
  }
}

function drawStarfield() {
  ctx.fillStyle = "#ffffff";
  for (const star of stars) {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
function drawGravityParticles() {
  ctx.fillStyle = "rgba(140, 160, 255, 0.55)";
  for (const particle of gravityParticles) {
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}
function drawShip() {
  const halfSize = ship.size / 2;

  if (ship.lastPullMagnitude > 0) {
    const glowStrength = Math.min(ship.lastPullMagnitude / MAX_SHIP_PULL_PER_FRAME, 1);
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, halfSize + 10, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(150, 100, 255, " + (glowStrength * 0.35) + ")";
    ctx.fill();
  }

  ctx.fillStyle = "#00e5ff";
  ctx.beginPath();
  ctx.moveTo(ship.x, ship.y - halfSize);
  ctx.lineTo(ship.x - halfSize, ship.y + halfSize);
  ctx.lineTo(ship.x + halfSize, ship.y + halfSize);
  ctx.closePath();
  ctx.fill();
}

function drawGame() {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawStarfield();

  if (currentSection === "darkMatter1") {
    drawGravityParticles();
    drawDataPings();
  } else if (currentSection === "darkMatter2") {
    drawGravityParticles();
    drawDriftAsteroids();
    drawResearchProbes();
  } else if (currentSection === "darkEnergy1") {
    drawDarkEnergy1World();
  } else if (currentSection === "darkEnergy2") {
    drawDarkEnergy2World();
  } else if (currentSection === "finalChallenge") {
    if (finalChallenge.phase === "dmInvestigation" || finalChallenge.phase === "dmEvidence") {
      drawFinalChallengeDarkMatterWorld();
    } else if (finalChallenge.phase === "deTransition" || finalChallenge.phase === "deInvestigation") {
      drawFinalChallengeDarkEnergyWorld();
    }
  }

  // The analysis/ending/journal screens are clean, static presentation
  // screens — the ship isn't flying anywhere, so we don't draw it there.
  const finalChallengeUiPhases = ["analysis", "ending", "journalView"];
  const showShip = !(currentSection === "finalChallenge" && finalChallengeUiPhases.includes(finalChallenge.phase));
  if (showShip) drawShip();

  if (currentSection === "darkMatter1") {
    if (darkMatter1.phase === "active" || darkMatter1.phase === "complete") {
      drawDarkMatter1HUD();
      drawMessagePopup();
    }
    if (darkMatter1.phase === "intro") {
      drawIntroOverlay(
        "Something invisible is affecting your ship's path...",
        ["Watch how your ship drifts, and how nearby dust curves,", "to figure out where it's coming from."]
      );
    }
    if (darkMatter1.phase === "complete") {
      drawCompletionOverlay(
        "Dark Matter I — Complete!",
        "You just did what real astronomers do: you never saw the dark matter itself, but you found it anyway by watching how it pulled on your ship and bent the paths of nearby dust.",
        "",
        "Continue to Dark Matter II"
      );
    }
  } else if (currentSection === "darkMatter2") {
    if (darkMatter2.phase === "exploring" || darkMatter2.phase === "complete") {
      drawDarkMatter2HUD();
      drawGravityMapPanel();
      drawMessagePopup();
    }
    if (darkMatter2.phase === "intro") {
      drawIntroOverlay(
        "The first anomaly was only the beginning.",
        ["Several invisible masses may be affecting this region of space.",
         "Explore, collect probes, and watch how objects drift —",
         "then mark suspected hidden masses on the Gravity Map."]
      );
    }
    if (darkMatter2.phase === "complete") {
      drawCompletionOverlay(
        "Dark Matter II — Complete!",
        "By recording how gravity affected visible objects across many locations, you built a simplified model of where unseen mass might be — similar to how astronomers combine many observations into a model of dark matter's distribution. Real astronomers still don't know exactly what dark matter is made of.",
        "",
        "Continue to Dark Energy I"
      );
    }
  } else if (currentSection === "darkEnergy1") {
    if (darkEnergy1.phase === "expanding" || darkEnergy1.phase === "complete") {
      drawDarkEnergy1HUD();
      drawMessagePopup();
    }
    if (darkEnergy1.phase === "intro") {
      drawIntroOverlay(
        "The universe isn't staying still. Space itself is expanding.",
        ["Watch how distant galaxies drift apart, and how gaps between",
         "obstacles widen. Visit each Research Station to record",
         "how far apart things have become."]
      );
    }
    if (darkEnergy1.phase === "complete") {
      drawCompletionOverlay(
        "Dark Energy I — Complete!",
        "You just measured something real astronomers observe: on large scales, distances between galaxies grow as space itself expands. Scientists observe that this expansion is accelerating, and call the unknown cause 'dark energy' — they still don't know exactly what it is.",
        "",
        "Continue to Dark Energy II"
      );
    }
  } else if (currentSection === "darkEnergy2") {
    if (darkEnergy2.phase === "expanding" || darkEnergy2.phase === "complete") {
      drawDarkEnergy2HUD();
      drawExpansionRateGraph();
      drawMessagePopup();
    }
    if (darkEnergy2.phase === "intro") {
      drawIntroOverlay(
        "The universe isn't just expanding.",
        ["Scientists observe that its expansion is accelerating over time.",
         "Dark energy is the name scientists give to the unknown cause of",
         "this accelerated expansion. But scientists still don't know",
         "exactly what dark energy is."],
        "Click to Begin Observations"
      );
    }
    if (darkEnergy2.phase === "complete") {
      drawCompletionOverlay(
        "Dark Energy II — Complete!",
        "You collected observations showing that the expansion rate changes over time. The universe is expanding, and that expansion is accelerating. Scientists call the unknown cause of this acceleration 'dark energy' — they still don't know exactly what it is.",
        "",
        "Continue to Final Challenge"
      );
    }
  } else if (currentSection === "finalChallenge") {
    if (finalChallenge.phase === "dmInvestigation" || finalChallenge.phase === "deInvestigation") {
      drawFinalChallengeHUD();
      drawMessagePopup();
    }
    if (finalChallenge.phase === "intro") {
      drawIntroOverlay(
        "FINAL CHALLENGE",
        ["You've studied two of the biggest mysteries in the universe.",
         "Dark Matter: something we cannot directly see, but whose",
         "gravitational effects can be observed.",
         "Dark Energy: an unknown cause linked to the accelerating",
         "expansion of the universe.",
         "Now use what you've learned to investigate both."],
        "Begin Final Challenge"
      );
    }
    if (finalChallenge.phase === "dmEvidence") {
      drawMessagePopup();
      drawCompletionOverlay(
        "Evidence Collected",
        "Objects are responding to gravity from something we cannot directly see. Scientists use observations like these to infer the presence of unseen mass. The observations are consistent with the effects scientists attribute to dark matter.",
        "",
        "Continue to Investigation 2"
      );
    }
    if (finalChallenge.phase === "deTransition") {
      drawIntroOverlay(
        "INVESTIGATION 2: COSMIC EXPANSION",
        ["The universe is expanding.", "Now determine what is happening to the expansion rate."],
        "Click to Begin"
      );
    }
    if (finalChallenge.phase === "analysis") {
      drawFinalAnalysis();
    }
    if (finalChallenge.phase === "ending") {
      drawWhatILearnedScreen();
    }
    if (finalChallenge.phase === "journalView") {
      drawJournalView();
    }
  }
}

function draw() {
  if (gameState === "menu") {
    drawMenu();
  } else if (gameState === "playing") {
    drawGame();
  }
}

// ===================================================================
// STARTING / SWITCHING SECTIONS
// ===================================================================
function startSection(name) {
  if (name === "darkMatter1") {
    darkMatter1 = createDarkMatter1Section();
    createGravityParticles();
  } else if (name === "darkMatter2") {
    darkMatter2 = createDarkMatter2Section();
    createGravityParticles();
    createDriftAsteroids();
  } else if (name === "darkEnergy1") {
    darkEnergy1 = createDarkEnergy1Section();
  } else if (name === "darkEnergy2") {
    darkEnergy2 = createDarkEnergy2Section();
  } else if (name === "finalChallenge") {
    finalChallenge = createFinalChallengeSection();
    createGravityParticles();
    createDriftAsteroids();
  }
  ship.x = canvas.width / 2;
  ship.y = canvas.height / 2;
  ship.lastPullMagnitude = 0;
  messagePopup = { text: "", framesLeft: 0 }; // clear any leftover popup from the previous section
  currentSection = name;
  gameState = "playing";
}

// ===================================================================
// MAIN LOOP
// ===================================================================
function gameLoop() {
  if (gameState === "playing") {
    updateShip();
    if (currentSection === "darkMatter1") updateDarkMatter1();
    else if (currentSection === "darkMatter2") updateDarkMatter2();
    else if (currentSection === "darkEnergy1") updateDarkEnergy1();
    else if (currentSection === "darkEnergy2") updateDarkEnergy2();
    else if (currentSection === "finalChallenge") updateFinalChallenge();
  }
  draw();
  requestAnimationFrame(gameLoop);
}

// ===================================================================
// CLICK HANDLING
// ===================================================================
canvas.addEventListener("click", function (event) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  if (gameState === "menu") {
    const insideStart =
      mouseX >= startButton.x && mouseX <= startButton.x + startButton.width &&
      mouseY >= startButton.y && mouseY <= startButton.y + startButton.height;
    if (insideStart) { startSection("darkMatter1"); return; }

    const insidePreviewDM2 =
      mouseX >= previewDM2Button.x && mouseX <= previewDM2Button.x + previewDM2Button.width &&
      mouseY >= previewDM2Button.y && mouseY <= previewDM2Button.y + previewDM2Button.height;
    if (insidePreviewDM2) { startSection("darkMatter2"); return; }

    const insidePreviewDE1 =
      mouseX >= previewDE1Button.x && mouseX <= previewDE1Button.x + previewDE1Button.width &&
      mouseY >= previewDE1Button.y && mouseY <= previewDE1Button.y + previewDE1Button.height;
    if (insidePreviewDE1) { startSection("darkEnergy1"); return; }

    const insidePreviewDE2 =
      mouseX >= previewDE2Button.x && mouseX <= previewDE2Button.x + previewDE2Button.width &&
      mouseY >= previewDE2Button.y && mouseY <= previewDE2Button.y + previewDE2Button.height;
    if (insidePreviewDE2) { startSection("darkEnergy2"); return; }

    const insidePreviewFinal =
      mouseX >= previewFinalButton.x && mouseX <= previewFinalButton.x + previewFinalButton.width &&
      mouseY >= previewFinalButton.y && mouseY <= previewFinalButton.y + previewFinalButton.height;
    if (insidePreviewFinal) { startSection("finalChallenge"); return; }
    return;
  }

  if (gameState !== "playing") return;

  if (currentSection === "darkMatter1") {
    if (darkMatter1.phase === "intro") { darkMatter1.phase = "active"; return; }
    if (darkMatter1.phase === "complete") {
      const insideButton =
        mouseX >= bottomActionButton.x && mouseX <= bottomActionButton.x + bottomActionButton.width &&
        mouseY >= bottomActionButton.y && mouseY <= bottomActionButton.y + bottomActionButton.height;
      if (insideButton) startSection("darkMatter2");
    }
    return;
  }

  if (currentSection === "darkMatter2") {
    if (darkMatter2.phase === "intro") { darkMatter2.phase = "exploring"; return; }
    if (darkMatter2.phase === "exploring") {
      const gridLeft = MAP_X, gridTop = MAP_GRID_TOP;
      const gridRight = gridLeft + CELL_PX * GRID_COLS;
      const gridBottom = gridTop + CELL_PX * GRID_ROWS;
      if (mouseX >= gridLeft && mouseX <= gridRight && mouseY >= gridTop && mouseY <= gridBottom) {
        const col = Math.floor((mouseX - gridLeft) / CELL_PX);
        const row = Math.floor((mouseY - gridTop) / CELL_PX);
        handleGravityMapGuess(col, row);
      }
      return;
    }
    if (darkMatter2.phase === "complete") {
      const insideButton =
        mouseX >= bottomActionButton.x && mouseX <= bottomActionButton.x + bottomActionButton.width &&
        mouseY >= bottomActionButton.y && mouseY <= bottomActionButton.y + bottomActionButton.height;
      if (insideButton) startSection("darkEnergy1");
    }
    return;
  }

  if (currentSection === "darkEnergy1") {
    if (darkEnergy1.phase === "intro") { darkEnergy1.phase = "expanding"; return; }
    if (darkEnergy1.phase === "complete") {
      const insideButton =
        mouseX >= bottomActionButton.x && mouseX <= bottomActionButton.x + bottomActionButton.width &&
        mouseY >= bottomActionButton.y && mouseY <= bottomActionButton.y + bottomActionButton.height;
      if (insideButton) startSection("darkEnergy2");
    }
    return;
  }

  if (currentSection === "darkEnergy2") {
    if (darkEnergy2.phase === "intro") { darkEnergy2.phase = "expanding"; return; }
    if (darkEnergy2.phase === "complete") {
      const insideButton =
        mouseX >= bottomActionButton.x && mouseX <= bottomActionButton.x + bottomActionButton.width &&
        mouseY >= bottomActionButton.y && mouseY <= bottomActionButton.y + bottomActionButton.height;
      if (insideButton) startSection("finalChallenge");
    }
    return;
  }

  if (currentSection === "finalChallenge") {
    if (finalChallenge.phase === "intro") { finalChallenge.phase = "dmInvestigation"; return; }

    if (finalChallenge.phase === "dmEvidence") {
      const insideButton =
        mouseX >= bottomActionButton.x && mouseX <= bottomActionButton.x + bottomActionButton.width &&
        mouseY >= bottomActionButton.y && mouseY <= bottomActionButton.y + bottomActionButton.height;
      if (insideButton) finalChallenge.phase = "deTransition";
      return;
    }

    if (finalChallenge.phase === "deTransition") { finalChallenge.phase = "deInvestigation"; return; }

    if (finalChallenge.phase === "analysis") {
      for (const card of [analysisCardA, analysisCardB, analysisCardC]) {
        const inside = mouseX >= card.x && mouseX <= card.x + card.width && mouseY >= card.y && mouseY <= card.y + card.height;
        if (inside) { handleAnalysisCardClick(card); return; }
      }
      if (finalChallenge.analysisSelected.A && finalChallenge.analysisSelected.B) {
        const insideButton =
          mouseX >= bottomActionButton.x && mouseX <= bottomActionButton.x + bottomActionButton.width &&
          mouseY >= bottomActionButton.y && mouseY <= bottomActionButton.y + bottomActionButton.height;
        if (insideButton) finalChallenge.phase = "ending";
      }
      return;
    }

    if (finalChallenge.phase === "ending") {
      const inside = (btn) => mouseX >= btn.x && mouseX <= btn.x + btn.width && mouseY >= btn.y && mouseY <= btn.y + btn.height;
      if (inside(reviewJournalButton)) { finalChallenge.phase = "journalView"; return; }
      if (inside(playAgainButton)) { startSection("finalChallenge"); return; }
      if (inside(returnMenuButtonFinal)) { gameState = "menu"; currentSection = null; return; }
      return;
    }

    if (finalChallenge.phase === "journalView") {
      const inside = mouseX >= journalBackButton.x && mouseX <= journalBackButton.x + journalBackButton.width &&
        mouseY >= journalBackButton.y && mouseY <= journalBackButton.y + journalBackButton.height;
      if (inside) finalChallenge.phase = "ending";
    }
  }
});

gameLoop();
