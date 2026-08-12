# Motor adaptativo local

O módulo é independente de React e trabalha apenas com objetos serializáveis em JSON. A
entrada pública fica em `./index.js`; isso permite manter a interface atual e integrar o
motor gradualmente.

## Fluxo mínimo de sessão

```js
import {
  createPracticeSession,
  recordSessionAttempt,
  finishPracticeSession,
} from "./lib/adaptive";

let session = createPracticeSession({
  mode: "sparring", // sparring | campaign | survival
  groupIds: ["adicao"],
  difficulty: 3,
});

const result = recordSessionAttempt(session, {
  questionId: question.id,
  sectionId: question.sectionId,
  groupId: question.sectionId,
  presetId: question.presetId,
  skillKey: question.skillKey,
  patternKey: question.presetId,
  theoryTopicId: question.theoryTopicId,
  correct: isCorrect,
  responseTimeMs,
  responseWindowMs: question.responseWindowMs,
  difficulty: session.currentDifficulty,
  source: question.source, // book | generated | catalog
});

session = result.session;
// result.event contém pontuação, combo, adaptação e mensagens para a interface.

const { report, records } = finishPracticeSession(session, {
  previousSessions,
  theoryIndex,
});
```

`recordSessionAttempt` é imutável: ele devolve uma nova sessão. Resposta após o limite,
revelação ou pulo não mantêm combo nem contam como sucesso de campanha/sobrevivência.

## Contratos JSON

Uma tentativa aceita o histórico legado (`correct`, `responseTime`) e o contrato rico:

```json
{
  "id": "attempt-1",
  "sessionId": "session-1",
  "timestamp": 1900000000000,
  "mode": "sparring",
  "questionId": "q-1",
  "sectionId": "adicao",
  "groupId": "adicao",
  "presetId": "passa-10",
  "skillKey": "add:7:8",
  "patternKey": "passa-10",
  "patternTags": ["complemento", "vai-um"],
  "theoryTopicId": "fecha-dez",
  "source": "book",
  "sourceId": "pdf-capitulo-2-exemplo-4",
  "difficulty": 3,
  "correct": true,
  "timedOut": false,
  "responseTimeMs": 2400,
  "responseWindowMs": 5000,
  "hintsUsed": 0,
  "revealed": false,
  "skipped": false,
  "answerGiven": 15,
  "expectedAnswer": 15
}
```

Um desafio oferecido a `selectNextChallenge` precisa apenas de `id`/`skillKey`; para uma
seleção melhor, use `groupId`, `patternKey`, `difficulty`, `source`, `theoryTopicId` e
`responseWindowMs`. O retorno contém `challenge`, `plan` e `ranked` com pesos e motivos.

A teoria pode vir de JSON no formato:

```json
[
  {
    "id": "fecha-dez",
    "title": "Feche 10 primeiro",
    "patternKeys": ["passa-10", "vai-um"],
    "sectionIds": ["adicao"],
    "skillPrefixes": ["add:"]
  }
]
```

A campanha também é data-driven: `{ id, title, stages }`, onde cada estágio contém
`id`, `title`, `groupIds`, `difficulty`, `targetCorrect`, `minimumAttempts` e
`minimumAccuracy`.

## Persistência e relatórios

```js
const repository = createSessionRepository();
const { revision } = repository.saveSession(session);
const sessions = repository.listSessions({ groupId: "adicao" });
const report = repository.getReport({ theoryIndex });
```

O envelope persistido contém `schemaVersion`, `revision`, `updatedAt`, `sessions` e
`metadata`. `revision` permite controle otimista de concorrência. `exportJson` e
`importJson` tornam a mesma estrutura utilizável por um backend futuro.

Os relatórios expõem visão geral, tendência, grupos, habilidades, padrões de erro,
recomendações de teoria, fadiga, recordes pessoais e sessões recentes. As métricas de
tempo usam média, mediana e percentil 90; `paceRatio` normaliza o tempo pela janela de
cada questão.
