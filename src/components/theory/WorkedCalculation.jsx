import { useEffect, useId, useMemo, useState } from "react";

function valueOf(source, ...keys) {
  for (const key of keys) {
    if (source?.[key] != null) return source[key];
  }
  return null;
}

function normalizedType(visual) {
  return valueOf(visual, "tipo", "type") ?? "conta-armada";
}

function visualSteps(visual) {
  const explicit = valueOf(visual, "passos", "steps");
  if (Array.isArray(explicit) && explicit.length) return explicit;
  const type = normalizedType(visual);
  if (["divisao-longa", "criss-cross", "cadeia"].includes(type)) {
    return (visual.etapas ?? []).map((step, index) => ({
      ...step,
      ordem: step.ordem ?? index + 1,
      narracao: step.narracao ?? step.rotulo ?? step.expressao ?? `Passo ${index + 1}`,
    }));
  }
  if (type === "raiz-armada") {
    return (visual.tentativas ?? visual.passos ?? []).map((step, index) => ({
      ...step,
      ordem: step.ordem ?? index + 1,
      narracao: step.narracao ?? step.expressao ?? `Tentativa ${index + 1}`,
    }));
  }
  if (type === "conta-armada" && Array.isArray(visual.etapas)) {
    return visual.etapas.map((step, index) => ({
      ...step,
      ordem: step.ordem ?? index + 1,
      narracao: step.narracao ?? step.expressao ?? `Passo ${index + 1}`,
    }));
  }
  const max = Math.max(0, ...(visual.linhas ?? []).map((row) => Number(row.passo) || 0));
  return Array.from({ length: max }, (_, index) => ({ ordem: index + 1, narracao: `Passo ${index + 1}` }));
}

export function WorkedCalculation({ visual }) {
  const titleId = useId();
  const descriptionId = useId();
  const steps = useMemo(() => visualSteps(visual), [visual]);
  const [activeStep, setActiveStep] = useState(steps.length ? 1 : 0);
  const type = normalizedType(visual);
  const label = valueOf(visual, "rotulo", "ariaLabel", "titulo") ?? "Resolução armada";
  const narration = steps[activeStep - 1]?.narracao ?? steps[activeStep - 1]?.spoken ?? visual.leitura;

  useEffect(() => {
    setActiveStep(steps.length ? 1 : 0);
  }, [steps.length, visual]);

  function moveStep(direction) {
    setActiveStep((step) => Math.max(1, Math.min(steps.length, step + direction)));
  }

  function handleStepKeyDown(event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    moveStep(event.key === "ArrowRight" ? 1 : -1);
  }

  return (
    <figure className={`calculation-board calculation-board--${type}`} aria-labelledby={titleId} aria-describedby={descriptionId}>
      <figcaption>
        <div>
          <span>Conta armada</span>
          <strong id={titleId}>{label}</strong>
        </div>
      </figcaption>

      <div className="calculation-board__canvas" aria-hidden="true">
        {type === "conta-armada" ? <StackedCalculation visual={visual} activeStep={activeStep} /> : null}
        {type === "cadeia" ? <TransformChain visual={visual} activeStep={activeStep} /> : null}
        {type === "divisao-longa" ? <LongDivision visual={visual} activeStep={activeStep} /> : null}
        {type === "criss-cross" ? <CrissCross visual={visual} activeStep={activeStep} /> : null}
        {type === "raiz-armada" ? <SquareRootBoard visual={visual} activeStep={activeStep} /> : null}
        {type === "quadrado-balanceado" ? <BalancedSquare visual={visual} activeStep={activeStep} /> : null}
      </div>

      <p className="sr-only" id={descriptionId}>{visual.leitura ?? label}</p>
      {steps.length ? (
        <div className="calculation-board__steps">
          <p aria-live="polite"><strong>Passo {activeStep} de {steps.length}.</strong> {narration}</p>
          <div role="group" aria-label="Navegar pela resolução" onKeyDown={handleStepKeyDown}>
            <button type="button" onClick={() => moveStep(-1)} disabled={activeStep <= 1} aria-label="Passo anterior">←</button>
            <span aria-hidden="true">
              {steps.map((step, index) => <i className={index + 1 === activeStep ? "is-active" : ""} key={step.id ?? step.ordem ?? index} />)}
            </span>
            <button type="button" onClick={() => moveStep(1)} disabled={activeStep >= steps.length} aria-label="Próximo passo">→</button>
          </div>
        </div>
      ) : null}
    </figure>
  );
}

function stepClass(step, activeStep) {
  const numericStep = Number(step) || 1;
  if (numericStep === activeStep) return " is-active";
  if (numericStep > activeStep) return " is-future";
  return " is-complete";
}

function StackedCalculation({ visual, activeStep }) {
  const rows = visual.linhas?.length
    ? visual.linhas
    : [
        ...(visual.parcelas ?? []).map((value, index, values) => ({
          id: `parcela-${index}`,
          passo: Math.min(index + 1, Math.max(1, values.length)),
          operador: index === values.length - 1 ? visual.operador : undefined,
          valor: value,
          tracoDepois: index === values.length - 1,
        })),
        ...(visual.resposta != null ? [{
          id: "resultado",
          passo: Math.max(1, visualSteps(visual).length),
          valor: visual.resposta,
          papel: "resultado",
        }] : []),
      ];
  return (
    <div className="stacked-calculation" style={{ "--calculation-width": `${visual.largura ?? 7}ch` }}>
      {rows.map((row, index) => (
        <div
          className={`stacked-calculation__row${row.tracoAntes ? " has-rule-before" : ""}${row.tracoDepois ? " has-rule-after" : ""}${row.papel === "resultado" ? " is-result" : ""}${stepClass(row.passo, activeStep)}`}
          key={row.id ?? index}
        >
          <span className="stacked-calculation__prefix">{row.prefixo}</span>
          <span className="stacked-calculation__operator">{row.operador}</span>
          <strong>{row.valor}</strong>
          {row.anotacao ? <small>{row.anotacao}</small> : null}
        </div>
      ))}
    </div>
  );
}

function TransformChain({ visual, activeStep }) {
  const stages = visual.etapas?.length
    ? visual.etapas
    : (visual.passos ?? []).map((step, index) => ({
        ...step,
        ordem: step.ordem ?? index + 1,
        rotulo: step.rotulo ?? step.narracao,
      }));
  return (
    <div className="transform-chain">
      {stages.map((step, index) => (
        <div className={`transform-chain__item${stepClass(step.ordem ?? index + 1, activeStep)}`} key={step.id ?? index}>
          <strong>{step.expressao}</strong>
          {step.rotulo ? <small>{step.rotulo}</small> : null}
          {index < stages.length - 1 ? <span aria-hidden="true">→</span> : null}
        </div>
      ))}
    </div>
  );
}

function LongDivision({ visual, activeStep }) {
  const stages = visual.etapas ?? visual.passos ?? [];
  return (
    <div className="long-division">
      <div className="long-division__head">
        <strong className="long-division__quotient">{visual.quociente}</strong>
        <span className="long-division__divisor">{visual.divisor}</span>
        <strong className="long-division__dividend">{visual.dividendo}</strong>
      </div>
      <div className="long-division__work">
        {stages.map((step, index) => (
          <div className={`long-division__step${stepClass(step.ordem ?? index + 1, activeStep)}`} key={step.id ?? index} style={{ "--indent": index }}>
            {step.recuo != null ? <small>+{step.recuo} no quociente</small> : null}
            <span>− {step.subtrair}</span>
            <strong>{step.resto}</strong>
          </div>
        ))}
      </div>
      {visual.resposta ? <div className="long-division__answer">Resposta: <strong>{visual.resposta}</strong></div> : null}
    </div>
  );
}

function CrissCross({ visual, activeStep }) {
  const top = String(visual.superior ?? "").split("");
  const bottom = String(visual.inferior ?? "").split("");
  const stages = visual.etapas ?? visual.passos ?? [];
  const stage = stages[activeStep - 1] ?? {};
  const width = Math.max(top.length, bottom.length, 1);
  const cell = 48;
  const positions = Array.from({ length: width }, (_, index) => 24 + index * cell);
  return (
    <div className="criss-cross">
      <svg viewBox={`0 0 ${Math.max(48, width * cell)} 120`} role="img" aria-label={visual.leitura ?? "Diagrama criss-cross"}>
        {(stage.conexoes ?? []).map((edge, index) => {
          const [topIndex, bottomIndex] = edge;
          return <line key={index} x1={positions[topIndex]} y1="28" x2={positions[bottomIndex]} y2="86" />;
        })}
        {top.map((digit, index) => <text key={`top-${index}`} x={positions[index]} y="25">{digit}</text>)}
        {bottom.map((digit, index) => <text key={`bottom-${index}`} x={positions[index]} y="105">{digit}</text>)}
      </svg>
      <div className="criss-cross__equation">
        <strong>{stage.expressao}</strong>
        {stage.resultado != null ? <span>parcial {stage.resultado}{stage.transporte ? ` · vai ${stage.transporte}` : ""}</span> : null}
      </div>
      {visual.resultado ? <div className="criss-cross__result">{visual.superior} × {visual.inferior} = <strong>{visual.resultado}</strong></div> : null}
    </div>
  );
}

function SquareRootBoard({ visual, activeStep }) {
  const trials = visual.tentativas ?? visual.passos ?? [];
  return (
    <div className="square-root-board">
      <div className="square-root-board__root"><strong>{visual.raiz}</strong><span>√</span><b>{visual.radicando}</b></div>
      <div className="square-root-board__trials">
        {trials.map((trial, index) => (
          <div className={stepClass(trial.ordem ?? index + 1, activeStep)} key={trial.id ?? index}>
            <span>{trial.expressao}</span>
            {trial.alvo ? <strong>{trial.comparacao ?? "≤"} {trial.alvo}</strong> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function BalancedSquare({ visual, activeStep }) {
  const hasSeparateStartingStep = visualSteps(visual).length >= 5;
  const stepNumbers = hasSeparateStartingStep ? [1, 2, 3, 4, 5] : [1, 1, 2, 3, 4];
  const items = [
    { label: "Número", value: visual.numero, step: stepNumbers[0] },
    { label: "Equilibre", value: `${visual.fatorMenor} × ${visual.fatorMaior}`, step: stepNumbers[1] },
    { label: "Produto", value: visual.produtoPrincipal, step: stepNumbers[2] },
    { label: "Correção", value: `+ ${visual.correcao}`, step: stepNumbers[3] },
    { label: "Resultado", value: visual.resultado, step: stepNumbers[4] },
  ];
  return (
    <div className="balanced-square">
      {items.map((item, index) => (
        <div className={`${index === items.length - 1 ? "is-result" : ""}${stepClass(Math.min(item.step, visualSteps(visual).length || 1), activeStep)}`} key={item.label}>
          <small>{item.label}</small><strong>{item.value}</strong>
          {index < items.length - 1 ? <span aria-hidden="true">→</span> : null}
        </div>
      ))}
    </div>
  );
}
