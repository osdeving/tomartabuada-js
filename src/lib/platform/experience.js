export const APP_VIEWS = [
  { id: "inicio", label: "Início", shortLabel: "Início", icon: "⌂" },
  { id: "treinar", label: "Treinar", shortLabel: "Treino", icon: "⚡" },
  { id: "campanha", label: "Campanha", shortLabel: "Jornada", icon: "◆" },
  { id: "teoria", label: "Teoria", shortLabel: "Teoria", icon: "◫" },
  { id: "relatorios", label: "Relatórios", shortLabel: "Dados", icon: "↗" },
];

export const PRACTICE_GROUPS = [
  {
    id: "misto",
    label: "Mix adaptativo",
    shortLabel: "Mix",
    description: "O treinador escolhe o próximo padrão a partir do seu momento.",
    color: "violet",
    sectionIds: ["tabuada", "adicao", "subtracao", "divisao", "quadrado", "tricks"],
  },
  {
    id: "mix-insano",
    label: "Mix Insana",
    shortLabel: "Insana",
    description: "Começa leve, lê sua precisão e seu ritmo, e libera contas compostas cada vez mais cabulosas.",
    color: "pink",
    sectionIds: ["mix-insano"],
    generatorId: "insane-mix",
  },
  {
    id: "base",
    label: "Fundamentos",
    shortLabel: "Base",
    description: "Complementos, tabuada e fatos que precisam sair sem esforço.",
    color: "cyan",
    sectionIds: ["tabuada", "adicao", "subtracao"],
  },
  {
    id: "adicao",
    label: "Adição",
    shortLabel: "Adição",
    description: "Da soma curta às pontes de 100 e contas com vai-um.",
    color: "lime",
    sectionIds: ["adicao"],
  },
  {
    id: "subtracao",
    label: "Subtração",
    shortLabel: "Subtração",
    description: "Volta pelo 10, empréstimo e ajuste de números redondos.",
    color: "orange",
    sectionIds: ["subtracao"],
  },
  {
    id: "tabuada",
    label: "Multiplicação",
    shortLabel: "Vezes",
    description: "Tabuada, produtos de dois dígitos e reconhecimento de padrões.",
    color: "pink",
    sectionIds: ["tabuada", "tricks"],
  },
  {
    id: "divisao",
    label: "Divisão",
    shortLabel: "Divisão",
    description: "Famílias inversas e quocientes cada vez menos óbvios.",
    color: "blue",
    sectionIds: ["divisao"],
  },
  {
    id: "quadrado",
    label: "Quadrados & truques",
    shortLabel: "Padrões",
    description: "Quadrados, vezes 11 e atalhos para ganhar velocidade.",
    color: "yellow",
    sectionIds: ["quadrado", "tricks"],
  },
];

export const SESSION_MODES = [
  {
    id: "sparring",
    label: "Sparring",
    eyebrow: "Treino adaptativo",
    description: "Sem punição. O ritmo muda com você e revisita o que ainda pesa.",
    defaultQuestionCount: 15,
    icon: "◎",
  },
  {
    id: "sobrevivencia",
    label: "Sobrevivência",
    eyebrow: "3 vidas",
    description: "A pressão sobe a cada acerto. Uma resposta errada custa uma vida.",
    defaultQuestionCount: null,
    icon: "♥",
  },
  {
    id: "sprint",
    label: "Sprint 60",
    eyebrow: "Contra o relógio",
    description: "Sessenta segundos para somar o máximo de respostas limpas.",
    defaultQuestionCount: null,
    durationMs: 60_000,
    icon: "↯",
  },
];

export const THEMES = [
  {
    id: "neon",
    label: "Neon noturno",
    description: "Azul profundo, violeta elétrico e verde ácido.",
    swatches: ["#0b1024", "#7c5cff", "#b7ff5a"],
  },
  {
    id: "cobalto",
    label: "Cobalto",
    description: "Azul intenso, laranja quente e branco nítido.",
    swatches: ["#071b33", "#1677ff", "#ff7a45"],
  },
  {
    id: "solar",
    label: "Solar",
    description: "Carvão, amarelo vivo e vermelho de alta energia.",
    swatches: ["#161616", "#ffd60a", "#ff3b30"],
  },
  {
    id: "claro",
    label: "Claro concentrado",
    description: "Fundo claro de alto contraste, sem cara de consultório pastel.",
    swatches: ["#f5f7fb", "#5b3df5", "#0f766e"],
  },
];

export const QUESTION_COUNTS = [10, 15, 25, 40];

export const TIME_PROFILES = [
  {
    id: "sem-limite",
    label: "Sem cronômetro",
    shortLabel: "Livre",
    description: "O tempo é medido para adaptar o treino, mas nunca encerra a questão.",
    deadlineScale: null,
    feedbackDelayMs: 1_050,
  },
  {
    id: "calmo",
    label: "Calmo",
    shortLabel: "Calmo",
    description: "Mais espaço para pensar e construir confiança.",
    deadlineScale: 1.75,
    feedbackDelayMs: 1_000,
  },
  {
    id: "ritmo",
    label: "No ritmo",
    shortLabel: "Ritmo",
    description: "Uma pressão leve, sem transformar a conta numa corrida.",
    deadlineScale: 1.25,
    feedbackDelayMs: 760,
  },
  {
    id: "reflexo",
    label: "Reflexo",
    shortLabel: "Reflexo",
    description: "Janela curta para testar o que já deveria sair na hora.",
    deadlineScale: 0.82,
    feedbackDelayMs: 520,
  },
];

export function getPracticeGroup(groupId) {
  return PRACTICE_GROUPS.find((group) => group.id === groupId) ?? PRACTICE_GROUPS[0];
}

export function getSessionMode(modeId) {
  return SESSION_MODES.find((mode) => mode.id === modeId) ?? SESSION_MODES[0];
}

export function getTimeProfile(profileId) {
  return TIME_PROFILES.find((profile) => profile.id === profileId) ?? TIME_PROFILES[1];
}

export function getTheme(themeId) {
  return THEMES.find((theme) => theme.id === themeId) ?? THEMES[0];
}
