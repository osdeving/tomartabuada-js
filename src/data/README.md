# Conteúdo didático

A biblioteca de teoria é composta apenas por dados JSON. Nenhum texto de aula fica preso aos componentes React.

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

Os arquivos detalhados são ligados ao capítulo-base por `capituloId`. Depois de editar um JSON, execute `npm run check`; o teste de conteúdo verifica os IDs, a ordem, os algoritmos, os exemplos e a rastreabilidade das páginas.
