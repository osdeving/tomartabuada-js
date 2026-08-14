import { SocialDomainError } from "./SocialDomainError.js";

export const SOCIAL_LIMITS = Object.freeze({
  teamNameMin: 3,
  teamNameMax: 32,
  teamMembersMin: 2,
  teamMembersMax: 4,
  pointsMaxPerEvent: 1_000_000,
});

export function normalizeHandle(value) {
  return String(value ?? "").trim().toLocaleLowerCase("pt-BR");
}

export function normalizeTeamName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function requireNonNegativePoints(value) {
  const points = Number(value);

  if (!Number.isSafeInteger(points) || points < 0 || points > SOCIAL_LIMITS.pointsMaxPerEvent) {
    throw new SocialDomainError(
      "INVALID_POINTS",
      `Os pontos devem ser um inteiro entre 0 e ${SOCIAL_LIMITS.pointsMaxPerEvent}.`,
    );
  }

  return points;
}

export function requireSourceId(value) {
  const sourceId = String(value ?? "").trim();
  if (!sourceId || sourceId.length > 120) {
    throw new SocialDomainError(
      "INVALID_SOURCE_ID",
      "A origem da pontuação precisa de um identificador de até 120 caracteres.",
    );
  }
  return sourceId;
}

export function requireTeamDraft({ name, memberIds } = {}) {
  const normalizedName = normalizeTeamName(name);
  const uniqueMemberIds = [...new Set(
    (Array.isArray(memberIds) ? memberIds : [])
      .map((memberId) => String(memberId ?? "").trim())
      .filter(Boolean),
  )];

  if (
    normalizedName.length < SOCIAL_LIMITS.teamNameMin
    || normalizedName.length > SOCIAL_LIMITS.teamNameMax
  ) {
    throw new SocialDomainError(
      "INVALID_TEAM_NAME",
      `O nome do time deve ter entre ${SOCIAL_LIMITS.teamNameMin} e ${SOCIAL_LIMITS.teamNameMax} caracteres.`,
    );
  }

  if (
    uniqueMemberIds.length < SOCIAL_LIMITS.teamMembersMin
    || uniqueMemberIds.length > SOCIAL_LIMITS.teamMembersMax
  ) {
    throw new SocialDomainError(
      "INVALID_TEAM_MEMBERS",
      `O time deve ter entre ${SOCIAL_LIMITS.teamMembersMin} e ${SOCIAL_LIMITS.teamMembersMax} membros.`,
    );
  }

  return { name: normalizedName, memberIds: uniqueMemberIds };
}

export function sumMemberPoints(users = []) {
  return users.reduce((total, user) => total + Math.max(0, Number(user?.points) || 0), 0);
}

export function projectClan(clan, users = [], teams = []) {
  const members = users.filter((user) => user.clanId === clan.id);
  const clanTeams = teams.filter((team) => team.clanId === clan.id);
  const totalPoints = sumMemberPoints(members);

  return {
    ...clan,
    memberCount: members.length,
    teamCount: clanTeams.length,
    totalPoints,
    points: totalPoints,
  };
}

export function projectTeam(team, users = []) {
  const usersById = new Map(users.map((user) => [user.id, user]));
  const members = team.memberIds.map((memberId) => usersById.get(memberId)).filter(Boolean);
  const totalPoints = sumMemberPoints(members);

  return {
    ...team,
    members,
    memberCount: members.length,
    totalPoints,
    points: totalPoints,
  };
}

export function calculateDisputeScore(dispute, pointEvents = []) {
  return pointEvents.reduce(
    (score, event) => {
      if (event.disputeId !== dispute.id) return score;
      if (event.teamId === dispute.homeTeamId) score.home += Number(event.points) || 0;
      if (event.teamId === dispute.awayTeamId) score.away += Number(event.points) || 0;
      return score;
    },
    { home: 0, away: 0 },
  );
}

export function projectDispute(dispute, teams = [], users = [], pointEvents = []) {
  const home = teams.find((team) => team.id === dispute.homeTeamId);
  const away = teams.find((team) => team.id === dispute.awayTeamId);
  const score = calculateDisputeScore(dispute, pointEvents);
  const winnerTeamId = dispute.status !== "finished" || score.home === score.away
    ? null
    : score.home > score.away
      ? dispute.homeTeamId
      : dispute.awayTeamId;

  return {
    ...dispute,
    homeTeam: home ? projectTeam(home, users) : null,
    awayTeam: away ? projectTeam(away, users) : null,
    score,
    homeScore: score.home,
    awayScore: score.away,
    finishedAt: dispute.endedAt,
    winnerTeamId,
    isDraw: dispute.status === "finished" && score.home === score.away,
  };
}

export function rankClans(clans = [], users = [], teams = []) {
  return clans
    .map((clan) => projectClan(clan, users, teams))
    .sort((left, right) => (
      right.totalPoints - left.totalPoints
      || left.name.localeCompare(right.name, "pt-BR")
    ))
    .map((clan, index) => ({ ...clan, rank: index + 1 }));
}
