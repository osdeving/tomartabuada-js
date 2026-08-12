export function createDistractorToken(puzzle, activeLabels) {
  const blockedLabels = new Set([...puzzle.resultLabels, ...activeLabels]);
  let label = "";

  while (!label || blockedLabels.has(label)) {
    label = createNearbyNumber(puzzle);
  }

  return label;
}

function createNearbyNumber(puzzle) {
  const anchors = [puzzle.total, ...puzzle.resultLabels.map((label) => Number(label))];
  const anchor = sample(anchors);
  const offset = sample([-240, -180, -130, -90, -45, -19, 19, 45, 90, 130, 180, 240]);

  return `${Math.max(6, anchor + offset)}`;
}

function sample(items) {
  return items[Math.floor(Math.random() * items.length)];
}
