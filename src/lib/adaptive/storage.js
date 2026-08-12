import { ADAPTIVE_SCHEMA_VERSION } from "./config.js";
import { buildLearnerReport } from "./analytics.js";
import { normalizePracticeSession } from "./session.js";

export const DEFAULT_SESSION_STORAGE_KEY = "tomar-tabuada.adaptive-sessions.v1";

export class SessionRevisionConflictError extends Error {
  constructor(expectedRevision, actualRevision) {
    super(`Conflito de revisão: esperado ${expectedRevision}, atual ${actualRevision}.`);
    this.name = "SessionRevisionConflictError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

export function createMemoryStorageAdapter(seed = {}) {
  const values = new Map(Object.entries(seed));

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    dump() {
      return Object.fromEntries(values);
    },
  };
}

export function createLocalStorageAdapter(storage) {
  let candidate = storage;
  if (arguments.length === 0) {
    try {
      candidate = globalThis.localStorage;
    } catch {
      candidate = null;
    }
  }

  if (
    !candidate ||
    typeof candidate.getItem !== "function" ||
    typeof candidate.setItem !== "function"
  ) {
    return createMemoryStorageAdapter();
  }

  return {
    getItem: (key) => candidate.getItem(key),
    setItem: (key, value) => candidate.setItem(key, value),
    removeItem: (key) => candidate.removeItem(key),
  };
}

export function createSessionRepository(options = {}) {
  const adapter = options.adapter ?? createLocalStorageAdapter();
  const key = String(options.key ?? DEFAULT_SESSION_STORAGE_KEY);
  const maxSessions = Math.max(1, Math.round(Number(options.maxSessions) || 120));

  function load() {
    let raw;
    try {
      raw = adapter.getItem(key);
    } catch (error) {
      return {
        ...createEmptyEnvelope(),
        recoveredFromCorruption: true,
        recoveryReason: error instanceof Error ? error.message : "storage-read-error",
      };
    }
    if (!raw) {
      return createEmptyEnvelope();
    }

    try {
      return normalizeEnvelope(JSON.parse(raw));
    } catch (error) {
      return {
        ...createEmptyEnvelope(),
        recoveredFromCorruption: true,
        recoveryReason: error instanceof Error ? error.message : "invalid-json",
      };
    }
  }

  function write(envelope, writeOptions = {}) {
    const current = load();
    const expectedRevision = writeOptions.expectedRevision;

    if (
      expectedRevision != null &&
      Number(expectedRevision) !== Number(current.revision)
    ) {
      throw new SessionRevisionConflictError(expectedRevision, current.revision);
    }

    const now = Number(writeOptions.now) || Date.now();
    const normalized = normalizeEnvelope(envelope);
    const next = {
      ...normalized,
      schemaVersion: ADAPTIVE_SCHEMA_VERSION,
      revision: current.revision + 1,
      updatedAt: now,
      sessions: limitSessions(normalized.sessions, maxSessions),
    };
    adapter.setItem(key, JSON.stringify(next));
    return cloneJson(next);
  }

  function listSessions(filter = {}) {
    return load()
      .sessions
      .filter((session) => !filter.userId || session.userId === filter.userId)
      .filter((session) => !filter.mode || session.mode === filter.mode)
      .filter((session) => !filter.status || session.status === filter.status)
      .filter(
        (session) =>
          !filter.groupId ||
          session.groupIds.includes(String(filter.groupId)) ||
          session.attempts.some((attempt) => attempt.groupId === String(filter.groupId)),
      )
      .sort((left, right) => right.startedAt - left.startedAt)
      .map(cloneJson);
  }

  function getSession(sessionId) {
    const session = load().sessions.find((item) => item.id === sessionId);
    return session ? cloneJson(session) : null;
  }

  function saveSession(rawSession, writeOptions = {}) {
    const current = load();
    const session = normalizePracticeSession(rawSession);
    const existingIndex = current.sessions.findIndex((item) => item.id === session.id);
    const sessions = current.sessions.slice();

    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }

    const envelope = write({ ...current, sessions }, {
      ...writeOptions,
      expectedRevision: writeOptions.expectedRevision ?? current.revision,
    });

    return {
      session: cloneJson(envelope.sessions.find((item) => item.id === session.id) ?? null),
      revision: envelope.revision,
      updatedAt: envelope.updatedAt,
    };
  }

  function updateSession(sessionId, updater, writeOptions = {}) {
    if (typeof updater !== "function") {
      throw new TypeError("updateSession exige uma função updater.");
    }

    const current = load();
    const existing = current.sessions.find((item) => item.id === sessionId);
    if (!existing) {
      return null;
    }

    const updated = updater(cloneJson(existing));
    return saveSession(updated, {
      ...writeOptions,
      expectedRevision: writeOptions.expectedRevision ?? current.revision,
    });
  }

  function removeSession(sessionId, writeOptions = {}) {
    const current = load();
    const sessions = current.sessions.filter((session) => session.id !== sessionId);
    if (sessions.length === current.sessions.length) {
      return { removed: false, revision: current.revision };
    }

    const envelope = write({ ...current, sessions }, {
      ...writeOptions,
      expectedRevision: writeOptions.expectedRevision ?? current.revision,
    });
    return { removed: true, revision: envelope.revision };
  }

  function getReport(reportOptions = {}) {
    return buildLearnerReport(listSessions(reportOptions.filter), reportOptions);
  }

  function exportJson(exportOptions = {}) {
    return JSON.stringify(load(), null, exportOptions.pretty === false ? 0 : 2);
  }

  function importJson(payload, importOptions = {}) {
    let parsed;
    try {
      parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
    } catch (error) {
      throw new TypeError(
        `JSON de sessões inválido: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      );
    }

    const incoming = normalizeEnvelope(parsed);
    const current = load();
    const sessions = importOptions.merge === false
      ? incoming.sessions
      : mergeSessions(current.sessions, incoming.sessions);
    return write({ ...current, ...incoming, sessions }, {
      ...importOptions,
      expectedRevision: importOptions.expectedRevision ?? current.revision,
    });
  }

  return {
    key,
    load,
    write,
    listSessions,
    getSession,
    saveSession,
    updateSession,
    removeSession,
    getReport,
    exportJson,
    importJson,
  };
}

export const createLocalSessionRepository = createSessionRepository;

function createEmptyEnvelope() {
  return {
    schemaVersion: ADAPTIVE_SCHEMA_VERSION,
    revision: 0,
    updatedAt: 0,
    sessions: [],
    metadata: {},
  };
}

function normalizeEnvelope(rawEnvelope) {
  if (Array.isArray(rawEnvelope)) {
    return normalizeEnvelope({ sessions: rawEnvelope });
  }

  if (!rawEnvelope || typeof rawEnvelope !== "object" || Array.isArray(rawEnvelope)) {
    return createEmptyEnvelope();
  }

  const sessions = Array.isArray(rawEnvelope.sessions)
    ? rawEnvelope.sessions
        .filter((session) => session && typeof session === "object")
        .map((session) => normalizePracticeSession(session))
    : [];

  return {
    schemaVersion: ADAPTIVE_SCHEMA_VERSION,
    revision: Math.max(0, Math.round(Number(rawEnvelope.revision) || 0)),
    updatedAt: Math.max(0, Number(rawEnvelope.updatedAt) || 0),
    sessions,
    metadata:
      rawEnvelope.metadata && typeof rawEnvelope.metadata === "object"
        ? cloneJson(rawEnvelope.metadata)
        : {},
  };
}

function mergeSessions(current, incoming) {
  const sessionsById = new Map(current.map((session) => [session.id, session]));
  for (const session of incoming) {
    const existing = sessionsById.get(session.id);
    if (!existing || session.updatedAt >= existing.updatedAt) {
      sessionsById.set(session.id, session);
    }
  }
  return [...sessionsById.values()];
}

function limitSessions(sessions, maxSessions) {
  const active = sessions.filter((session) => ["active", "paused"].includes(session.status));
  const finished = sessions
    .filter((session) => !["active", "paused"].includes(session.status))
    .sort((left, right) => right.startedAt - left.startedAt)
    .slice(0, Math.max(0, maxSessions - active.length));
  return [...active, ...finished].sort((left, right) => right.startedAt - left.startedAt);
}

function cloneJson(value) {
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value));
}
