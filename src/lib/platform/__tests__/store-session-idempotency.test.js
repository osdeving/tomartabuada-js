import assert from "node:assert/strict";
import test from "node:test";
import { calculateSessionXp, completeSession, createPlatformState } from "../store.js";

test("a mesma conclusão de sessão não duplica XP, histórico ou recorde", () => {
  const initial = createPlatformState(1);
  const summary = {
    id: "session-idempotente",
    modeId: "sparring",
    groupId: "misto",
    recordKey: "sparring:misto:calmo",
    score: 240,
    correct: 8,
  };

  const once = completeSession(initial, summary);
  const twice = completeSession(once, summary);

  assert.equal(once.sessions.length, 1);
  assert.equal(twice.sessions.length, 1);
  assert.equal(twice.profile.xp, calculateSessionXp(summary));
  assert.equal(twice.records.bestScore[summary.recordKey], 240);
  assert.strictEqual(twice, once);
});
