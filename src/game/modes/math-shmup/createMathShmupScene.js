import { createDistractorToken } from "./puzzle/createDistractorToken";
import { createPuzzleSession } from "./puzzle/createMultiplicationPuzzle";

const PLAYER_WIDTH = 36;
const PLAYER_HEIGHT = 26;
const BULLET_WIDTH = 4;
const BULLET_HEIGHT = 16;
const BLOCK_HEIGHT = 40;

export function createMathShmupScene({
  config,
  onSnapshot,
  onGoodHit,
  onBadHit,
}) {
  const session = createPuzzleSession(config);
  const state = {
    viewport: { width: 1, height: 1, dpr: 1 },
    controls: {
      left: false,
      right: false,
      firing: false,
      pointerActive: false,
      pointerX: 0,
    },
    player: {
      x: 180,
      y: 500,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
    },
    bullets: [],
    blocks: [],
    lastFrameAt: 0,
    lastValidSpawnAt: 0,
    lastJunkSpawnAt: 0,
    lastShotAt: 0,
    nextPuzzleAt: 0,
    flashTone: "neutral",
    flashUntil: 0,
    blockCounter: 0,
  };

  publishSnapshot();

  return {
    resize(viewport) {
      state.viewport = viewport;
      state.player.y = viewport.height - 54;
      state.player.x = clamp(
        state.player.x,
        state.player.width,
        viewport.width - state.player.width,
      );
    },
    setControl(controlName, value) {
      if (controlName in state.controls) {
        state.controls[controlName] = value;
      }
    },
    pointerDown(pointerX) {
      state.controls.pointerActive = true;
      state.controls.pointerX = pointerX;
      state.controls.firing = true;
    },
    pointerMove(pointerX) {
      state.controls.pointerX = pointerX;
    },
    pointerUp() {
      state.controls.pointerActive = false;
      state.controls.firing = false;
    },
    render({ context, now }) {
      const deltaSeconds = state.lastFrameAt
        ? Math.min((now - state.lastFrameAt) / 1000, 0.05)
        : 0.016;

      state.lastFrameAt = now;

      updateScene(state, session, deltaSeconds, now, config, {
        onSnapshot: publishSnapshot,
        onGoodHit,
        onBadHit,
      });
      drawScene(context, state, session.getSnapshot(), now);
    },
  };

  function publishSnapshot() {
    onSnapshot?.(session.getSnapshot());
  }
}

function updateScene(state, session, deltaSeconds, now, config, callbacks) {
  if (state.nextPuzzleAt && now >= state.nextPuzzleAt) {
    session.advancePuzzle();
    state.blocks = [];
    state.bullets = [];
    state.nextPuzzleAt = 0;
    state.lastValidSpawnAt = 0;
    state.lastJunkSpawnAt = 0;
    callbacks.onSnapshot();
  }

  updatePlayer(state, deltaSeconds, config);
  maybeFire(state, now, config);
  maybeSpawnValidBlock(state, session, now, config);
  maybeSpawnDistractorBlock(state, session, now, config);
  updateBullets(state, deltaSeconds, config);
  updateBlocks(state, deltaSeconds);
  resolveCollisions(state, session, now, callbacks);
}

function updatePlayer(state, deltaSeconds, config) {
  if (state.controls.pointerActive) {
    const targetX = clamp(
      state.controls.pointerX,
      state.player.width,
      state.viewport.width - state.player.width,
    );

    state.player.x += (targetX - state.player.x) * Math.min(1, deltaSeconds * 11);
    return;
  }

  if (state.controls.left) {
    state.player.x -= config.shipSpeed * deltaSeconds;
  }

  if (state.controls.right) {
    state.player.x += config.shipSpeed * deltaSeconds;
  }

  state.player.x = clamp(
    state.player.x,
    state.player.width,
    state.viewport.width - state.player.width,
  );
}

function maybeFire(state, now, config) {
  if (!state.controls.firing || now - state.lastShotAt < config.fireCooldownMs) {
    return;
  }

  state.lastShotAt = now;
  state.bullets.push({
    id: `bullet-${now}-${state.bullets.length}`,
    x: state.player.x,
    y: state.player.y - state.player.height * 0.8,
    width: BULLET_WIDTH,
    height: BULLET_HEIGHT,
  });
}

function maybeSpawnValidBlock(state, session, now, config) {
  const validTokens = session.getValidTokens();
  const visibleValidBlocks = state.blocks.filter((block) => block.isValid);
  const visibleValidIds = new Set(visibleValidBlocks.map((block) => block.tokenId));
  const pendingTokens = validTokens.filter((token) => !visibleValidIds.has(token.id));

  if (
    state.blocks.length >= config.maxSpawnedBlocks ||
    visibleValidBlocks.length >= Math.min(config.maxVisibleValidBlocks, validTokens.length) ||
    !pendingTokens.length ||
    now - state.lastValidSpawnAt < config.validSpawnIntervalMs
  ) {
    return;
  }

  state.lastValidSpawnAt = now;
  const candidate = sample(pendingTokens);
  state.blocks.push(createBlock(state, candidate.label, candidate.id, true, config));
}

function maybeSpawnDistractorBlock(state, session, now, config) {
  const distractorCount = state.blocks.filter((block) => !block.isValid).length;

  if (
    state.blocks.length >= config.maxSpawnedBlocks ||
    distractorCount >= config.maxVisibleDistractorBlocks ||
    now - state.lastJunkSpawnAt < config.junkSpawnIntervalMs
  ) {
    return;
  }

  state.lastJunkSpawnAt = now;
  state.blocks.push(
    createBlock(
      state,
      createDistractorToken(
        session.getPuzzle(),
        state.blocks.map((block) => block.label),
      ),
      `junk-${now}-${state.blockCounter}`,
      false,
      config,
    ),
  );
}

function updateBullets(state, deltaSeconds, config) {
  state.bullets = state.bullets
    .map((bullet) => ({
      ...bullet,
      y: bullet.y - config.bulletSpeed * deltaSeconds,
    }))
    .filter((bullet) => bullet.y + bullet.height > -20);
}

function updateBlocks(state, deltaSeconds) {
  state.blocks = state.blocks
    .map((block) => ({
      ...block,
      y: block.y + block.speed * deltaSeconds,
    }))
    .filter((block) => block.y - block.height < state.viewport.height + 24);
}

function resolveCollisions(state, session, now, callbacks) {
  const remainingBullets = [];
  const removedBlockIds = new Set();

  for (const bullet of state.bullets) {
    const hitBlock = state.blocks.find(
      (block) =>
        !removedBlockIds.has(block.id) &&
        intersects(
          bullet.x - bullet.width / 2,
          bullet.y - bullet.height / 2,
          bullet.width,
          bullet.height,
          block.x - block.width / 2,
          block.y - block.height / 2,
          block.width,
          block.height,
        ),
    );

    if (!hitBlock) {
      remainingBullets.push(bullet);
      continue;
    }

    removedBlockIds.add(hitBlock.id);
    const result = session.resolveToken(hitBlock.tokenId);
    state.flashTone = result.kind === "good" ? "good" : "bad";
    state.flashUntil = now + 140;

    if (result.kind === "good") {
      state.blocks = [];
      callbacks.onGoodHit?.();
      callbacks.onSnapshot();

      if (result.completedPuzzle) {
        state.nextPuzzleAt = now + 920;
      }
    } else {
      state.blocks = state.blocks.filter((block) => block.id !== hitBlock.id);
      callbacks.onBadHit?.();
      callbacks.onSnapshot();
    }
  }

  state.bullets = remainingBullets;
}

function drawScene(context, state, snapshot, now) {
  drawBackdrop(context, state.viewport, state.flashTone, state.flashUntil > now);
  drawProblemHeader(context, snapshot.problemDisplay, state.viewport);
  drawBlocks(context, state.blocks);
  drawBullets(context, state.bullets);
  drawPlayer(context, state.player, state.viewport);
}

function drawBackdrop(context, viewport, flashTone, flashActive) {
  context.clearRect(0, 0, viewport.width, viewport.height);

  const background = context.createLinearGradient(0, 0, 0, viewport.height);
  background.addColorStop(0, "#020202");
  background.addColorStop(0.55, "#040404");
  background.addColorStop(1, "#000000");
  context.fillStyle = background;
  context.fillRect(0, 0, viewport.width, viewport.height);

  context.save();
  context.strokeStyle = "rgba(255,255,255,0.045)";
  context.lineWidth = 1;

  for (let x = 18; x <= viewport.width; x += 28) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, viewport.height);
    context.stroke();
  }

  for (let y = 18; y <= viewport.height; y += 28) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(viewport.width, y);
    context.stroke();
  }

  context.restore();

  if (flashActive) {
    context.fillStyle =
      flashTone === "good"
        ? "rgba(52, 199, 89, 0.09)"
        : "rgba(255, 69, 58, 0.09)";
    context.fillRect(0, 0, viewport.width, viewport.height);
  }
}

function drawProblemHeader(context, problemDisplay, viewport) {
  context.save();
  context.fillStyle = "rgba(255,255,255,0.78)";
  context.font = '700 22px "Space Grotesk", "Instrument Sans", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(`${problemDisplay.formulaLabel} = ?`, viewport.width / 2, 78);
  context.restore();
}

function drawBlocks(context, blocks) {
  blocks.forEach((block) => {
    context.save();
    context.shadowColor = block.isValid ? "rgba(255, 215, 0, 0.14)" : "rgba(255, 120, 120, 0.14)";
    context.shadowBlur = 14;
    context.fillStyle = "rgba(14, 14, 14, 0.94)";
    context.strokeStyle = block.isValid
      ? "rgba(255,255,255,0.18)"
      : "rgba(255,107,107,0.14)";
    context.lineWidth = 1;
    roundRect(
      context,
      block.x - block.width / 2,
      block.y - block.height / 2,
      block.width,
      block.height,
      14,
    );
    context.fill();
    context.stroke();

    context.fillStyle = "#f8f2ec";
    context.font = '700 21px "Space Grotesk", "Instrument Sans", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(block.label, block.x, block.y + 1);
    context.restore();
  });
}

function drawBullets(context, bullets) {
  bullets.forEach((bullet) => {
    context.save();
    context.fillStyle = "#ffe066";
    context.fillRect(
      bullet.x - bullet.width / 2,
      bullet.y - bullet.height / 2,
      bullet.width,
      bullet.height,
    );
    context.restore();
  });
}

function drawPlayer(context, player, viewport) {
  const baseY = viewport.height - 26;

  context.save();
  context.translate(player.x, baseY);
  context.fillStyle = "#f6f1ea";
  context.strokeStyle = "rgba(255,255,255,0.26)";
  context.lineWidth = 1.2;
  context.beginPath();
  context.moveTo(0, -player.height);
  context.lineTo(player.width * 0.55, player.height * 0.2);
  context.lineTo(0, player.height * 0.06);
  context.lineTo(-player.width * 0.55, player.height * 0.2);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = "#ff6b6b";
  context.fillRect(-4, -player.height * 0.32, 8, 12);
  context.restore();
}

function createBlock(state, label, tokenId, isValid, config) {
  state.blockCounter += 1;

  const width = clamp(label.length * 18 + 30, 80, 160);
  const x = randomInt(Math.round(width / 2) + 8, Math.round(state.viewport.width - width / 2 - 8));

  return {
    id: `block-${state.blockCounter}`,
    tokenId,
    label,
    isValid,
    x,
    y: -BLOCK_HEIGHT,
    width,
    height: BLOCK_HEIGHT,
    speed: randomInt(config.blockSpeedMin, config.blockSpeedMax),
  };
}

function intersects(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function roundRect(context, x, y, width, height, radius) {
  const cappedRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + cappedRadius, y);
  context.arcTo(x + width, y, x + width, y + height, cappedRadius);
  context.arcTo(x + width, y + height, x, y + height, cappedRadius);
  context.arcTo(x, y + height, x, y, cappedRadius);
  context.arcTo(x, y, x + width, y, cappedRadius);
  context.closePath();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sample(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
