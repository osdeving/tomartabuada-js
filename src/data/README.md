# Conteúdo didático

A biblioteca de teoria é composta apenas por dados JSON. Nenhum texto de aula fica preso aos componentes React.

## Fontes e progressão

O conteúdo aparece em duas trilhas, sem misturar a numeração das fontes:

- `full-book-theory-00-03.json`, `full-book-theory-04-06.json` e `full-book-theory-07-09.json`: trilha principal, baseada no livro completo *Secrets of Mental Math* (Three Rivers Press, 2006). Os capítulos mantêm a ordem 0–9 do livro.
- `mental-math-theory.json` e os três arquivos `theory-details-*`: técnicas complementares do *Course Guidebook* (2011), preservadas porque incluem assuntos que não estão no livro completo.

Os 45 IDs de tópico do currículo complementar continuam canônicos para adaptação, campanha e relatórios. Cada aula do livro completo declara `theoryTopicIds` para se ligar a esses padrões sem converter o capítulo 0–9 em uma fase 1–12 por engano.

O arquivo fornecido possui uma falha de paginação: normalmente a página PDF é a impressa + 26, mas a PDF 83 repete a página impressa 216 e a impressa 58 está ausente. Os dados citam ambas as paginações e não reconstroem a página faltante.

## Arquivos

- `mental-math-theory.json`: estrutura dos 12 capítulos, pré-requisitos, padrões e exemplos rápidos.
- `theory-details-01-04.json`: aulas detalhadas dos capítulos 1 a 4.
- `theory-details-05-08.json`: aulas detalhadas dos capítulos 5 a 8.
- `theory-details-09-12.json`: aulas detalhadas dos capítulos 9 a 12.
- `theory-topic-lessons.json`: liga cada padrão diagnosticado à dica detalhada que deve abrir primeiro.
- `mental-math-challenges.json`: exercícios do material e respectivos contratos de resposta.

Cada item de `dicas` deve informar:

- contexto (`resumo`, `quandoUsar` e `porQueFunciona`);
- um algoritmo com passos ordenados;
- exemplos resolvidos com etapas comentadas;
- armadilhas e um lembrete curto;
- tags e páginas da fonte.

Os arquivos detalhados do guia são ligados ao capítulo-base por `capituloId`. As aulas do livro completo usam `source.documentId`, páginas impressas/PDF e um ou mais `theoryTopicIds` existentes.

## Contas armadas

Um exemplo pode incluir `visualizacao`. O campo é uma união discriminada por `tipo`:

- `conta-armada`: linhas alinhadas, operadores, regras e parciais;
- `cadeia`: transformação horizontal em etapas;
- `divisao-longa`: divisor, dividendo, quociente e subtrações sucessivas;
- `raiz-armada`: radical, pares de dígitos e tentativas;
- `criss-cross`: linhas de dígitos e conexões por etapa;
- `quadrado-balanceado`: fatores simétricos, produto principal e correção.

Todos os tipos informam `rotulo`, `leitura` e `passos`. O componente React monta a conta com texto, CSS Grid e conectores SVG; o JSON descreve significado e ordem, não coordenadas de tela.

Depois de editar qualquer JSON, execute `npm run check`. Os testes verificam IDs, progressão, algoritmos, vínculos adaptativos, visualizações e rastreabilidade das páginas.
