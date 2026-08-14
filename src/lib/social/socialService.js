import { SocialDomainError } from "./SocialDomainError.js";
import { createMemorySocialRepository } from "./memorySocialRepository.js";
import { requireSocialRepository } from "./socialRepositoryContract.js";
import {
  normalizeTeamName,
  projectDispute,
  projectTeam,
  rankClans,
  requireNonNegativePoints,
  requireSourceId,
  requireTeamDraft,
} from "./socialRules.js";

const ACTIVE = "active";

function defaultIdFactory(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function publicSession(session) {
  if (!session) return null;
  return { id: session.id, userId: session.userId, createdAt: session.createdAt };
}

export function createSocialService({
  repository = createMemorySocialRepository(),
  clock = () => new Date().toISOString(),
  idFactory = defaultIdFactory,
} = {}) {
  requireSocialRepository(repository);
  let session = null;

  async function requireCurrentUser() {
    if (!session) {
      throw new SocialDomainError("AUTH_REQUIRED", "Entre para continuar.");
    }

    const user = await repository.getUser(session.userId);
    if (!user) {
      session = null;
      throw new SocialDomainError("AUTH_REQUIRED", "A sessão não é mais válida.");
    }
    return user;
  }

  async function getSessionSnapshot() {
    if (!session) return null;
    const user = await repository.getUser(session.userId);
    if (!user) {
      session = null;
      return null;
    }
    return { session: publicSession(session), user };
  }

  async function readSocialData() {
    const [users, clans, teams, disputes, pointEvents] = await Promise.all([
      repository.listUsers(),
      repository.listClans(),
      repository.listTeams(),
      repository.listDisputes(),
      repository.listPointEvents(),
    ]);
    return { users, clans, teams, disputes, pointEvents };
  }

  async function listProjectedDisputes(filters = {}) {
    const data = await readSocialData();
    return data.disputes
      .filter((dispute) => !filters.status || dispute.status === filters.status)
      .filter((dispute) => !filters.teamId || (
        dispute.homeTeamId === filters.teamId || dispute.awayTeamId === filters.teamId
      ))
      .filter((dispute) => {
        if (!filters.clanId) return true;
        const home = data.teams.find((team) => team.id === dispute.homeTeamId);
        const away = data.teams.find((team) => team.id === dispute.awayTeamId);
        return home?.clanId === filters.clanId || away?.clanId === filters.clanId;
      })
      .map((dispute) => projectDispute(dispute, data.teams, data.users, data.pointEvents))
      .sort((left, right) => String(right.startedAt).localeCompare(String(left.startedAt)));
  }

  async function registerPoints({
    points,
    source = "manual",
    sourceId,
    disputeId = null,
  } = {}) {
    const currentUser = await requireCurrentUser();
    const normalizedPoints = requireNonNegativePoints(points);
    const normalizedSource = String(source ?? "").trim() || "manual";
    const normalizedSourceId = requireSourceId(sourceId);
    const existing = await repository.findPointEvent({
      userId: currentUser.id,
      source: normalizedSource,
      sourceId: normalizedSourceId,
    });

    if (existing) {
      const dispute = existing.disputeId
        ? (await listProjectedDisputes()).find((candidate) => candidate.id === existing.disputeId) ?? null
        : null;
      return {
        created: false,
        event: existing,
        user: await repository.getUser(currentUser.id),
        dispute,
      };
    }

    let teamId = null;

    if (disputeId) {
      const data = await readSocialData();
      const dispute = data.disputes.find((candidate) => candidate.id === disputeId);
      if (!dispute) throw new SocialDomainError("NOT_FOUND", "Disputa não encontrada.");
      if (dispute.status !== ACTIVE) {
        throw new SocialDomainError("DISPUTE_CLOSED", "Essa disputa já foi encerrada.");
      }

      const participantTeams = data.teams.filter((team) => (
        (team.id === dispute.homeTeamId || team.id === dispute.awayTeamId)
        && team.memberIds.includes(currentUser.id)
      ));
      if (participantTeams.length !== 1) {
        throw new SocialDomainError("FORBIDDEN", "Você não participa dessa disputa.");
      }
      [teamId] = participantTeams.map((team) => team.id);
    }

    const result = await repository.recordPointEvent({
      id: idFactory("point"),
      userId: currentUser.id,
      points: normalizedPoints,
      source: normalizedSource,
      sourceId: normalizedSourceId,
      disputeId: disputeId || null,
      teamId,
      createdAt: clock(),
    });

    if (!result) throw new SocialDomainError("NOT_FOUND", "Usuário não encontrado.");
    const dispute = disputeId
      ? (await listProjectedDisputes()).find((candidate) => candidate.id === disputeId) ?? null
      : null;

    return {
      created: result.created,
      event: result.event,
      user: result.user,
      dispute,
    };
  }

  return {
    async login({ handle, password } = {}) {
      const identity = await repository.authenticate({ handle, password });
      if (!identity) {
        throw new SocialDomainError("INVALID_CREDENTIALS", "Usuário ou senha inválidos.");
      }

      const user = await repository.getUser(identity.userId);
      if (!user) throw new SocialDomainError("INVALID_CREDENTIALS", "Usuário ou senha inválidos.");
      session = { id: idFactory("session"), userId: user.id, createdAt: clock() };
      return { session: publicSession(session), user };
    },

    async logout() {
      const hadSession = Boolean(session);
      session = null;
      return { ok: true, hadSession };
    },

    async getSession() {
      return getSessionSnapshot();
    },

    async listUsers({ clanId } = {}) {
      const users = await repository.listUsers();
      return clanId ? users.filter((user) => user.clanId === clanId) : users;
    },

    async listClans() {
      const { clans, users, teams } = await readSocialData();
      return rankClans(clans, users, teams);
    },

    async listTeams({ clanId, memberId } = {}) {
      const [teams, users] = await Promise.all([
        repository.listTeams(),
        repository.listUsers(),
      ]);
      return teams
        .filter((team) => !clanId || team.clanId === clanId)
        .filter((team) => !memberId || team.memberIds.includes(memberId))
        .map((team) => projectTeam(team, users));
    },

    async listDisputes(filters = {}) {
      return listProjectedDisputes(filters);
    },

    async createTeam({ name, memberIds } = {}) {
      const currentUser = await requireCurrentUser();
      if (!currentUser.clanId) {
        throw new SocialDomainError("FORBIDDEN", "Entre em um clã antes de criar um time.");
      }

      const draft = requireTeamDraft({ name, memberIds });
      const [users, teams] = await Promise.all([
        repository.listUsers(),
        repository.listTeams(),
      ]);
      const members = draft.memberIds.map((memberId) => users.find((user) => user.id === memberId));

      if (members.some((member) => !member)) {
        throw new SocialDomainError("NOT_FOUND", "Um ou mais membros não foram encontrados.");
      }
      if (members.some((member) => member.clanId !== currentUser.clanId)) {
        throw new SocialDomainError("CROSS_CLAN_TEAM", "Todos os membros precisam pertencer ao mesmo clã.");
      }
      if (teams.some((team) => (
        team.clanId === currentUser.clanId
        && normalizeTeamName(team.name).toLocaleLowerCase("pt-BR")
          === draft.name.toLocaleLowerCase("pt-BR")
      ))) {
        throw new SocialDomainError("TEAM_NAME_TAKEN", "Já existe um time com esse nome no clã.");
      }

      const team = await repository.insertTeam({
        id: idFactory("team"),
        clanId: currentUser.clanId,
        name: draft.name,
        memberIds: draft.memberIds,
        createdByUserId: currentUser.id,
        createdAt: clock(),
      });
      return projectTeam(team, users);
    },

    async createDispute({ homeTeamId, awayTeamId } = {}) {
      const currentUser = await requireCurrentUser();
      const data = await readSocialData();
      const homeTeam = data.teams.find((team) => team.id === homeTeamId);
      const awayTeam = data.teams.find((team) => team.id === awayTeamId);

      if (!homeTeam || !awayTeam) {
        throw new SocialDomainError("NOT_FOUND", "Um dos times não foi encontrado.");
      }
      if (
        homeTeam.clanId !== currentUser.clanId
        || !homeTeam.memberIds.includes(currentUser.id)
      ) {
        throw new SocialDomainError("FORBIDDEN", "Você precisa fazer parte do time desafiante.");
      }
      if (homeTeam.clanId === awayTeam.clanId) {
        throw new SocialDomainError("SAME_CLAN_DISPUTE", "A disputa deve ser contra outro clã.");
      }
      const duplicate = data.disputes.some((dispute) => (
        dispute.status === ACTIVE
        && (
          (dispute.homeTeamId === homeTeam.id && dispute.awayTeamId === awayTeam.id)
          || (dispute.homeTeamId === awayTeam.id && dispute.awayTeamId === homeTeam.id)
        )
      ));
      if (duplicate) {
        throw new SocialDomainError("DISPUTE_ALREADY_ACTIVE", "Esses times já têm uma disputa ativa.");
      }

      const now = clock();
      const dispute = await repository.insertDispute({
        id: idFactory("dispute"),
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        status: ACTIVE,
        createdByUserId: currentUser.id,
        createdAt: now,
        startedAt: now,
        endedAt: null,
      });
      return projectDispute(dispute, data.teams, data.users, data.pointEvents);
    },

    async finishDispute({ disputeId } = {}) {
      const currentUser = await requireCurrentUser();
      const data = await readSocialData();
      const dispute = data.disputes.find((candidate) => candidate.id === disputeId);
      if (!dispute) throw new SocialDomainError("NOT_FOUND", "Disputa não encontrada.");
      if (dispute.status !== ACTIVE) {
        throw new SocialDomainError("DISPUTE_CLOSED", "Essa disputa já foi encerrada.");
      }
      const participantClan = data.teams.some((team) => (
        (team.id === dispute.homeTeamId || team.id === dispute.awayTeamId)
        && team.clanId === currentUser.clanId
      ));
      if (!participantClan) {
        throw new SocialDomainError("FORBIDDEN", "Apenas os clãs participantes podem encerrar a disputa.");
      }

      const finished = await repository.finishDispute(dispute.id, clock());
      return projectDispute(finished, data.teams, data.users, data.pointEvents);
    },

    async registerPoints(input) {
      return registerPoints(input);
    },

    async recordTrainingPoints({ sessionId, points, disputeId = null } = {}) {
      return registerPoints({
        points,
        source: "training",
        sourceId: sessionId,
        disputeId,
      });
    },

    async getCommunityDashboard({ clanId } = {}) {
      const [auth, data] = await Promise.all([getSessionSnapshot(), readSocialData()]);
      const clans = rankClans(data.clans, data.users, data.teams);
      const effectiveClanId = clanId || auth?.user?.clanId || clans[0]?.id || null;
      const selectedClanBase = clans.find((clan) => clan.id === effectiveClanId) ?? null;
      const selectedClan = selectedClanBase
        ? {
            ...selectedClanBase,
            members: data.users
              .filter((user) => user.clanId === selectedClanBase.id)
              .sort((left, right) => right.points - left.points),
            teams: data.teams
              .filter((team) => team.clanId === selectedClanBase.id)
              .map((team) => projectTeam(team, data.users)),
          }
        : null;
      const disputes = data.disputes
        .map((dispute) => projectDispute(dispute, data.teams, data.users, data.pointEvents))
        .sort((left, right) => String(right.startedAt).localeCompare(String(left.startedAt)));
      const availableOpponents = data.teams
        .filter((team) => team.clanId !== (auth?.user?.clanId ?? selectedClan?.id))
        .map((team) => projectTeam(team, data.users));
      const teams = data.teams.map((team) => projectTeam(team, data.users));
      const availableHomeTeams = auth?.user
        ? teams.filter((team) => team.memberIds.includes(auth.user.id))
        : [];

      return {
        session: auth?.session ?? null,
        currentUser: auth?.user ?? null,
        clans,
        clanLeaderboard: clans,
        selectedClan,
        members: data.users,
        teams,
        availableHomeTeams,
        currentUserTeams: availableHomeTeams,
        disputes,
        availableOpponents,
      };
    },
  };
}
