import assert from "node:assert/strict";
import test from "node:test";
import { PRACTICE_GROUPS, getPracticeGroup } from "../experience.js";
import { FEATURE_FLAGS, isFeatureEnabled } from "../features.js";

test("expõe a Mix Insana como grupo isolado e dirigido pelo gerador", () => {
  const group = getPracticeGroup("mix-insano");

  assert.equal(group.id, "mix-insano");
  assert.equal(group.generatorId, "insane-mix");
  assert.deepEqual(group.sectionIds, ["mix-insano"]);
  assert.equal(PRACTICE_GROUPS.filter(({ id }) => id === group.id).length, 1);
});

test("avisos de progressão durante a sessão começam desativados", () => {
  assert.equal(FEATURE_FLAGS.sessionProgressNotices, false);
  assert.equal(isFeatureEnabled("sessionProgressNotices"), false);
  assert.equal(isFeatureEnabled("nao-existe"), false);
});
