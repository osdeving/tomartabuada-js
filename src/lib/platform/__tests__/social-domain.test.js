import assert from "node:assert/strict";
import test from "node:test";
import { SOCIAL_SEED } from "../../../data/socialSeed.js";
import {
  SocialDomainError,
  calculateDisputeScore,
  createMemorySocialRepository,
  createSocialService,
  projectClan,
  requireSocialRepository,
  requireNonNegativePoints,
} from "../../social/index.js";

function createHarness() {
  let sequence = 0;
  let now = 0;
  const repository = createMemorySocialRepository({ seed: SOCIAL_SEED });
  const service = createSocialService({
    repository,
    clock: () => new Date(Date.UTC(2026, 7, 14, 12, 0, now++)).toISOString(),
    idFactory: (prefix) => `${prefix}-test-${++sequence}`,
  });
  return { repository, service };
}

async function rejectsWithCode(promise, code) {
  await assert.rejects(promise, (error) => (
    error instanceof SocialDomainError && error.code === code
  ));
}

test("regras puras somam pontos e rejeitam pontuação inválida", () => {
  const projected = projectClan(
    { id: "clan-a", name: "A" },
    [
      { id: "u1", clanId: "clan-a", points: 10 },
      { id: "u2", clanId: "clan-a", points: 25 },
      { id: "u3", clanId: "clan-b", points: 100 },
    ],
    [{ id: "t1", clanId: "clan-a" }],
  );

  assert.equal(projected.totalPoints, 35);
  assert.equal(projected.points, 35);
  assert.equal(projected.memberCount, 2);
  assert.equal(projected.teamCount, 1);
  assert.equal(requireNonNegativePoints(0), 0);
  assert.throws(() => requireNonNegativePoints(-1), { code: "INVALID_POINTS" });
  assert.throws(() => requireNonNegativePoints(1.5), { code: "INVALID_POINTS" });
});

test("repositório em memória é assíncrono, isolado e não expõe credenciais nas listagens", async () => {
  const { repository } = createHarness();
  const users = await repository.listUsers();
  users[0].displayName = "mutado fora";

  assert.equal((await repository.listUsers())[0].displayName, "Lia Vetor");
  assert.equal("password" in (await repository.listUsers())[0], false);
  assert.deepEqual(await repository.authenticate({ handle: " LIA ", password: "treino123" }), {
    userId: "user-lia",
  });
});

test("contrato rejeita adaptadores incompletos antes de iniciar o serviço", () => {
  assert.throws(() => requireSocialRepository({ listUsers() {} }), /authenticate/);
  assert.throws(() => createSocialService({ repository: {} }), /Repositório social incompleto/);
});

test("login cria sessão pública e logout a invalida", async () => {
  const { service } = createHarness();

  await rejectsWithCode(service.login({ handle: "lia", password: "errada" }), "INVALID_CREDENTIALS");
  const authenticated = await service.login({ handle: " LIA ", password: "treino123" });

  assert.equal(authenticated.user.id, "user-lia");
  assert.equal("password" in authenticated.user, false);
  assert.equal((await service.getSession()).session.userId, "user-lia");
  assert.deepEqual(await service.logout(), { ok: true, hadSession: true });
  assert.equal(await service.getSession(), null);
  await rejectsWithCode(
    service.createTeam({ name: "Sem login", memberIds: ["user-lia"] }),
    "AUTH_REQUIRED",
  );
});

test("clãs e times são rankings derivados dos pontos atuais dos usuários", async () => {
  const { service } = createHarness();
  const clans = await service.listClans();
  const neon = clans.find((clan) => clan.id === "clan-neon");
  const pulse = (await service.listTeams({ clanId: "clan-neon" }))
    .find((team) => team.id === "team-neon-pulse");

  assert.deepEqual(clans.map((clan) => clan.rank), [1, 2, 3]);
  assert.equal(neon.totalPoints, 13_630);
  assert.equal(neon.memberCount, 4);
  assert.equal(pulse.totalPoints, 11_320);
  assert.equal(pulse.members.length, 3);
});

test("usuário autenticado cria um time apenas com membros do próprio clã", async () => {
  const { service } = createHarness();
  await service.login({ handle: "lia", password: "treino123" });

  const created = await service.createTeam({
    name: "  Circuito   Mental  ",
    memberIds: ["user-lia", "user-teo", "user-lia"],
  });

  assert.equal(created.name, "Circuito Mental");
  assert.equal(created.clanId, "clan-neon");
  assert.deepEqual(created.memberIds, ["user-lia", "user-teo"]);
  assert.equal(created.totalPoints, 7_130);

  await rejectsWithCode(service.createTeam({
    name: "Invasores",
    memberIds: ["user-lia", "user-bia"],
  }), "CROSS_CLAN_TEAM");
  await rejectsWithCode(service.createTeam({
    name: "Pulso Neon",
    memberIds: ["user-lia", "user-teo"],
  }), "TEAM_NAME_TAKEN");
});

test("disputa exige dois clãs diferentes e participação no time desafiante", async () => {
  const { service } = createHarness();
  await service.login({ handle: "lia", password: "treino123" });

  await rejectsWithCode(service.createDispute({
    homeTeamId: "team-neon-pulse",
    awayTeamId: "team-neon-flux",
  }), "SAME_CLAN_DISPUTE");
  await rejectsWithCode(service.createDispute({
    homeTeamId: "team-raiz-radicals",
    awayTeamId: "team-abaco-nine",
  }), "FORBIDDEN");

  const created = await service.createDispute({
    homeTeamId: "team-neon-pulse",
    awayTeamId: "team-raiz-radicals",
  });
  assert.equal(created.status, "active");
  assert.deepEqual(created.score, { home: 0, away: 0 });
  assert.equal(created.homeScore, 0);
  assert.equal(created.awayScore, 0);
  assert.equal(created.homeTeam.name, "Pulso Neon");
  assert.equal(created.awayTeam.name, "Radicais Livres");
});

test("membro não pode desafiar por outro time do próprio clã", async () => {
  const { service } = createHarness();
  await service.login({ handle: "teo", password: "treino123" });

  const ownTeams = await service.listTeams({
    clanId: "clan-neon",
    memberId: "user-teo",
  });
  assert.deepEqual(ownTeams.map((team) => team.id), ["team-neon-flux"]);

  await rejectsWithCode(service.createDispute({
    homeTeamId: "team-neon-pulse",
    awayTeamId: "team-raiz-pi",
  }), "FORBIDDEN");

  const dashboard = await service.getCommunityDashboard();
  assert.deepEqual(
    dashboard.availableHomeTeams.map((team) => team.id),
    ["team-neon-flux"],
  );
  assert.deepEqual(dashboard.currentUserTeams, dashboard.availableHomeTeams);
});

test("pontuação de treino é idempotente e atualiza usuário, clã e time sem totais duplicados", async () => {
  const { repository, service } = createHarness();
  await service.login({ handle: "lia", password: "treino123" });

  const first = await service.recordTrainingPoints({ sessionId: "training-42", points: 240 });
  const repeated = await service.recordTrainingPoints({ sessionId: "training-42", points: 240 });

  assert.equal(first.created, true);
  assert.equal(repeated.created, false);
  assert.equal(first.user.points, 5_060);
  assert.equal(repeated.user.points, 5_060);
  assert.equal(
    (await service.listClans()).find((clan) => clan.id === "clan-neon").totalPoints,
    13_870,
  );
  assert.equal(
    (await service.listTeams()).find((team) => team.id === "team-neon-pulse").totalPoints,
    11_560,
  );
  assert.equal(
    (await repository.listPointEvents()).filter((event) => event.sourceId === "training-42").length,
    1,
  );
});

test("repositório mantém a idempotência sob registros concorrentes", async () => {
  const { repository, service } = createHarness();
  await service.login({ handle: "lia", password: "treino123" });

  const results = await Promise.all([
    service.recordTrainingPoints({ sessionId: "training-concurrent", points: 75 }),
    service.recordTrainingPoints({ sessionId: "training-concurrent", points: 75 }),
  ]);

  assert.deepEqual(results.map((result) => result.created).sort(), [false, true]);
  assert.equal((await repository.getUser("user-lia")).points, 4_895);
  assert.equal(
    (await repository.listPointEvents())
      .filter((event) => event.sourceId === "training-concurrent").length,
    1,
  );
});

test("ledger atribui pontos à disputa, calcula vencedor e bloqueia pontuação após encerramento", async () => {
  const { service } = createHarness();
  await service.login({ handle: "lia", password: "treino123" });

  const scored = await service.recordTrainingPoints({
    sessionId: "training-dispute-1",
    points: 50,
    disputeId: "dispute-neon-abaco",
  });
  assert.deepEqual(scored.dispute.score, { home: 215, away: 140 });

  const finished = await service.finishDispute({ disputeId: "dispute-neon-abaco" });
  assert.equal(finished.status, "finished");
  assert.equal(finished.winnerTeamId, "team-neon-pulse");
  assert.equal(finished.isDraw, false);

  const retryAfterFinish = await service.recordTrainingPoints({
    sessionId: "training-dispute-1",
    points: 50,
    disputeId: "dispute-neon-abaco",
  });
  assert.equal(retryAfterFinish.created, false);
  assert.deepEqual(retryAfterFinish.dispute.score, { home: 215, away: 140 });

  await rejectsWithCode(service.recordTrainingPoints({
    sessionId: "training-too-late",
    points: 10,
    disputeId: "dispute-neon-abaco",
  }), "DISPUTE_CLOSED");
});

test("pontuação comum não altera placar e não participantes não pontuam na disputa", async () => {
  const { repository, service } = createHarness();
  await service.login({ handle: "teo", password: "treino123" });
  await service.recordTrainingPoints({ sessionId: "training-free", points: 90 });

  const active = (await service.listDisputes({ status: "active" }))[0];
  assert.deepEqual(active.score, { home: 165, away: 140 });
  await rejectsWithCode(service.recordTrainingPoints({
    sessionId: "training-outsider",
    points: 90,
    disputeId: "dispute-neon-abaco",
  }), "FORBIDDEN");
  assert.equal((await repository.getUser("user-teo")).points, 2_400);
  assert.equal(
    (await repository.listPointEvents())
      .filter((event) => event.sourceId === "training-outsider").length,
    0,
  );
});

test("dashboard entrega o view-model pronto e permite selecionar outro clã", async () => {
  const { service } = createHarness();
  await service.login({ handle: "lia", password: "treino123" });

  const ownDashboard = await service.getCommunityDashboard();
  assert.equal(ownDashboard.currentUser.id, "user-lia");
  assert.equal(ownDashboard.selectedClan.id, "clan-neon");
  assert.equal(ownDashboard.selectedClan.members.length, 4);
  assert.equal(ownDashboard.selectedClan.teams.length, 2);
  assert.equal(ownDashboard.members.length, 12);
  assert.equal(ownDashboard.teams.length, 6);
  assert.equal(ownDashboard.availableOpponents.length, 4);
  assert.equal(ownDashboard.clans[0].rank, 1);

  const otherDashboard = await service.getCommunityDashboard({ clanId: "clan-raiz" });
  assert.equal(otherDashboard.selectedClan.id, "clan-raiz");
  assert.ok(otherDashboard.availableOpponents.every((team) => team.clanId !== "clan-neon"));
});

test("placar puro considera apenas eventos da disputa e do lado correto", () => {
  const dispute = { id: "d1", homeTeamId: "a", awayTeamId: "b" };
  assert.deepEqual(calculateDisputeScore(dispute, [
    { disputeId: "d1", teamId: "a", points: 12 },
    { disputeId: "d1", teamId: "b", points: 8 },
    { disputeId: "d2", teamId: "a", points: 500 },
    { disputeId: "d1", teamId: "outro", points: 500 },
  ]), { home: 12, away: 8 });
});
