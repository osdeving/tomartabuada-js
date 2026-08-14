import { SOCIAL_SEED } from "../../data/socialSeed.js";
import { normalizeHandle } from "./socialRules.js";

function clone(value) {
  if (value == null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function createMemorySocialRepository({ seed = SOCIAL_SEED } = {}) {
  let state = clone(seed);

  return {
    async authenticate({ handle, password }) {
      const normalizedHandle = normalizeHandle(handle);
      const credential = state.credentials.find((candidate) => (
        normalizeHandle(candidate.handle) === normalizedHandle
        && candidate.password === String(password ?? "")
      ));
      return credential ? { userId: credential.userId } : null;
    },

    async getUser(userId) {
      return clone(state.users.find((user) => user.id === userId) ?? null);
    },

    async listUsers() {
      return clone(state.users);
    },

    async listClans() {
      return clone(state.clans);
    },

    async listTeams() {
      return clone(state.teams);
    },

    async listDisputes() {
      return clone(state.disputes);
    },

    async listPointEvents() {
      return clone(state.pointEvents);
    },

    async findPointEvent({ userId, source, sourceId }) {
      return clone(state.pointEvents.find((candidate) => (
        candidate.userId === userId
        && candidate.source === source
        && candidate.sourceId === sourceId
      )) ?? null);
    },

    async insertTeam(team) {
      state.teams.push(clone(team));
      return clone(team);
    },

    async insertDispute(dispute) {
      state.disputes.push(clone(dispute));
      return clone(dispute);
    },

    async finishDispute(disputeId, endedAt) {
      const dispute = state.disputes.find((candidate) => candidate.id === disputeId);
      if (!dispute) return null;
      dispute.status = "finished";
      dispute.endedAt = endedAt;
      return clone(dispute);
    },

    async recordPointEvent(event) {
      const existing = state.pointEvents.find((candidate) => (
        candidate.userId === event.userId
        && candidate.source === event.source
        && candidate.sourceId === event.sourceId
      ));

      if (existing) {
        return {
          created: false,
          event: clone(existing),
          user: clone(state.users.find((user) => user.id === existing.userId) ?? null),
        };
      }

      const user = state.users.find((candidate) => candidate.id === event.userId);
      if (!user) return null;

      user.points = Math.max(0, Number(user.points) || 0) + event.points;
      state.pointEvents.push(clone(event));

      return { created: true, event: clone(event), user: clone(user) };
    },

    async exportSnapshot() {
      return clone(state);
    },
  };
}
