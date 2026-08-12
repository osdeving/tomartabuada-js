import { createMultiplicationPuzzle } from "./buildMultiplicationPuzzle.js";

const OPENING_MESSAGE = "Escolha um caminho útil e atire no resultado certo.";

export function createPuzzleSession(config, fixedValues) {
  let puzzle = createMultiplicationPuzzle(config, fixedValues);
  let activePathId = null;
  let activeStepIndex = 0;
  let feedback = {
    tone: "neutral",
    text: OPENING_MESSAGE,
  };

  return {
    getPuzzle() {
      return puzzle;
    },
    getValidTokens() {
      return createTokens(getAvailableSteps());
    },
    resolveToken(tokenId) {
      const availableSteps = getAvailableSteps();
      const selectedStep = availableSteps.find((step) => step.id === tokenId);

      if (!selectedStep) {
        feedback = {
          tone: "bad",
          text: activePathId
            ? "Esse número não fecha a etapa atual."
            : "Esse número não abre um caminho útil para a conta.",
        };
        return { kind: "wrong", completedPuzzle: false };
      }

      if (!activePathId) {
        const selectedPath = findPathByOpeningStep(selectedStep.id, puzzle.paths);

        if (!selectedPath) {
          feedback = {
            tone: "bad",
            text: "Esse número não corresponde a nenhum começo válido.",
          };
          return { kind: "wrong", completedPuzzle: false };
        }

        activePathId = selectedPath.id;
        activeStepIndex = 0;
      }

      const activePath = getActivePath();
      const currentStep = activePath?.steps[activeStepIndex];

      if (!activePath || !currentStep || currentStep.id !== selectedStep.id) {
        feedback = {
          tone: "bad",
          text: "Agora vale seguir o caminho já escolhido.",
        };
        return { kind: "wrong", completedPuzzle: false };
      }

      activeStepIndex += 1;

      if (activeStepIndex >= activePath.steps.length) {
        feedback = {
          tone: "good",
          text: `Conta fechada: ${puzzle.problemDisplay.formulaLabel} = ${puzzle.total}.`,
        };
        return { kind: "good", completedPuzzle: true };
      }

      const nextStep = activePath.steps[activeStepIndex];
      feedback = {
        tone: "good",
        text: `Boa. Agora calcule ${nextStep.prompt}.`,
      };
      return { kind: "good", completedPuzzle: false };
    },
    advancePuzzle() {
      puzzle = createMultiplicationPuzzle(config, fixedValues);
      activePathId = null;
      activeStepIndex = 0;
      feedback = {
        tone: "neutral",
        text: OPENING_MESSAGE,
      };
    },
    getSnapshot() {
      const activePath = getActivePath();
      const currentStep = activePath?.steps[activeStepIndex] ?? null;
      const onlyOpeningStep = !activePath && puzzle.paths.length === 1
        ? puzzle.paths[0].steps[0] ?? null
        : null;

      return {
        id: puzzle.id,
        feedback,
        problemDisplay: puzzle.problemDisplay,
        currentPrompt: currentStep?.prompt ?? onlyOpeningStep?.prompt ?? null,
        openingPrompts: activePath ? [] : puzzle.paths.map((path) => path.steps[0].prompt),
        activePathLabel: activePath?.label ?? null,
        paths: puzzle.paths.map((path) => buildPathSnapshot(path, activePathId, activeStepIndex)),
      };
    },
  };

  function getActivePath() {
    return puzzle.paths.find((path) => path.id === activePathId) ?? null;
  }

  function getAvailableSteps() {
    if (activePathId) {
      const currentStep = getActivePath()?.steps[activeStepIndex];
      return currentStep ? [currentStep] : [];
    }

    return dedupeByResultLabel(puzzle.paths.map((path) => path.steps[0]));
  }
}

function createTokens(steps) {
  return steps.map((step) => ({
    id: step.id,
    label: step.resultLabel,
  }));
}

function buildPathSnapshot(path, activePathId, activeStepIndex) {
  const isActivePath = path.id === activePathId;
  const isInactive = Boolean(activePathId) && !isActivePath;

  return {
    id: path.id,
    label: path.label,
    active: isActivePath,
    inactive: isInactive,
    steps: path.steps.map((step, index) => ({
      id: step.id,
      prompt: step.prompt,
      resultLabel: step.resultLabel,
      resolved: isActivePath ? index < activeStepIndex : false,
      current: isActivePath ? index === activeStepIndex : !activePathId && index === 0,
      available: isActivePath ? index === activeStepIndex : index === 0,
    })),
  };
}

function findPathByOpeningStep(stepId, paths) {
  return paths.find((path) => path.steps[0]?.id === stepId) ?? null;
}

function dedupeByResultLabel(steps) {
  const seen = new Set();

  return steps.filter((step) => {
    if (seen.has(step.resultLabel)) {
      return false;
    }

    seen.add(step.resultLabel);
    return true;
  });
}
