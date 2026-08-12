import { THEMES } from "../../lib/platform/experience";

export function SettingsDrawer({ installAvailable, onClose, onExport, onInstall, onReset, onUpdate, settings }) {
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="settings-drawer" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="settings-drawer__header">
          <div><p className="eyebrow">Preferências</p><h2 id="settings-title">Seu ambiente</h2></div>
          <button className="drawer-close" type="button" onClick={onClose} aria-label="Fechar configurações">×</button>
        </header>

        <div className="settings-drawer__body">
          <section className="settings-section">
            <div><h3>Tema</h3><p>Cor forte também ajuda a separar ambiente de estudo e hora do treino.</p></div>
            <div className="theme-grid">
              {THEMES.map((theme) => (
                <button key={theme.id} className={`theme-card${settings.theme === theme.id ? " is-selected" : ""}`} type="button" onClick={() => onUpdate({ theme: theme.id })}>
                  <span className="theme-swatches">{theme.swatches.map((color) => <i key={color} style={{ background: color }} />)}</span>
                  <strong>{theme.label}</strong><small>{theme.description}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <div><h3>Experiência</h3><p>Ajustes válidos também durante as sessões.</p></div>
            <div className="setting-list">
              <SettingToggle label="Som de feedback" detail="Sinais curtos para acerto, erro e recorde." checked={settings.sound} onChange={(value) => onUpdate({ sound: value })} />
              <SettingToggle label="Resposta tátil" detail="Uma vibração discreta em aparelhos compatíveis." checked={settings.haptics} onChange={(value) => onUpdate({ haptics: value })} />
              <SettingToggle label="Reduzir movimento" detail="Desliga tremor, pulso e celebrações animadas." checked={settings.reducedMotion} onChange={(value) => onUpdate({ reducedMotion: value })} />
              <SettingToggle label="Coach de descanso" detail="Observa queda incomum no desempenho e sugere uma pausa." checked={settings.autoRestCoach} onChange={(value) => onUpdate({ autoRestCoach: value })} />
            </div>
          </section>

          <section className="settings-section settings-section--row">
            <div><h3>Meta diária</h3><p>Quantidade de respostas para fechar o círculo do dia.</p></div>
            <div className="segmented-control">
              {[10, 20, 30, 50].map((goal) => <button key={goal} className={settings.dailyGoal === goal ? "is-active" : ""} type="button" onClick={() => onUpdate({ dailyGoal: goal })}>{goal}</button>)}
            </div>
          </section>

          <section className="settings-section install-section">
            <div className="install-section__icon" aria-hidden="true">⌂</div>
            <div><h3>Aplicativo instalável</h3><p>Funciona em tela cheia e mantém teoria e treinos básicos disponíveis offline.</p></div>
            {installAvailable ? <button className="button button--secondary" type="button" onClick={onInstall}>Instalar</button> : <span className="offline-ready">✓ pronto para offline</span>}
          </section>

          <section className="settings-section">
            <div><h3>Seus dados</h3><p>Hoje ficam apenas neste navegador, em um formato pronto para sincronização futura.</p></div>
            <div className="button-row">
              <button className="button button--quiet" type="button" onClick={onExport}>Exportar JSON</button>
              <button className="button button--danger" type="button" onClick={onReset}>Apagar progresso</button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function SettingToggle({ checked, detail, label, onChange }) {
  return (
    <label className="setting-toggle">
      <span><strong>{label}</strong><small>{detail}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

