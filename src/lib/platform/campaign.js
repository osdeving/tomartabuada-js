export const CAMPAIGN_STAGES = [
  {
    id: "mentalidade",
    order: 1,
    lecture: 1,
    title: "Aquecimento mental",
    subtitle: "Fatos curtos e confiança antes da velocidade.",
    groupId: "base",
    sectionPool: [
      ["adicao", "complementos-10"],
      ["subtracao", "complementos-10"],
      ["tabuada", "base"],
    ],
    questionCount: 10,
    targetAccuracy: 0.7,
    responseScale: 1.25,
  },
  {
    id: "somar-subtrair",
    order: 2,
    lecture: 2,
    title: "Somar e subtrair",
    subtitle: "Esquerda para a direita, complementos e ajustes.",
    groupId: "base",
    sectionPool: [
      ["adicao", "misto-1-algarismo"],
      ["subtracao", "misto-1-algarismo"],
      ["adicao", "sem-vai-um"],
    ],
    questionCount: 12,
    targetAccuracy: 0.75,
    responseScale: 1.15,
  },
  {
    id: "multiplicar",
    order: 3,
    lecture: 3,
    title: "Avante e multiplique",
    subtitle: "Tabuada forte, decomposição e produtos reconhecíveis.",
    groupId: "tabuada",
    sectionPool: [
      ["tabuada", "geral"],
      ["tabuada", "pesada"],
      ["tricks", "x11"],
    ],
    questionCount: 14,
    targetAccuracy: 0.78,
    responseScale: 1.08,
  },
  {
    id: "dividir",
    order: 4,
    lecture: 4,
    title: "Dividir e conquistar",
    subtitle: "Use a multiplicação inversa para encontrar o quociente.",
    groupId: "divisao",
    sectionPool: [
      ["divisao", "familias-2-5"],
      ["divisao", "familias-6-9"],
      ["divisao", "quadrados"],
    ],
    questionCount: 14,
    targetAccuracy: 0.78,
    responseScale: 1.05,
  },
  {
    id: "estimativa",
    order: 5,
    lecture: 5,
    title: "Arte da estimativa",
    subtitle: "Arredonde primeiro e refine só o que importa.",
    groupId: "misto",
    sectionPool: [
      ["adicao", "ponte-100"],
      ["subtracao", "ajuste-redondo"],
      ["quadrado", "11-19"],
    ],
    questionCount: 15,
    targetAccuracy: 0.8,
    responseScale: 1,
  },
  {
    id: "verificacao",
    order: 6,
    lecture: 6,
    title: "Escreva e verifique",
    subtitle: "Contas maiores com etapas mentais confiáveis.",
    groupId: "misto",
    sectionPool: [
      ["adicao", "misto"],
      ["subtracao", "misto"],
      ["quadrado", "misto"],
    ],
    questionCount: 16,
    targetAccuracy: 0.8,
    responseScale: 0.98,
  },
  {
    id: "multiplicacao-intermediaria",
    order: 7,
    lecture: 7,
    title: "Multiplicação intermediária",
    subtitle: "Atalhos de dois dígitos e padrões que eliminam trabalho.",
    groupId: "quadrado",
    sectionPool: [
      ["tricks", "x11"],
      ["tricks", "mesma-dezena"],
      ["quadrado", "termina-5"],
    ],
    questionCount: 16,
    targetAccuracy: 0.82,
    responseScale: 0.94,
  },
  {
    id: "divisao-veloz",
    order: 8,
    lecture: 8,
    title: "Divisão veloz",
    subtitle: "Famílias misturadas com menos tempo para hesitar.",
    groupId: "divisao",
    sectionPool: [["divisao", "toda-tabuada"]],
    questionCount: 18,
    targetAccuracy: 0.82,
    responseScale: 0.9,
  },
  {
    id: "memoria-numerica",
    order: 9,
    lecture: 9,
    title: "Memória numérica",
    subtitle: "Recupere fatos fortes sem depender de contagem.",
    groupId: "base",
    sectionPool: [
      ["tabuada", "pesada"],
      ["divisao", "quadrados"],
      ["quadrado", "11-19"],
    ],
    questionCount: 18,
    targetAccuracy: 0.84,
    responseScale: 0.86,
  },
  {
    id: "calendario",
    order: 10,
    lecture: 10,
    title: "Ritmo e calendário",
    subtitle: "Sequências rápidas e alternância sem perder o fio.",
    groupId: "misto",
    sectionPool: [
      ["adicao", "misto"],
      ["subtracao", "misto"],
      ["tabuada", "geral"],
      ["divisao", "toda-tabuada"],
    ],
    questionCount: 20,
    targetAccuracy: 0.85,
    responseScale: 0.82,
  },
  {
    id: "multiplicacao-avancada",
    order: 11,
    lecture: 11,
    title: "Multiplicação avançada",
    subtitle: "Quadrados e produtos especiais sob pressão.",
    groupId: "quadrado",
    sectionPool: [
      ["tricks", "mesma-dezena"],
      ["quadrado", "termina-5"],
      ["quadrado", "cinquenta"],
      ["tricks", "x11"],
    ],
    questionCount: 20,
    targetAccuracy: 0.86,
    responseScale: 0.78,
  },
  {
    id: "mestre",
    order: 12,
    lecture: 12,
    title: "Mestre do cálculo mental",
    subtitle: "Tudo misturado, pouco tempo e nenhuma zona de conforto.",
    groupId: "misto",
    sectionPool: [
      ["adicao", "misto"],
      ["subtracao", "misto"],
      ["tabuada", "pesada"],
      ["divisao", "toda-tabuada"],
      ["quadrado", "misto"],
      ["tricks", "mesma-dezena"],
    ],
    questionCount: 25,
    targetAccuracy: 0.88,
    responseScale: 0.72,
  },
];

export function getCampaignStage(stageId) {
  return CAMPAIGN_STAGES.find((stage) => stage.id === stageId) ?? CAMPAIGN_STAGES[0];
}

export function getUnlockedStageCount(campaignProgress = {}) {
  const completedCount = CAMPAIGN_STAGES.filter(
    (stage) => campaignProgress[stage.id]?.completed,
  ).length;

  return Math.min(CAMPAIGN_STAGES.length, completedCount + 1);
}

export function isCampaignStageUnlocked(stage, campaignProgress = {}) {
  if (stage.order === 1) return true;

  const previousStage = CAMPAIGN_STAGES[stage.order - 2];
  return Boolean(campaignProgress[previousStage.id]?.completed);
}

export function getCampaignStars(accuracy) {
  if (accuracy >= 0.95) return 3;
  if (accuracy >= 0.82) return 2;
  if (accuracy >= 0.7) return 1;
  return 0;
}

