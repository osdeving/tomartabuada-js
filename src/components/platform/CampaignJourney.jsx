import {
  CAMPAIGN_STAGES,
  isCampaignStageUnlocked,
} from "../../lib/platform/campaign";
import { PageHeader } from "./AppChrome";

export function CampaignJourney({ campaign, onStartStage }) {
  const completed = CAMPAIGN_STAGES.filter((stage) => campaign[stage.id]?.completed).length;

  return (
    <div className="page-stack campaign-page">
      <PageHeader
        eyebrow="Jornada guiada"
        title="Do aquecimento à maestria"
        description="A sequência segue a progressão do material: cada capítulo adiciona uma camada e reduz um pouco a margem de tempo."
        actions={<span className="campaign-progress"><strong>{completed}</strong> / {CAMPAIGN_STAGES.length} capítulos</span>}
      />

      <section className="campaign-map">
        {CAMPAIGN_STAGES.map((stage) => {
          const progress = campaign[stage.id];
          const unlocked = isCampaignStageUnlocked(stage, campaign);
          const completedStage = Boolean(progress?.completed);

          return (
            <article
              key={stage.id}
              className={`campaign-stage${unlocked ? " is-unlocked" : " is-locked"}${completedStage ? " is-complete" : ""}`}
            >
              <div className="campaign-stage__rail">
                <span>{completedStage ? "✓" : unlocked ? stage.order : "⌁"}</span>
                {stage.order < CAMPAIGN_STAGES.length ? <i /> : null}
              </div>
              <div className="surface campaign-stage__card">
                <div className="campaign-stage__content">
                  <span className="campaign-stage__chapter">Capítulo {String(stage.order).padStart(2, "0")}</span>
                  <h2>{stage.title}</h2>
                  <p>{stage.subtitle}</p>
                  <div className="campaign-stage__meta">
                    <span>{stage.questionCount} desafios</span>
                    <span>{Math.round(stage.targetAccuracy * 100)}% para avançar</span>
                    {progress?.stars ? <span className="stars" aria-label={`${progress.stars} estrelas`}>{"★".repeat(progress.stars)}{"☆".repeat(3 - progress.stars)}</span> : null}
                  </div>
                </div>
                <button
                  className={`button ${completedStage ? "button--quiet" : "button--secondary"}`}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => onStartStage(stage)}
                >
                  {!unlocked ? "Bloqueado" : completedStage ? "Refazer" : "Começar"}
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

