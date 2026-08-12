export const STORAGE_KEY = "tomar-tabuada.mental-math.v1";

export const SECTIONS = [
  {
    id: "teoria",
    label: "Teoria",
    kicker: "Métodos",
    description: "Atalhos mentais, decomposição e ajustes para calcular sem travar.",
  },
  {
    id: "tabuada",
    label: "Tabuada",
    kicker: "Base",
    description: "Multiplicação como fundação para divisão, quadrados e rapidez.",
  },
  {
    id: "adicao",
    label: "Adição",
    kicker: "1 e 2 dígitos",
    description: "Complementos, vai-um e blocos maiores no mesmo fluxo.",
  },
  {
    id: "subtracao",
    label: "Subtração",
    kicker: "1 e 2 dígitos",
    description: "Complementos, volta pelo 10, empréstimo e ajustes rápidos.",
  },
  {
    id: "divisao",
    label: "Divisão",
    kicker: "Inversa",
    description: "Volta para a tabuada, consolida famílias e melhora estimativa.",
  },
  {
    id: "quadrado",
    label: "Quadrado",
    kicker: "Padrões",
    description: "Quadrados perto de 10, terminados em 5 e começando com 5.",
  },
  {
    id: "tricks",
    label: "Tricks",
    kicker: "Padrões",
    description: "11, final 5, dezenas iguais e truques em formato de exercício.",
  },
  {
    id: "game",
    label: "Game",
    kicker: "Canvas",
    description: "Área isolada para protótipos jogáveis e experiências visuais.",
  },
  {
    id: "flashcards",
    label: "Flashcards",
    kicker: "Revisão",
    description: "Virar, responder rápido e martelar os padrões que precisam entrar.",
  },
];

export const PRACTICE_SECTION_IDS = [
  "tabuada",
  "adicao",
  "subtracao",
  "divisao",
  "quadrado",
  "tricks",
];

const PRESETS = {
  tabuada: [
    {
      id: "base",
      label: "2 a 5",
      detail: "Primeiro bloco para fixar famílias sem barulho.",
      tip: "Automatiza 2, 3, 4 e 5 antes de apertar 6, 7, 8 e 9.",
      responseWindowMs: 15_000,
      reviewBaseMs: 180_000,
    },
    {
      id: "geral",
      label: "2 a 9",
      detail: "Mistura geral da tabuada.",
      tip: "Boa para manter tudo vivo sem viciar num único fator.",
      responseWindowMs: 15_000,
      reviewBaseMs: 180_000,
    },
    {
      id: "pesada",
      label: "6 a 9",
      detail: "Miolo mais duro da multiplicação.",
      tip: "Se travar, use quadrados e vizinhos: 7x8 conversa com 7x7 e 8x8.",
      responseWindowMs: 15_000,
      reviewBaseMs: 180_000,
    },
    {
      id: "quadrados",
      label: "Quadrados",
      detail: "2x2 até 9x9, porque isso destrava muita conta depois.",
      tip: "Quadrados são âncoras rápidas para divisão, estimativa e truques.",
      responseWindowMs: 15_000,
      reviewBaseMs: 180_000,
    },
  ],
  adicao: [
    {
      id: "complementos-10",
      label: "Complementos de 10",
      detail: "Só pares como 6+4, 7+3 e 8+2.",
      tip: "Aqui o alvo é fechar 10 sem hesitar.",
      responseWindowMs: 5_000,
      reviewBaseMs: 60_000,
    },
    {
      id: "passa-10",
      label: "Passa 10",
      detail: "Só somas de 1 algarismo que estouram 10.",
      tip: "Veja 6+7 como 6+4+3 ou 7+3+3.",
      responseWindowMs: 5_000,
      reviewBaseMs: 60_000,
    },
    {
      id: "misto-1-algarismo",
      label: "1 algarismo",
      detail: "Mistura complementos com somas que passam de 10.",
      tip: "Boa para automatizar o bloco curto sem ruído.",
      responseWindowMs: 5_000,
      reviewBaseMs: 60_000,
    },
    {
      id: "sem-vai-um",
      label: "Sem vai-um",
      detail: "Duas parcelas de 2 dígitos sem carry.",
      tip: "Some dezenas primeiro e feche as unidades no final.",
      responseWindowMs: 10_000,
      reviewBaseMs: 120_000,
    },
    {
      id: "com-vai-um",
      label: "Com vai-um",
      detail: "O preset mais importante: unidades estouram 10.",
      tip: "Visualize a dezena nova surgindo assim que as unidades passam de 9.",
      responseWindowMs: 10_000,
      reviewBaseMs: 120_000,
    },
    {
      id: "ponte-100",
      label: "Perto de 100",
      detail: "Chega em 100 e só então ajusta o resto.",
      tip: "Quando a conta quase fecha 100, use o 100 como atalho e ajuste a diferença.",
      responseWindowMs: 10_000,
      reviewBaseMs: 120_000,
    },
    {
      id: "misto",
      label: "Misto",
      detail: "Alterna sem carry, com carry e ponte.",
      tip: "Bom para não decorar um único padrão.",
      responseWindowMs: 10_000,
      reviewBaseMs: 120_000,
    },
  ],
  subtracao: [
    {
      id: "complementos-10",
      label: "Complementos de 10",
      detail: "Só contas como 10-6, 10-7 e 10-8.",
      tip: "Leia sempre como o complemento que falta para 10.",
      responseWindowMs: 5_000,
      reviewBaseMs: 60_000,
    },
    {
      id: "passa-10",
      label: "Volta do 10",
      detail: "Só contas de 1 algarismo que descem passando pelo 10.",
      tip: "13-8 e 14-6 pedem quebra rápida do 10.",
      responseWindowMs: 5_000,
      reviewBaseMs: 60_000,
    },
    {
      id: "misto-1-algarismo",
      label: "1 algarismo",
      detail: "Mistura complementos com contas que cruzam o 10.",
      tip: "Treina a volta do 10 sem cair em conta fácil demais.",
      responseWindowMs: 5_000,
      reviewBaseMs: 60_000,
    },
    {
      id: "sem-emprestimo",
      label: "Sem empréstimo",
      detail: "Subtração limpa com 2 dígitos.",
      tip: "Tire dezenas antes de pensar nas unidades.",
      responseWindowMs: 10_000,
      reviewBaseMs: 120_000,
    },
    {
      id: "com-emprestimo",
      label: "Com empréstimo",
      detail: "O ponto difícil: falta unidade e entra uma dezena.",
      tip: "Quando 2 não tira 8, transforme mentalmente em 12 - 8.",
      responseWindowMs: 10_000,
      reviewBaseMs: 120_000,
    },
    {
      id: "ajuste-redondo",
      label: "Ajuste redondo",
      detail: "Subtrai um número quase redondo e devolve o excesso.",
      tip: "83 - 29 vira 83 - 30 + 1. Esse ajuste reduz atrito.",
      responseWindowMs: 10_000,
      reviewBaseMs: 120_000,
    },
    {
      id: "misto",
      label: "Misto",
      detail: "Mistura empréstimo, sem empréstimo e arredondamento.",
      tip: "Treino de leitura rápida do melhor caminho.",
      responseWindowMs: 10_000,
      reviewBaseMs: 120_000,
    },
  ],
  divisao: [
    {
      id: "familias-2-5",
      label: "2 a 5",
      detail: "Divisão exata nas famílias mais dóceis.",
      tip: "Sempre pense na multiplicação inversa antes de fechar a resposta.",
      responseWindowMs: 18_000,
      reviewBaseMs: 210_000,
    },
    {
      id: "familias-6-9",
      label: "6 a 9",
      detail: "Famílias mais pesadas, já ligadas na tabuada forte.",
      tip: "Se a família pesa, volte ao fato da tabuada correspondente.",
      responseWindowMs: 18_000,
      reviewBaseMs: 210_000,
    },
    {
      id: "toda-tabuada",
      label: "2 a 9",
      detail: "Mistura geral de divisões exatas.",
      tip: "Boa para consolidar a ida e a volta entre multiplicar e dividir.",
      responseWindowMs: 18_000,
      reviewBaseMs: 210_000,
    },
    {
      id: "quadrados",
      label: "Quadrados perfeitos",
      detail: "49÷7, 64÷8, 81÷9 e parentes próximos.",
      tip: "Quadrados conhecidos deixam a divisão instantânea.",
      responseWindowMs: 18_000,
      reviewBaseMs: 210_000,
    },
  ],
  quadrado: [
    {
      id: "11-19",
      label: "11 a 19",
      detail: "Usa 10 + d como base mental.",
      tip: "Pense em 100 + 20d + d²; para 14², d = 4.",
      responseWindowMs: 15_000,
      reviewBaseMs: 180_000,
    },
    {
      id: "termina-5",
      label: "Termina em 5",
      detail: "O clássico n(n+1) e termina com 25.",
      tip: "35² vira 3x4 | 25. Isso precisa virar reflexo.",
      responseWindowMs: 15_000,
      reviewBaseMs: 180_000,
    },
    {
      id: "cinquenta",
      label: "50 a 59",
      detail: "O lance de quando começa com 5.",
      tip: "Use 2500 + 100d + d², com d sendo o quanto passou de 50.",
      responseWindowMs: 18_000,
      reviewBaseMs: 210_000,
    },
    {
      id: "misto",
      label: "Misto",
      detail: "Mistura 10 + d, final 5 e números na casa dos 50.",
      tip: "Treina a escolha do truque certo antes de calcular.",
      responseWindowMs: 18_000,
      reviewBaseMs: 210_000,
    },
  ],
  tricks: [
    {
      id: "x11",
      label: "x11",
      detail: "Dois dígitos vezes 11 somando os vizinhos.",
      tip: "Primeiro, soma do meio, último. Se passar de 9, sobe 1.",
      responseWindowMs: 15_000,
      reviewBaseMs: 180_000,
    },
    {
      id: "mesma-dezena",
      label: "Dezena igual",
      detail: "Mesma dezena e unidades que somam 10.",
      tip: "83x87 vira 8x9 na frente e 3x7 no final.",
      responseWindowMs: 18_000,
      reviewBaseMs: 210_000,
    },
    {
      id: "termina-5",
      label: "Final 5",
      detail: "Quadrado de números terminados em 5.",
      tip: "Parte da frente é n(n+1); a resposta termina em 25.",
      responseWindowMs: 15_000,
      reviewBaseMs: 180_000,
    },
    {
      id: "cinquenta",
      label: "Começa com 5",
      detail: "Quadrados de 50 a 59 em sequência.",
      tip: "Pense 2500 + 100d + d², sem escrever nada.",
      responseWindowMs: 18_000,
      reviewBaseMs: 210_000,
    },
  ],
};

export const THEORY_TOPICS = [
  {
    id: "simplificar",
    title: "Simplificar antes de calcular",
    summary:
      "Troque uma conta pesada por outra parecida, mas muito mais fácil.",
    steps: [
      "quebre a conta em blocos menores",
      "arredonde para um número limpo quando isso ajudar",
      "resolva o bloco simples primeiro e ajuste depois",
    ],
    example: "1241 - 587 = 1241 - 600 + 13 = 654.",
    exampleLatex: "1241 - 587 = 1241 - 600 + 13 = 654",
    practice: {
      sectionId: "subtracao",
      presetId: "ajuste-redondo",
      label: "Treinar ajuste redondo",
    },
  },
  {
    id: "esquerda",
    title: "Some da esquerda para a direita",
    summary:
      "Em vez de pensar nas unidades primeiro, comece por dezenas e blocos maiores.",
    steps: [
      "some ou subtraia as dezenas",
      "guarde um valor parcial já correto",
      "feche a conta nas unidades",
    ],
    example: "47 + 32 = 47 + 30 + 2 = 79.",
    exampleLatex: "47 + 32 = 47 + 30 + 2 = 79",
    practice: {
      sectionId: "adicao",
      presetId: "sem-vai-um",
      label: "Treinar soma limpa",
    },
  },
  {
    id: "carry",
    title: "Carry é uma dezena nova",
    summary:
      "Quando as unidades passam de 9, a conta não travou; ela só criou mais uma dezena.",
    steps: [
      "feche as dezenas primeiro",
      "some as unidades",
      "se passou de 9, entregue 1 dezena para a parte da frente",
    ],
    example: "48 + 37 = 48 + 30 + 7 = 78 + 7 = 85.",
    exampleLatex: "48 + 37 = 48 + 30 + 7 = 78 + 7 = 85",
    practice: {
      sectionId: "adicao",
      presetId: "com-vai-um",
      label: "Treinar carry",
    },
  },
  {
    id: "emprestimo",
    title: "Empréstimo vira 10 unidades",
    summary:
      "Na subtração, o empréstimo fica mais leve quando você enxerga a dezena quebrando em 10 unidades.",
    steps: [
      "subtraia as dezenas que derem para tirar sem drama",
      "se faltar unidade, pegue 1 dezena",
      "pense em 12 - 8, 13 - 7 e assim por diante",
    ],
    example: "52 - 38 = 52 - 30 = 22; depois 22 - 8 = 14.",
    exampleLatex: "52 - 38 = 52 - 30 = 22",
    exampleNote: "Depois, 22 - 8 = 14.",
    practice: {
      sectionId: "subtracao",
      presetId: "com-emprestimo",
      label: "Treinar empréstimo",
    },
  },
  {
    id: "x11",
    title: "Multiplicar por 11 somando vizinhos",
    summary:
      "Em números de dois dígitos, o miolo da resposta nasce da soma dos dois algarismos.",
    steps: [
      "guarde o primeiro algarismo",
      "some os dois algarismos do número",
      "feche com o último algarismo e carregue 1 se precisar",
    ],
    example: "57 x 11 -> 5 | 12 | 7 -> 627.",
    exampleLatex: "57 \\times 11 \\rightarrow 5\\,|\\,12\\,|\\,7 \\rightarrow 627",
    practice: {
      sectionId: "tricks",
      presetId: "x11",
      label: "Treinar x11",
    },
  },
  {
    id: "final-5",
    title: "Quadrados terminados em 5",
    summary:
      "Para qualquer número que termina em 5, a resposta termina em 25; a frente vem de n(n+1).",
    steps: [
      "ignore o 5 final e olhe só a parte da frente",
      "multiplique esse número pelo próximo",
      "anexe 25",
    ],
    example: "75² -> 7 x 8 | 25 = 5625.",
    exampleLatex: "75^2 \\rightarrow 7 \\times 8\\,|\\,25 = 5625",
    practice: {
      sectionId: "quadrado",
      presetId: "termina-5",
      label: "Treinar final 5",
    },
  },
  {
    id: "mesma-dezena",
    title: "Mesma dezena, unidades somam 10",
    summary:
      "Quando os números começam com a mesma dezena e o final fecha 10, a multiplicação encurta muito.",
    steps: [
      "multiplique a dezena pelo próximo número",
      "multiplique as unidades entre si",
      "cole os dois pedaços",
    ],
    example: "83 x 87 -> 8 x 9 = 72 e 3 x 7 = 21, então 7221.",
    exampleLatex: "83 \\times 87 \\rightarrow 8 \\times 9 = 72,\\; 3 \\times 7 = 21",
    exampleNote: "Cole os dois pedaços: 7221.",
    practice: {
      sectionId: "tricks",
      presetId: "mesma-dezena",
      label: "Treinar dezenas iguais",
    },
  },
  {
    id: "cinquenta",
    title: "Quadrados na casa dos 50",
    summary:
      "Quando começa com 5, pense no número como 50 + d e use 2500 como base.",
    steps: [
      "descubra quanto faltou ou passou de 50",
      "faça 2500 + 100d",
      "some d² no final",
    ],
    example: "54² = 2500 + 400 + 16 = 2916.",
    exampleLatex: "54^2 = 2500 + 400 + 16 = 2916",
    practice: {
      sectionId: "tricks",
      presetId: "cinquenta",
      label: "Treinar 50 a 59",
    },
  },
];

export const TRICK_LESSONS = [
  {
    id: "x11",
    title: "Dois dígitos x 11",
    rule: "primeiro | soma do meio | último",
    example: "67 x 11 = 737",
    exampleLatex: "67 \\times 11 = 737",
    presetId: "x11",
  },
  {
    id: "mesma-dezena",
    title: "Mesma dezena, unidades somam 10",
    rule: "n x (n+1) na frente, produto das unidades atrás",
    example: "34 x 36 = 12 | 24 = 1224.",
    exampleLatex: "34 \\times 36 = 12\\,|\\,24 = 1224",
    presetId: "mesma-dezena",
  },
  {
    id: "termina-5",
    title: "Quadrado terminado em 5",
    rule: "parte da frente x próximo número e termina em 25",
    example: "85² = 8 x 9 | 25 = 7225.",
    exampleLatex: "85^2 = 8 \\times 9\\,|\\,25 = 7225",
    presetId: "termina-5",
  },
  {
    id: "cinquenta",
    title: "Quadrados dos 50",
    rule: "2500 + 100d + d²",
    example: "58² = 2500 + 800 + 64 = 3364.",
    exampleLatex: "58^2 = 2500 + 800 + 64 = 3364",
    presetId: "cinquenta",
  },
];

const FLASHCARD_DECKS = [
  {
    id: "base",
    label: "Base rápida",
    detail: "Tabuada, divisão e quadrados para manter o esqueleto do cálculo vivo.",
    cards: [
      { front: "7 x 8", frontLatex: "7 \\times 8", back: "56", backLatex: "56" },
      { front: "9 x 6", frontLatex: "9 \\times 6", back: "54", backLatex: "54" },
      { front: "64 ÷ 8", frontLatex: "64 \\div 8", back: "8", backLatex: "8" },
      { front: "81 ÷ 9", frontLatex: "81 \\div 9", back: "9", backLatex: "9" },
      {
        front: "14²",
        frontLatex: "14^2",
        back: "196",
        backLatex: "14^2 = 196",
        note: "Pense em 100 + 80 + 16.",
      },
      {
        front: "75²",
        frontLatex: "75^2",
        back: "5625",
        backLatex: "75^2 = 5625",
        note: "Faça 7 x 8 e anexe 25.",
      },
    ],
  },
  {
    id: "carry",
    label: "Carry e empréstimo",
    detail: "O miolo mais difícil da adição e da subtração até 2 algarismos.",
    cards: [
      {
        front: "48 + 37",
        frontLatex: "48 + 37",
        back: "85",
        backLatex: "48 + 37 = 85",
        note: "Some 30 primeiro e feche com +7.",
      },
      {
        front: "68 + 29",
        frontLatex: "68 + 29",
        back: "97",
        backLatex: "68 + 29 = 97",
        note: "Use 68 + 32 - 3 ou 68 + 20 + 9.",
      },
      {
        front: "52 - 38",
        frontLatex: "52 - 38",
        back: "14",
        backLatex: "52 - 38 = 14",
        note: "Tire 30, depois faça 22 - 8.",
      },
      {
        front: "83 - 29",
        frontLatex: "83 - 29",
        back: "54",
        backLatex: "83 - 29 = 54",
        note: "Tire 30 e devolva 1.",
      },
      {
        front: "56 + 18",
        frontLatex: "56 + 18",
        back: "74",
        backLatex: "56 + 18 = 74",
        note: "O 6 + 8 cria uma dezena nova.",
      },
      {
        front: "71 - 46",
        frontLatex: "71 - 46",
        back: "25",
        backLatex: "71 - 46 = 25",
        note: "Veja 71 - 40 = 31 e 31 - 6 = 25.",
      },
    ],
  },
  {
    id: "tricks",
    label: "Padrões rápidos",
    detail: "Atalhos em forma de revisão curta.",
    cards: [
      {
        front: "37 x 11",
        frontLatex: "37 \\times 11",
        back: "407",
        backLatex: "37 \\times 11 = 407",
        note: "3 | 10 | 7.",
      },
      {
        front: "85 x 11",
        frontLatex: "85 \\times 11",
        back: "935",
        backLatex: "85 \\times 11 = 935",
        note: "8 | 13 | 5, então sobe 1.",
      },
      {
        front: "83 x 87",
        frontLatex: "83 \\times 87",
        back: "7221",
        backLatex: "83 \\times 87 = 7221",
        note: "8 x 9 na frente e 3 x 7 atrás.",
      },
      {
        front: "35²",
        frontLatex: "35^2",
        back: "1225",
        backLatex: "35^2 = 1225",
        note: "3 x 4 e termina em 25.",
      },
      {
        front: "54²",
        frontLatex: "54^2",
        back: "2916",
        backLatex: "54^2 = 2916",
        note: "2500 + 400 + 16.",
      },
      {
        front: "Qual é a ideia central?",
        back: "Simplifique primeiro, calcule depois e ajuste no fim.",
      },
    ],
  },
];

const SECTION_PRIMERS = {
  tabuada: [
    {
      title: "Famílias antes de velocidade",
      body: "Quem domina os blocos 6, 7, 8 e 9 sofre menos em divisão, quadrados e truques.",
    },
    {
      title: "Quadrados são âncoras",
      body: "7x7, 8x8 e 9x9 ajudam a deduzir vizinhos sem recomeçar do zero.",
    },
    {
      title: "Repita o que pesa",
      body: "Se 8x7 trava, treine o trio 8x6, 8x7 e 8x8 até ficar automático.",
    },
  ],
  adicao: [
    {
      title: "Dezenas primeiro",
      body: "O método mental fica mais limpo quando você fecha as dezenas e só depois resolve o resto.",
    },
    {
      title: "Carry tem nome",
      body: "O vai-um não é um mistério: ele é só mais uma dezena entrando na conta.",
    },
    {
      title: "Ponte resolve",
      body: "Se a soma encosta em 100, passe por 100 e ajuste o pedaço que sobrou.",
    },
  ],
  subtracao: [
    {
      title: "Arredonde o subtraendo",
      body: "Subtrair 29 costuma ser mais fácil como subtrair 30 e devolver 1.",
    },
    {
      title: "Empréstimo visível",
      body: "Quando falta unidade, quebre uma dezena e transforme 2 em 12, 3 em 13 e assim por diante.",
    },
    {
      title: "Desça por blocos",
      body: "Fazer 71 - 46 fica leve como 71 - 40, depois -6.",
    },
  ],
  divisao: [
    {
      title: "Divisão pergunta multiplicação",
      body: "72 ÷ 8 é só outra forma de perguntar 8 vezes quanto dá 72.",
    },
    {
      title: "Use fatos âncora",
      body: "Quadrados como 49, 64 e 81 reduzem o tempo de busca mental.",
    },
    {
      title: "Estime antes",
      body: "Tente localizar a família certa primeiro e depois feche o quociente exato.",
    },
  ],
  quadrado: [
    {
      title: "10 + d",
      body: "De 11 a 19, use 100 + 20d + d². Essa forma é bem estável mentalmente.",
    },
    {
      title: "n(n+1) | 25",
      body: "Qualquer número terminado em 5 vira esse padrão. Precisa entrar na ponta da língua.",
    },
    {
      title: "50 + d",
      body: "Para números que começam com 5, use 2500 + 100d + d².",
    },
  ],
  tricks: [
    {
      title: "Primeiro escolha o truque",
      body: "O ganho vem de reconhecer o padrão certo antes de calcular qualquer coisa.",
    },
    {
      title: "Cole pedaços prontos",
      body: "Esses padrões quase sempre geram uma parte da frente e uma parte final.",
    },
    {
      title: "Explique para si mesmo",
      body: "Quando você fala a regra em voz baixa, ela fixa mais rápido do que só responder.",
    },
  ],
};

const PRACTICE_SET = new Set(PRACTICE_SECTION_IDS);

export function getPresets(sectionId) {
  return PRESETS[sectionId] ?? [];
}

export function getPresetById(sectionId, presetId) {
  return getPresets(sectionId).find((preset) => preset.id === presetId) ?? null;
}

export function getDefaultPresetId(sectionId) {
  return getPresets(sectionId)[0]?.id ?? "";
}

export function buildDefaultSelections() {
  return Object.fromEntries(
    PRACTICE_SECTION_IDS.map((sectionId) => [sectionId, getDefaultPresetId(sectionId)]),
  );
}

export function getSectionById(sectionId) {
  return SECTIONS.find((section) => section.id === sectionId) ?? SECTIONS[0];
}

export function isPracticeSection(sectionId) {
  return PRACTICE_SET.has(sectionId);
}

export function getSectionPrimers(sectionId) {
  return SECTION_PRIMERS[sectionId] ?? [];
}

export function getFlashcardDecks() {
  return FLASHCARD_DECKS;
}

export function getFlashcardDeck(deckId) {
  return FLASHCARD_DECKS.find((deck) => deck.id === deckId) ?? FLASHCARD_DECKS[0];
}

export function isTabuadaHighlighted(presetId, row, column) {
  switch (presetId) {
    case "base":
      return row >= 2 && row <= 5 && column >= 2 && column <= 5;
    case "geral":
      return row >= 2 && row <= 9 && column >= 2 && column <= 9;
    case "pesada":
      return row >= 6 && row <= 9 && column >= 6 && column <= 9;
    case "quadrados":
      return row === column && row >= 2 && row <= 9;
    default:
      return false;
  }
}
