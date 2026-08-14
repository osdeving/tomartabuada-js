import { useCallback, useEffect, useRef, useState } from "react";
import { SOCIAL_DEMO_ACCOUNTS, createSocialService } from "../lib/social/index.js";

const EMPTY_SNAPSHOT = Object.freeze({
  currentUser: null,
  clans: [],
  members: [],
  teams: [],
  disputes: [],
  availableOpponents: [],
});

export function useCommunity(providedService = null) {
  const serviceRef = useRef(null);
  if (!serviceRef.current) serviceRef.current = providedService ?? createSocialService();

  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [selectedClanId, setSelectedClanId] = useState(null);
  const selectedClanIdRef = useRef(selectedClanId);
  const mountedRef = useRef(true);
  const refreshSequenceRef = useRef(0);
  const commandInFlightRef = useRef(new Set());

  selectedClanIdRef.current = selectedClanId;

  const refresh = useCallback(async ({ showLoading = false } = {}) => {
    const sequence = refreshSequenceRef.current + 1;
    refreshSequenceRef.current = sequence;
    if (showLoading) setStatus("loading");

    try {
      const service = serviceRef.current;
      const [auth, clans, members, teams, disputes] = await Promise.all([
        service.getSession(),
        service.listClans(),
        service.listUsers(),
        service.listTeams(),
        service.listDisputes(),
      ]);
      if (!mountedRef.current || refreshSequenceRef.current !== sequence) return null;

      const currentUser = auth?.user ?? null;
      const projectedClans = clans.map(toClanView);
      const projectedTeams = teams.map(toTeamView);
      const nextSnapshot = {
        currentUser,
        clans: projectedClans,
        members,
        teams: projectedTeams,
        disputes: disputes.map(toDisputeView),
        availableOpponents: projectedTeams.filter((team) => (
          !currentUser?.clanId || team.clanId !== currentUser.clanId
        )),
      };
      const currentSelection = selectedClanIdRef.current;
      const nextSelectedClanId = projectedClans.some((clan) => clan.id === currentSelection)
        ? currentSelection
        : currentUser?.clanId ?? projectedClans[0]?.id ?? null;

      selectedClanIdRef.current = nextSelectedClanId;
      setSelectedClanId(nextSelectedClanId);
      setSnapshot(nextSnapshot);
      setError(null);
      setStatus("ready");
      return nextSnapshot;
    } catch (failure) {
      if (!mountedRef.current || refreshSequenceRef.current !== sequence) return null;
      setError(failure);
      setStatus("error");
      return null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh({ showLoading: true });
    return () => {
      mountedRef.current = false;
      refreshSequenceRef.current += 1;
    };
  }, [refresh]);

  const runCommand = useCallback(async (commandKey, command) => {
    if (commandInFlightRef.current.has(commandKey)) return null;
    commandInFlightRef.current.add(commandKey);
    try {
      const result = await command(serviceRef.current);
      await refresh();
      return result;
    } finally {
      commandInFlightRef.current.delete(commandKey);
    }
  }, [refresh]);

  const login = useCallback(({ identifier, handle, password } = {}) => {
    selectedClanIdRef.current = null;
    setSelectedClanId(null);
    return runCommand("login", (service) => service.login({
      handle: identifier ?? handle,
      password,
    }));
  }, [runCommand]);

  const logout = useCallback(() => {
    selectedClanIdRef.current = null;
    setSelectedClanId(null);
    return runCommand("logout", (service) => service.logout());
  }, [runCommand]);

  const createTeam = useCallback((command) => (
    runCommand("create-team", (service) => service.createTeam(command))
  ), [runCommand]);

  const createDispute = useCallback((command) => (
    runCommand("create-dispute", (service) => service.createDispute(command))
  ), [runCommand]);

  const finishDispute = useCallback((disputeId) => (
    runCommand(`finish-dispute:${disputeId}`, (service) => service.finishDispute({ disputeId }))
  ), [runCommand]);

  const recordTrainingPoints = useCallback(async (command) => {
    const result = await serviceRef.current.recordTrainingPoints(command);
    await refresh();
    return result;
  }, [refresh]);

  const selectClan = useCallback((clanId) => {
    selectedClanIdRef.current = clanId;
    setSelectedClanId(clanId);
  }, []);

  return {
    ...snapshot,
    createDispute,
    createTeam,
    demoAccounts: SOCIAL_DEMO_ACCOUNTS,
    error,
    finishDispute,
    login,
    logout,
    recordTrainingPoints,
    refresh: () => refresh({ showLoading: true }),
    selectedClanId,
    selectClan,
    sourceLabel: "Dados locais simulados",
    status,
  };
}

function toClanView(clan) {
  return {
    ...clan,
    points: Math.max(0, Number(clan.totalPoints ?? clan.points) || 0),
  };
}

function toTeamView(team) {
  return {
    ...team,
    points: Math.max(0, Number(team.totalPoints ?? team.points) || 0),
  };
}

function toDisputeView(dispute) {
  return {
    ...dispute,
    homeTeam: dispute.homeTeam ? toTeamView(dispute.homeTeam) : null,
    awayTeam: dispute.awayTeam ? toTeamView(dispute.awayTeam) : null,
    homeScore: Math.max(0, Number(dispute.score?.home ?? dispute.homeScore) || 0),
    awayScore: Math.max(0, Number(dispute.score?.away ?? dispute.awayScore) || 0),
    finishedAt: dispute.endedAt ?? dispute.finishedAt ?? null,
  };
}
