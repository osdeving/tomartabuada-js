import { APP_VIEWS } from "../../lib/platform/experience";

export function AppChrome({ activeView, children, onNavigate, onOpenSettings, profile }) {
  return (
    <div className="platform-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => onNavigate("inicio")}>
          <span className="brand__mark" aria-hidden="true">Σ</span>
          <span>
            <strong>Cálculo Mental</strong>
            <small>treino que pensa com você</small>
          </span>
        </button>

        <nav className="desktop-nav" aria-label="Navegação principal">
          {APP_VIEWS.map((view) => (
            <NavButton
              key={view.id}
              active={activeView === view.id}
              view={view}
              onNavigate={onNavigate}
            />
          ))}
        </nav>

        <button className="profile-button" type="button" onClick={onOpenSettings}>
          <span className="profile-button__level">N{profile.level}</span>
          <span className="profile-button__copy">
            <strong>{profile.displayName}</strong>
            <small>{profile.xp} XP</small>
          </span>
          <span aria-hidden="true">⚙</span>
        </button>
      </header>

      <div className="platform-content">{children}</div>

      <nav className="mobile-nav" aria-label="Navegação principal">
        {APP_VIEWS.map((view) => (
          <NavButton
            key={view.id}
            active={activeView === view.id}
            compact
            view={view}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
    </div>
  );
}

function NavButton({ active, compact = false, view, onNavigate }) {
  return (
    <button
      className={`nav-button${active ? " is-active" : ""}${compact ? " is-compact" : ""}`}
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={() => onNavigate(view.id)}
    >
      <span className="nav-button__icon" aria-hidden="true">{view.icon}</span>
      <span>{compact ? view.shortLabel : view.label}</span>
    </button>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description ? <p className="page-header__copy">{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}

