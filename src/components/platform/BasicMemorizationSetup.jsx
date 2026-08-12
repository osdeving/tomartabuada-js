import {
  MEMORIZATION_OPERATIONS,
  getMemorizationPresets,
} from "../../lib/platform/basicMemorization";

const ADDITION_LEVELS = [
  { id: "adaptive", label: "Adaptativo", detail: "Sobe quando precisão e tempo estiverem firmes." },
  { id: "no-overflow", label: "Sem vai um", detail: "Dezenas e unidades ficam no próprio lugar." },
  { id: "unity-overflow", label: "Vai um nas unidades", detail: "As unidades criam uma dezena nova." },
  { id: "double-overflow", label: "Vai um duplo", detail: "Unidades e dezenas atravessam a base." },
];

const SUBTRACTION_LEVELS = [
  { id: "adaptive", label: "Adaptativo", detail: "Libera empréstimos conforme o domínio cresce." },
  { id: "no-borrow", label: "Sem empréstimo", detail: "Cada casa resolve sua própria diferença." },
  { id: "unity-borrow", label: "Empréstimo nas unidades", detail: "Uma dezena vira dez unidades." },
  { id: "cascade-borrow", label: "Empréstimo em cascata", detail: "O empréstimo atravessa uma casa vazia." },
];

export function BasicMemorizationSetup({ value, onChange }) {
  const operation = MEMORIZATION_OPERATIONS.find((item) => item.id === value.operationId)
    ?? MEMORIZATION_OPERATIONS[0];
  const presets = getMemorizationPresets(operation.id);
  const selectedPresetIds = value.presetIds?.length
    ? value.presetIds
    : [value.presetId ?? presets[0].id];
  const levelOptions = operation.id === "addition"
    ? ADDITION_LEVELS
    : operation.id === "subtraction" ? SUBTRACTION_LEVELS : [];
  const showsLevels = value.presetId === "two-digits" && levelOptions.length;

  function selectOperation(operationId) {
    const nextPresets = getMemorizationPresets(operationId);
    const firstPresetId = nextPresets[0].id;
    onChange({
      operationId,
      presetId: firstPresetId,
      presetIds: operationId === "multiplication" ? [firstPresetId] : undefined,
      difficultyMode: "adaptive",
      difficultyTier: "all",
    });
  }

  function toggleMultiplicationPreset(presetId) {
    if (presetId === "all") {
      onChange({ ...value, presetId: "all", presetIds: ["all"] });
      return;
    }

    const withoutAll = selectedPresetIds.filter((id) => id !== "all");
    const selected = new Set(withoutAll);
    if (selected.has(presetId)) selected.delete(presetId);
    else selected.add(presetId);
    const next = presets
      .map((preset) => preset.id)
      .filter((id) => id !== "all" && selected.has(id));
    onChange({
      ...value,
      presetId: next[0] ?? "all",
      presetIds: next.length ? next : ["all"],
    });
  }

  function selectLevel(levelId) {
    onChange({
      ...value,
      difficultyMode: levelId === "adaptive" ? "adaptive" : "fixed",
      difficultyTier: levelId === "adaptive" ? "all" : levelId,
    });
  }

  const activeLevel = value.difficultyMode === "fixed" ? value.difficultyTier : "adaptive";

  return (
    <>
      <section className="surface setup-section memorization-setup">
        <div className="section-title-row">
          <div>
            <span className="step-number">02</span>
            <div>
              <h2>O que precisa ficar automático?</h2>
              <p className="section-copy">Erros e hesitações voltam mais cedo. Respostas instantâneas ganham espaço.</p>
            </div>
          </div>
        </div>

        <div className="memory-operation-grid">
          {MEMORIZATION_OPERATIONS.map((item) => (
            <button
              aria-pressed={operation.id === item.id}
              key={item.id}
              className={`memory-operation${operation.id === item.id ? " is-selected" : ""}`}
              type="button"
              onClick={() => selectOperation(item.id)}
            >
              <span aria-hidden="true">{item.symbol}</span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="surface setup-section memorization-setup">
        <div className="section-title-row">
          <div>
            <span className="step-number">03</span>
            <div>
              <h2>{operation.id === "multiplication" ? "Escolha o recorte da tabuada" : "Escolha o tamanho das contas"}</h2>
              <p className="section-copy">
                {operation.id === "multiplication"
                  ? "Combine filtros para atacar exatamente o conjunto que você quer memorizar."
                  : "O modo adaptativo cuida da dificuldade dentro do tamanho escolhido."}
              </p>
            </div>
          </div>
        </div>

        <div className="memory-preset-grid">
          {presets.map((preset) => {
            const selected = operation.id === "multiplication"
              ? selectedPresetIds.includes(preset.id)
              : value.presetId === preset.id;
            return (
              <button
                aria-pressed={selected}
                key={preset.id}
                className={`memory-preset${selected ? " is-selected" : ""}`}
                type="button"
                onClick={() => operation.id === "multiplication"
                  ? toggleMultiplicationPreset(preset.id)
                  : onChange({
                      ...value,
                      presetId: preset.id,
                      presetIds: undefined,
                      difficultyMode: "adaptive",
                      difficultyTier: "all",
                    })}
              >
                <span className="memory-preset__check" aria-hidden="true">{selected ? "✓" : "+"}</span>
                <strong>{preset.label}</strong>
                <small>{preset.description}</small>
              </button>
            );
          })}
        </div>

        {showsLevels ? (
          <div className="memory-levels">
            <div>
              <p className="eyebrow">Progressão</p>
              <strong>Escolha um nível ou deixe o treino subir sozinho</strong>
            </div>
            <div className="memory-level-grid">
              {levelOptions.map((level) => (
                <button
                  aria-pressed={activeLevel === level.id}
                  className={activeLevel === level.id ? "is-selected" : ""}
                  key={level.id}
                  type="button"
                  onClick={() => selectLevel(level.id)}
                >
                  <strong>{level.label}</strong>
                  <small>{level.detail}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
