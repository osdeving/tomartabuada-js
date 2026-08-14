import { useMemo, useRef, useState } from "react";
import { PageHeader } from "./AppChrome";

const EMPTY_LIST = [];
const FINISHED_STATUSES = new Set(["finished", "completed", "finalizada", "finalizado"]);

/**
 * Interface controlada da comunidade. Não acessa storage, rede ou repositórios.
 *
 * Entidades esperadas:
 * - user: { id, displayName, handle, avatar, points, clanId }
 * - clan: { id, name, tag, color, memberCount, points, rank }
 * - team: { id, name, clanId, members, points }
 * - dispute: {
 *     id, status, homeTeam, awayTeam, homeScore, awayScore,
 *     winnerTeamId, createdAt, finishedAt
 *   }
 *
 * Os callbacks de comando podem ser síncronos ou retornar Promise. Quando
 * retornam Promise, o componente mantém o comando desabilitado até a conclusão.
 */
export function CommunityHub({
  actionError = null,
  availableOpponents = EMPTY_LIST,
  clans = EMPTY_LIST,
  currentUser = null,
  demoAccounts = EMPTY_LIST,
  disputes = EMPTY_LIST,
  error = null,
  maxTeamSize = 4,
  members = EMPTY_LIST,
  minTeamSize = 2,
  onCreateDispute,
  onCreateTeam,
  onFinishDispute,
  onLogin,
  onLogout,
  onPlayDispute,
  onRetry,
  onSelectClan,
  pendingAction = null,
  selectedClanId = null,
  sourceLabel = "Dados locais simulados",
  status = "ready",
  teams = EMPTY_LIST,
}) {
  const [localAction, setLocalAction] = useState(null);
  const [localError, setLocalError] = useState(null);
  const actionLockRef = useRef(false);
  const activeAction = pendingAction ?? localAction;
  const visibleActionError = actionError ?? localError;

  async function runAction(action, callback, payload, onSuccess) {
    if (!callback || activeAction || actionLockRef.current) return;

    actionLockRef.current = true;
    setLocalAction(action);
    setLocalError(null);

    try {
      await callback(payload);
      onSuccess?.();
    } catch (actionFailure) {
      setLocalError(actionFailure instanceof Error ? actionFailure.message : "Não foi possível concluir a ação.");
    } finally {
      actionLockRef.current = false;
      setLocalAction(null);
    }
  }

  if (status === "loading") {
    return <CommunityLoading />;
  }

  if (status === "error") {
    return <CommunityError error={error} onRetry={onRetry} />;
  }

  if (!currentUser) {
    return (
      <CommunityLogin
        activeAction={activeAction}
        demoAccounts={demoAccounts}
        error={visibleActionError ?? error}
        onLogin={(credentials) => runAction("login", onLogin, credentials)}
        sourceLabel={sourceLabel}
      />
    );
  }

  return (
    <AuthenticatedCommunity
      activeAction={activeAction}
      availableOpponents={availableOpponents}
      clans={clans}
      currentUser={currentUser}
      disputes={disputes}
      error={visibleActionError}
      maxTeamSize={maxTeamSize}
      members={members}
      minTeamSize={minTeamSize}
      onCreateDispute={(payload, onSuccess) => runAction("create-dispute", onCreateDispute, payload, onSuccess)}
      onCreateTeam={(payload, onSuccess) => runAction("create-team", onCreateTeam, payload, onSuccess)}
      onFinishDispute={(disputeId) => runAction(`finish-dispute:${disputeId}`, onFinishDispute, disputeId)}
      onLogout={() => runAction("logout", onLogout)}
      onPlayDispute={onPlayDispute}
      onSelectClan={onSelectClan}
      selectedClanId={selectedClanId}
      sourceLabel={sourceLabel}
      teams={teams}
    />
  );
}

function CommunityLoading() {
  return (
    <div className="page-stack community-page" aria-busy="true">
      <PageHeader
        eyebrow="Comunidade"
        title="Preparando a arena"
        description="Carregando clãs, times e disputas."
      />
      <section className="surface community-state" role="status" aria-live="polite">
        <span className="community-state__spinner" aria-hidden="true" />
        <div>
          <h2>Montando o placar…</h2>
          <p>Isso deve levar só um instante.</p>
        </div>
      </section>
    </div>
  );
}

function CommunityError({ error, onRetry }) {
  return (
    <div className="page-stack community-page">
      <PageHeader
        eyebrow="Comunidade"
        title="A arena ficou indisponível"
        description="Seu progresso de treino continua seguro. Tente carregar os dados da comunidade novamente."
      />
      <section className="surface community-state community-state--error" role="alert">
        <span className="community-state__icon" aria-hidden="true">!</span>
        <div>
          <h2>Não foi possível abrir a comunidade</h2>
          <p>{readError(error)}</p>
        </div>
        {onRetry ? <button className="button button--secondary" type="button" onClick={onRetry}>Tentar novamente</button> : null}
      </section>
    </div>
  );
}

function CommunityLogin({ activeAction, demoAccounts, error, onLogin, sourceLabel }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const isLoggingIn = activeAction === "login";

  function submit(event) {
    event.preventDefault();
    onLogin({ identifier: identifier.trim(), password });
  }

  function fillDemoAccount(account) {
    setIdentifier(account.identifier ?? account.handle ?? account.email ?? account.id ?? "");
    setPassword(account.password ?? "");
  }

  return (
    <div className="page-stack community-page community-page--login">
      <PageHeader
        eyebrow="Comunidade"
        title="Treine junto. Vença junto."
        description="Entre para somar seus pontos ao clã, montar times e enfrentar outras equipes."
        actions={<span className="community-source-badge"><i aria-hidden="true" /> {sourceLabel}</span>}
      />

      <div className="community-login-grid">
        <section className="surface community-login-card">
          <div>
            <p className="eyebrow">Identificação</p>
            <h2>Entrar na comunidade</h2>
            <p>As mesmas telas continuarão válidas quando a conta passar a ser sincronizada pelo servidor.</p>
          </div>

          <form className="community-login-form" onSubmit={submit}>
            <label className="community-field">
              <span>Usuário</span>
              <input
                autoComplete="username"
                name="identifier"
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="ex.: luna"
                required
                type="text"
                value={identifier}
              />
            </label>
            <label className="community-field">
              <span>Senha</span>
              <input
                autoComplete="current-password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Sua senha"
                required
                type="password"
                value={password}
              />
            </label>
            {error ? <InlineError error={error} /> : null}
            <button className="button button--primary button--large" disabled={isLoggingIn} type="submit">
              {isLoggingIn ? "Entrando…" : "Entrar"} {!isLoggingIn ? <span aria-hidden="true">→</span> : null}
            </button>
          </form>
        </section>

        <aside className="surface community-demo-card">
          <p className="eyebrow">Experimente agora</p>
          <h2>Contas de demonstração</h2>
          <p>Escolha uma identidade pronta para conhecer clãs com posições e funções diferentes.</p>
          {demoAccounts.length ? (
            <div className="community-demo-list">
              {demoAccounts.map((account) => {
                const login = account.identifier ?? account.handle ?? account.email ?? account.id;
                return (
                  <button key={account.id ?? login} type="button" onClick={() => fillDemoAccount(account)}>
                    <Avatar user={account} />
                    <span>
                      <strong>{account.displayName ?? account.label ?? login}</strong>
                      <small>{login} · senha {account.password ?? "definida"}</small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="community-empty">Nenhuma conta de demonstração disponível.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function AuthenticatedCommunity({
  activeAction,
  availableOpponents,
  clans,
  currentUser,
  disputes,
  error,
  maxTeamSize,
  members,
  minTeamSize,
  onCreateDispute,
  onCreateTeam,
  onFinishDispute,
  onLogout,
  onPlayDispute,
  onSelectClan,
  selectedClanId,
  sourceLabel,
  teams,
}) {
  const clanById = useMemo(() => new Map(clans.map((clan) => [clan.id, clan])), [clans]);
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const orderedClans = useMemo(() => [...clans].sort(compareClans), [clans]);
  const ownClan = clanById.get(currentUser.clanId) ?? null;
  const selectedClan = clanById.get(selectedClanId) ?? ownClan ?? orderedClans[0] ?? null;
  const selectedMembers = selectedClan ? members.filter((member) => member.clanId === selectedClan.id) : EMPTY_LIST;
  const selectedTeams = selectedClan ? teams.filter((team) => team.clanId === selectedClan.id) : EMPTY_LIST;
  const ownMembers = ownClan ? members.filter((member) => member.clanId === ownClan.id) : EMPTY_LIST;
  const ownTeams = ownClan
    ? teams.filter((team) => team.clanId === ownClan.id && teamContainsUser(team, currentUser.id))
    : EMPTY_LIST;
  const opponentTeams = availableOpponents.length
    ? availableOpponents
    : teams.filter((team) => team.clanId !== currentUser.clanId);
  const activeDisputes = disputes.filter((dispute) => !isDisputeFinished(dispute)).length;

  return (
    <div className="page-stack community-page">
      <PageHeader
        eyebrow="Comunidade"
        title="Arena de clãs"
        description="Cada ponto conquistado pelos membros fortalece o clã. Times transformam esse esforço coletivo em confrontos diretos."
        actions={(
          <div className="community-account">
            <Avatar user={currentUser} />
            <span><strong>{currentUser.displayName}</strong><small>{formatHandle(currentUser.handle)} · {formatPoints(currentUser.points)} pts</small></span>
            <button className="button button--quiet" disabled={activeAction === "logout"} type="button" onClick={onLogout}>
              {activeAction === "logout" ? "Saindo…" : "Sair"}
            </button>
          </div>
        )}
      />

      <div className="community-toolbar">
        <span className="community-source-badge"><i aria-hidden="true" /> {sourceLabel}</span>
        <span className="community-sync-note">Fonte desacoplada · pronta para sincronização futura</span>
      </div>

      {error ? <InlineError error={error} /> : null}

      <section className="metric-grid metric-grid--four" aria-label="Resumo da comunidade">
        <CommunityMetric label="Seu clã" value={ownClan ? `[${ownClan.tag}]` : "Sem clã"} detail={ownClan?.name ?? "Entre em um clã para competir"} />
        <CommunityMetric label="Pontos do clã" value={formatPoints(ownClan?.points)} detail={ownClan?.rank ? `${ownClan.rank}º no ranking` : "ainda sem posição"} />
        <CommunityMetric label="Seus pontos" value={formatPoints(currentUser.points)} detail="somados ao total coletivo" />
        <CommunityMetric label="Disputas abertas" value={activeDisputes} detail={activeDisputes === 1 ? "confronto aguardando resultado" : "confrontos aguardando resultado"} />
      </section>

      <div className="community-overview-grid">
        <ClanLeaderboard
          clans={orderedClans}
          currentClanId={currentUser.clanId}
          onSelectClan={onSelectClan}
          selectedClanId={selectedClan?.id}
        />
        <ClanDetail
          clan={selectedClan}
          memberById={memberById}
          members={selectedMembers}
          teams={selectedTeams}
        />
      </div>

      {ownClan ? (
        <div className="community-actions-grid">
          <TeamComposer
            activeAction={activeAction}
            maxTeamSize={maxTeamSize}
            members={ownMembers}
            minTeamSize={minTeamSize}
            onCreateTeam={onCreateTeam}
          />
          <DisputeComposer
            activeAction={activeAction}
            clanById={clanById}
            homeTeams={ownTeams}
            onCreateDispute={onCreateDispute}
            opponentTeams={opponentTeams}
          />
        </div>
      ) : (
        <section className="surface community-empty-card">
          <span aria-hidden="true">◇</span>
          <div><h2>Você ainda não representa um clã</h2><p>Quando uma associação for feita pela fonte de dados, a montagem de times será liberada aqui.</p></div>
        </section>
      )}

      <DisputeBoard
        activeAction={activeAction}
        clanById={clanById}
        currentClanId={currentUser.clanId}
        currentUserId={currentUser.id}
        disputes={disputes}
        onFinishDispute={onFinishDispute}
        onPlayDispute={onPlayDispute}
      />
    </div>
  );
}

function CommunityMetric({ detail, label, value }) {
  return (
    <article className="surface community-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ClanLeaderboard({ clans, currentClanId, onSelectClan, selectedClanId }) {
  return (
    <section className="surface community-ranking-card">
      <div className="section-title-row">
        <div><p className="eyebrow">Classificação geral</p><h2>Ranking de clãs</h2></div>
        <span className="section-hint">Pontos de todos os membros</span>
      </div>
      {clans.length ? (
        <ol className="community-ranking-list">
          {clans.map((clan, index) => {
            const rank = clan.rank ?? index + 1;
            const isCurrent = clan.id === currentClanId;
            const isSelected = clan.id === selectedClanId;
            return (
              <li key={clan.id}>
                <button
                  aria-pressed={isSelected}
                  className={`${isSelected ? "is-selected" : ""}${isCurrent ? " is-current" : ""}`}
                  onClick={() => onSelectClan?.(clan.id)}
                  style={{ "--clan-color": clan.color ?? "var(--accent)" }}
                  type="button"
                >
                  <span className="community-ranking-list__rank">{rank}</span>
                  <ClanMark clan={clan} />
                  <span className="community-ranking-list__identity">
                    <strong>{clan.name}</strong>
                    <small>{clan.memberCount ?? 0} membros {isCurrent ? "· seu clã" : ""}</small>
                  </span>
                  <strong className="community-ranking-list__points">{formatPoints(clan.points)} <small>pts</small></strong>
                </button>
              </li>
            );
          })}
        </ol>
      ) : <p className="community-empty">Nenhum clã entrou no ranking ainda.</p>}
    </section>
  );
}

function ClanDetail({ clan, memberById, members, teams }) {
  if (!clan) {
    return (
      <section className="surface community-clan-card community-clan-card--empty">
        <p className="community-empty">Selecione um clã para conhecer seus membros e times.</p>
      </section>
    );
  }

  return (
    <section className="surface community-clan-card" style={{ "--clan-color": clan.color ?? "var(--accent)" }}>
      <header className="community-clan-card__header">
        <ClanMark clan={clan} large />
        <div><p className="eyebrow">Clã em destaque</p><h2>{clan.name}</h2><span>[{clan.tag}] · {formatPoints(clan.points)} pontos</span></div>
      </header>

      <div className="community-clan-columns">
        <div>
          <h3>Membros</h3>
          {members.length ? (
            <ul className="community-member-list">
              {[...members].sort((left, right) => (right.points ?? 0) - (left.points ?? 0)).map((member) => (
                <li key={member.id}>
                  <Avatar user={member} />
                  <span><strong>{member.displayName}</strong><small>{formatHandle(member.handle)}</small></span>
                  <strong>{formatPoints(member.points)}</strong>
                </li>
              ))}
            </ul>
          ) : <p className="community-empty">Nenhum membro cadastrado.</p>}
        </div>

        <div>
          <h3>Times</h3>
          {teams.length ? (
            <ul className="community-team-list">
              {teams.map((team) => (
                <li key={team.id}>
                  <span aria-hidden="true">◆</span>
                  <div><strong>{team.name}</strong><small>{teamMemberNames(team, memberById)}</small></div>
                  <strong>{formatPoints(team.points)} pts</strong>
                </li>
              ))}
            </ul>
          ) : <p className="community-empty">Este clã ainda não formou times.</p>}
        </div>
      </div>
    </section>
  );
}

function TeamComposer({ activeAction, maxTeamSize, members, minTeamSize, onCreateTeam }) {
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState([]);
  const isCreating = activeAction === "create-team";
  const isValid = name.trim() && memberIds.length >= minTeamSize && memberIds.length <= maxTeamSize;

  function toggleMember(memberId) {
    setMemberIds((current) => {
      if (current.includes(memberId)) return current.filter((id) => id !== memberId);
      if (current.length >= maxTeamSize) return current;
      return [...current, memberId];
    });
  }

  function submit(event) {
    event.preventDefault();
    onCreateTeam({ name: name.trim(), memberIds }, () => {
      setName("");
      setMemberIds([]);
    });
  }

  return (
    <section className="surface community-composer">
      <div className="section-title-row">
        <div><p className="eyebrow">Seu clã</p><h2>Formar um time</h2></div>
        <span className="community-count-chip">{memberIds.length}/{maxTeamSize}</span>
      </div>
      <p className="community-composer__copy">Escolha de {minTeamSize} a {maxTeamSize} membros. A força inicial combina os pontos da equipe.</p>

      <form onSubmit={submit}>
        <label className="community-field">
          <span>Nome do time</span>
          <input maxLength={32} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Velozes do Ábaco" required value={name} />
        </label>

        <fieldset className="community-member-picker">
          <legend>Membros</legend>
          {members.map((member) => {
            const checked = memberIds.includes(member.id);
            const limitReached = !checked && memberIds.length >= maxTeamSize;
            return (
              <label key={member.id} className={checked ? "is-selected" : ""}>
                <input checked={checked} disabled={limitReached} onChange={() => toggleMember(member.id)} type="checkbox" />
                <Avatar user={member} />
                <span><strong>{member.displayName}</strong><small>{formatPoints(member.points)} pts</small></span>
                <i aria-hidden="true">{checked ? "✓" : "+"}</i>
              </label>
            );
          })}
        </fieldset>

        <button className="button button--secondary" disabled={!isValid || Boolean(activeAction)} type="submit">
          {isCreating ? "Formando time…" : "Criar time"}
        </button>
      </form>
    </section>
  );
}

function DisputeComposer({ activeAction, clanById, homeTeams, onCreateDispute, opponentTeams }) {
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const isCreating = activeAction === "create-dispute";

  function submit(event) {
    event.preventDefault();
    onCreateDispute({ homeTeamId, awayTeamId }, () => {
      setHomeTeamId("");
      setAwayTeamId("");
    });
  }

  return (
    <section className="surface community-composer community-composer--challenge">
      <div className="section-title-row">
        <div><p className="eyebrow">Confronto direto</p><h2>Lançar uma disputa</h2></div>
        <span className="community-versus" aria-hidden="true">VS</span>
      </div>
      <p className="community-composer__copy">Escolha um time do seu clã e desafie uma equipe adversária.</p>

      <form onSubmit={submit}>
        <label className="community-field">
          <span>Seu time</span>
          <select required value={homeTeamId} onChange={(event) => setHomeTeamId(event.target.value)}>
            <option value="">Selecione o representante</option>
            {homeTeams.map((team) => <option key={team.id} value={team.id}>{team.name} · {formatPoints(team.points)} pts</option>)}
          </select>
        </label>
        <label className="community-field">
          <span>Time adversário</span>
          <select required value={awayTeamId} onChange={(event) => setAwayTeamId(event.target.value)}>
            <option value="">Selecione o desafiante</option>
            {opponentTeams.map((team) => {
              const clan = clanById.get(team.clanId);
              return <option key={team.id} value={team.id}>{team.name} · [{clan?.tag ?? "?"}]</option>;
            })}
          </select>
        </label>
        {!homeTeams.length || !opponentTeams.length ? (
          <p className="community-form-hint">{!homeTeams.length ? "Participe de ao menos um time para disputar." : "Nenhum time adversário está disponível agora."}</p>
        ) : null}
        <button className="button button--primary" disabled={!homeTeamId || !awayTeamId || Boolean(activeAction)} type="submit">
          {isCreating ? "Criando disputa…" : "Desafiar time"} {!isCreating ? <span aria-hidden="true">→</span> : null}
        </button>
      </form>
    </section>
  );
}

function DisputeBoard({
  activeAction,
  clanById,
  currentClanId,
  currentUserId,
  disputes,
  onFinishDispute,
  onPlayDispute,
}) {
  const orderedDisputes = useMemo(
    () => [...disputes].sort((left, right) => disputeTimestamp(right) - disputeTimestamp(left)),
    [disputes],
  );

  return (
    <section className="surface community-disputes-card">
      <div className="section-title-row">
        <div><p className="eyebrow">Arena</p><h2>Disputas entre clãs</h2></div>
        <span className="section-hint">Confrontos mais recentes primeiro</span>
      </div>

      {orderedDisputes.length ? (
        <div className="community-dispute-list">
          {orderedDisputes.map((dispute) => (
            <DisputeCard
              activeAction={activeAction}
              clanById={clanById}
              currentClanId={currentClanId}
              currentUserId={currentUserId}
              dispute={dispute}
              key={dispute.id}
              onFinish={onFinishDispute}
              onPlay={onPlayDispute}
            />
          ))}
        </div>
      ) : <p className="community-empty">A primeira disputa ainda será lançada.</p>}
    </section>
  );
}

function DisputeCard({
  activeAction,
  clanById,
  currentClanId,
  currentUserId,
  dispute,
  onFinish,
  onPlay,
}) {
  const finished = isDisputeFinished(dispute);
  const homeTeam = dispute.homeTeam ?? {};
  const awayTeam = dispute.awayTeam ?? {};
  const homeClan = clanById.get(homeTeam.clanId);
  const awayClan = clanById.get(awayTeam.clanId);
  const belongsToCurrentClan = homeTeam.clanId === currentClanId || awayTeam.clanId === currentClanId;
  const participates = teamContainsUser(homeTeam, currentUserId) || teamContainsUser(awayTeam, currentUserId);
  const isFinishing = activeAction === `finish-dispute:${dispute.id}`;
  const resultLabel = dispute.winnerTeamId
    ? `${dispute.winnerTeamId === homeTeam.id ? homeTeam.name : awayTeam.name} venceu`
    : "Empate";

  return (
    <article className={`${belongsToCurrentClan ? "is-mine" : ""}${finished ? " is-finished" : ""}`}>
      <div className="community-dispute-list__meta">
        <span className={`community-status community-status--${finished ? "finished" : "open"}`}>
          {finished ? "Finalizada" : "Em disputa"}
        </span>
        <small>{formatDate(dispute.finishedAt ?? dispute.createdAt)}</small>
      </div>

      <div className="community-matchup">
        <TeamSide clan={homeClan} score={dispute.homeScore} team={homeTeam} winner={dispute.winnerTeamId === homeTeam.id} />
        <span className="community-matchup__versus">{finished ? "×" : "VS"}</span>
        <TeamSide away clan={awayClan} score={dispute.awayScore} team={awayTeam} winner={dispute.winnerTeamId === awayTeam.id} />
      </div>

      <footer>
        <strong>{finished ? resultLabel : belongsToCurrentClan ? "Seu clã está neste confronto" : "Resultado pendente"}</strong>
        {!finished && (participates || belongsToCurrentClan) ? (
          <span className="community-dispute-actions">
            {participates && onPlay ? (
              <button className="button button--primary" disabled={Boolean(activeAction)} type="button" onClick={() => onPlay(dispute)}>
                Treinar pelo time
              </button>
            ) : null}
            {belongsToCurrentClan && onFinish ? (
              <button className="button button--secondary" disabled={Boolean(activeAction)} type="button" onClick={() => onFinish(dispute.id)}>
                {isFinishing ? "Finalizando…" : "Encerrar disputa"}
              </button>
            ) : null}
          </span>
        ) : null}
      </footer>
    </article>
  );
}

function TeamSide({ away = false, clan, score, team, winner }) {
  return (
    <div className={`community-team-side${away ? " community-team-side--away" : ""}${winner ? " is-winner" : ""}`}>
      <ClanMark clan={clan ?? { name: team.name, tag: "?" }} />
      <span><small>[{clan?.tag ?? "?"}]</small><strong>{team.name ?? "Time removido"}</strong></span>
      <strong className="community-team-side__score">{score ?? "—"}</strong>
    </div>
  );
}

function ClanMark({ clan, large = false }) {
  return (
    <span
      aria-hidden="true"
      className={`community-clan-mark${large ? " community-clan-mark--large" : ""}`}
      style={{ "--clan-color": clan?.color ?? "var(--accent)" }}
    >
      {String(clan?.tag ?? clan?.name ?? "?").slice(0, 3).toUpperCase()}
    </span>
  );
}

function Avatar({ user }) {
  const avatar = user?.avatar;
  if (avatar && /^(?:https?:|data:image\/|\/)/i.test(avatar)) {
    return <img alt="" className="community-avatar" src={avatar} />;
  }

  return <span className="community-avatar" aria-hidden="true">{avatar || initials(user?.displayName ?? user?.handle)}</span>;
}

function InlineError({ error }) {
  return <p className="community-inline-error" role="alert"><span aria-hidden="true">!</span> {readError(error)}</p>;
}

function readError(error) {
  if (typeof error === "string") return error;
  return error?.message ?? "Não foi possível carregar os dados agora.";
}

function compareClans(left, right) {
  if (left.rank != null && right.rank != null) return left.rank - right.rank;
  if (left.rank != null) return -1;
  if (right.rank != null) return 1;
  return (right.points ?? 0) - (left.points ?? 0);
}

function formatPoints(value) {
  return Number(value ?? 0).toLocaleString("pt-BR");
}

function formatHandle(handle) {
  if (!handle) return "sem identificador";
  return handle.startsWith("@") ? handle : `@${handle}`;
}

function formatDate(value) {
  if (!value) return "agora";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data indisponível";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function initials(value = "?") {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";
}

function teamMemberNames(team, memberById) {
  const teamMembers = team.members ?? team.memberIds ?? EMPTY_LIST;
  const names = teamMembers.map((member) => {
    if (typeof member === "object") return member.displayName ?? member.handle ?? member.id;
    const record = memberById.get(member);
    return record?.displayName ?? record?.handle ?? member;
  });
  return names.length ? names.join(", ") : "Sem membros";
}

function isDisputeFinished(dispute) {
  return FINISHED_STATUSES.has(String(dispute.status).toLowerCase()) || Boolean(dispute.finishedAt);
}

function disputeTimestamp(dispute) {
  const value = new Date(dispute.finishedAt ?? dispute.createdAt ?? 0).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function teamContainsUser(team, userId) {
  if (!userId) return false;
  const members = team?.memberIds ?? team?.members ?? EMPTY_LIST;
  return members.some((member) => (typeof member === "object" ? member.id : member) === userId);
}
