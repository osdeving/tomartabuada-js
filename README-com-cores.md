
# Multiplicação por 11

Os 3 casos para 11 * XX

11 * 32 = 3 | 3 + 2 | 2 = 352

11 * 85 = 8 | 13 | 5 = 9 | 3 | 5 = 935

11 * 99 = 9 | 18 | 9 = 10 | 8 | 9 = 1089


Agora para 11 * XXX

11 * 342 = 3 | 3+4 com 4 + 2 | 2 = 3 | 7 com 6 | 2 = 3762

TODO: colocar os casos de overflow e também ver como fica com 4 digítos ou mais


# Quadrado terminando em 5

Números que terminam em 5, o quadrado dele sempre termina com 25 (p.ex: 5*5 = 25), precedido da multiplicação do terceiro dígito pelo seu sucessor:

35 * 35 = |3 * 4|25 = 1225
75 * 75 = |7 * 8|25 = 5625

# Os primeiros são iguais e os últimos somam 10

Por exemplo, em 87 × 83, o 8 é igual nos dois fatores e 7 + 3 = 10.

- ${\color{#0969DA}\mathbf{8}}{\color{#BC4C00}\mathbf{7}}\;\times\;{\color{#0969DA}\mathbf{8}}{\color{#BC4C00}\mathbf{3}}\;=\;{\color{#0969DA}\mathbf{72}}{\color{#BC4C00}\mathbf{21}}$
- ${\color{#0969DA}\mathbf{7}}{\color{#BC4C00}\mathbf{4}}\;\times\;{\color{#0969DA}\mathbf{7}}{\color{#BC4C00}\mathbf{6}}\;=\;{\color{#0969DA}\mathbf{56}}{\color{#BC4C00}\mathbf{24}}$
- ${\color{#0969DA}\mathbf{9}}{\color{#BC4C00}\mathbf{7}}\;\times\;{\color{#0969DA}\mathbf{9}}{\color{#BC4C00}\mathbf{3}}\;=\;{\color{#0969DA}\mathbf{90}}{\color{#BC4C00}\mathbf{21}}$

A cor $\color{#0969DA}{\mathbf{azul}}$ acompanha os primeiros algarismos e o bloco da esquerda: $\color{#0969DA}{\mathbf{8\times9=72}}$. A cor $\color{#BC4C00}{\mathbf{laranja}}$ acompanha as unidades complementares e as duas casas finais: $\color{#BC4C00}{\mathbf{7\times3=21}}$.

## Para memorizar

- ${\color{#0969DA}\mathbf{3}}{\color{#BC4C00}\mathbf{1}}\;\times\;{\color{#0969DA}\mathbf{3}}{\color{#BC4C00}\mathbf{9}}\;=\;{\color{#0969DA}\mathbf{12}}{\color{#BC4C00}\mathbf{09}}$
- ${\color{#0969DA}\mathbf{3}}{\color{#BC4C00}\mathbf{2}}\;\times\;{\color{#0969DA}\mathbf{3}}{\color{#BC4C00}\mathbf{8}}\;=\;{\color{#0969DA}\mathbf{12}}{\color{#BC4C00}\mathbf{16}}$
- ${\color{#0969DA}\mathbf{3}}{\color{#BC4C00}\mathbf{3}}\;\times\;{\color{#0969DA}\mathbf{3}}{\color{#BC4C00}\mathbf{7}}\;=\;{\color{#0969DA}\mathbf{12}}{\color{#BC4C00}\mathbf{21}}$
- ${\color{#0969DA}\mathbf{3}}{\color{#BC4C00}\mathbf{4}}\;\times\;{\color{#0969DA}\mathbf{3}}{\color{#BC4C00}\mathbf{6}}\;=\;{\color{#0969DA}\mathbf{12}}{\color{#BC4C00}\mathbf{24}}$
- ${\color{#0969DA}\mathbf{3}}{\color{#BC4C00}\mathbf{5}}\;\times\;{\color{#0969DA}\mathbf{3}}{\color{#BC4C00}\mathbf{5}}\;=\;{\color{#0969DA}\mathbf{12}}{\color{#BC4C00}\mathbf{25}}$

Isso cobre, por simetria, todos os produtos distintos das unidades que somam 10.

Para o bloco da esquerda:

- $\color{#0969DA}{\mathbf{1}}\;\times\;\color{#0969DA}{\mathbf{2}}\;=\;\color{#0969DA}{\mathbf{2}}$
- $\color{#0969DA}{\mathbf{2}}\;\times\;\color{#0969DA}{\mathbf{3}}\;=\;\color{#0969DA}{\mathbf{6}}$
- $\color{#0969DA}{\mathbf{3}}\;\times\;\color{#0969DA}{\mathbf{4}}\;=\;\color{#0969DA}{\mathbf{12}}$
- $\color{#0969DA}{\mathbf{4}}\;\times\;\color{#0969DA}{\mathbf{5}}\;=\;\color{#0969DA}{\mathbf{20}}$
- $\color{#0969DA}{\mathbf{5}}\;\times\;\color{#0969DA}{\mathbf{6}}\;=\;\color{#0969DA}{\mathbf{30}}$
- $\color{#0969DA}{\mathbf{6}}\;\times\;\color{#0969DA}{\mathbf{7}}\;=\;\color{#0969DA}{\mathbf{42}}$
- $\color{#0969DA}{\mathbf{7}}\;\times\;\color{#0969DA}{\mathbf{8}}\;=\;\color{#0969DA}{\mathbf{56}}$
- $\color{#0969DA}{\mathbf{8}}\;\times\;\color{#0969DA}{\mathbf{9}}\;=\;\color{#0969DA}{\mathbf{72}}$
- $\color{#0969DA}{\mathbf{9}}\;\times\;\color{#0969DA}{\mathbf{10}}\;=\;\color{#0969DA}{\mathbf{90}}$

Então a tabela completa fica assim. O bloco laranja sempre ocupa duas casas; por isso 1 × 9 aparece como 09. As linhas terminadas em zero são o caso especial `a0 × a0 = a² | 00`.

| $\color{#0969DA}{\mathbf{d_{11}}}$ | $\color{#BC4C00}{\mathbf{d_{12}}}$ | × | $\color{#0969DA}{\mathbf{d_{21}}}$ | $\color{#BC4C00}{\mathbf{d_{22}}}$ | = | resultado |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| $\color{#0969DA}{\mathbf{1}}$ | $\color{#BC4C00}{\mathbf{0}}$ | × | $\color{#0969DA}{\mathbf{1}}$ | $\color{#BC4C00}{\mathbf{0}}$ | = | $\color{#0969DA}{\mathbf{1}}\color{#BC4C00}{\mathbf{00}}$ |
| $\color{#0969DA}{\mathbf{1}}$ | $\color{#BC4C00}{\mathbf{1}}$ | × | $\color{#0969DA}{\mathbf{1}}$ | $\color{#BC4C00}{\mathbf{9}}$ | = | $\color{#0969DA}{\mathbf{2}}\color{#BC4C00}{\mathbf{09}}$ |
| $\color{#0969DA}{\mathbf{1}}$ | $\color{#BC4C00}{\mathbf{2}}$ | × | $\color{#0969DA}{\mathbf{1}}$ | $\color{#BC4C00}{\mathbf{8}}$ | = | $\color{#0969DA}{\mathbf{2}}\color{#BC4C00}{\mathbf{16}}$ |
| $\color{#0969DA}{\mathbf{1}}$ | $\color{#BC4C00}{\mathbf{3}}$ | × | $\color{#0969DA}{\mathbf{1}}$ | $\color{#BC4C00}{\mathbf{7}}$ | = | $\color{#0969DA}{\mathbf{2}}\color{#BC4C00}{\mathbf{21}}$ |
| $\color{#0969DA}{\mathbf{1}}$ | $\color{#BC4C00}{\mathbf{4}}$ | × | $\color{#0969DA}{\mathbf{1}}$ | $\color{#BC4C00}{\mathbf{6}}$ | = | $\color{#0969DA}{\mathbf{2}}\color{#BC4C00}{\mathbf{24}}$ |
| $\color{#0969DA}{\mathbf{1}}$ | $\color{#BC4C00}{\mathbf{5}}$ | × | $\color{#0969DA}{\mathbf{1}}$ | $\color{#BC4C00}{\mathbf{5}}$ | = | $\color{#0969DA}{\mathbf{2}}\color{#BC4C00}{\mathbf{25}}$ |
| $\color{#0969DA}{\mathbf{1}}$ | $\color{#BC4C00}{\mathbf{6}}$ | × | $\color{#0969DA}{\mathbf{1}}$ | $\color{#BC4C00}{\mathbf{4}}$ | = | $\color{#0969DA}{\mathbf{2}}\color{#BC4C00}{\mathbf{24}}$ |
| $\color{#0969DA}{\mathbf{1}}$ | $\color{#BC4C00}{\mathbf{7}}$ | × | $\color{#0969DA}{\mathbf{1}}$ | $\color{#BC4C00}{\mathbf{3}}$ | = | $\color{#0969DA}{\mathbf{2}}\color{#BC4C00}{\mathbf{21}}$ |
| $\color{#0969DA}{\mathbf{1}}$ | $\color{#BC4C00}{\mathbf{8}}$ | × | $\color{#0969DA}{\mathbf{1}}$ | $\color{#BC4C00}{\mathbf{2}}$ | = | $\color{#0969DA}{\mathbf{2}}\color{#BC4C00}{\mathbf{16}}$ |
| $\color{#0969DA}{\mathbf{1}}$ | $\color{#BC4C00}{\mathbf{9}}$ | × | $\color{#0969DA}{\mathbf{1}}$ | $\color{#BC4C00}{\mathbf{1}}$ | = | $\color{#0969DA}{\mathbf{2}}\color{#BC4C00}{\mathbf{09}}$ |
| $\color{#0969DA}{\mathbf{2}}$ | $\color{#BC4C00}{\mathbf{0}}$ | × | $\color{#0969DA}{\mathbf{2}}$ | $\color{#BC4C00}{\mathbf{0}}$ | = | $\color{#0969DA}{\mathbf{4}}\color{#BC4C00}{\mathbf{00}}$ |
| $\color{#0969DA}{\mathbf{2}}$ | $\color{#BC4C00}{\mathbf{1}}$ | × | $\color{#0969DA}{\mathbf{2}}$ | $\color{#BC4C00}{\mathbf{9}}$ | = | $\color{#0969DA}{\mathbf{6}}\color{#BC4C00}{\mathbf{09}}$ |
| $\color{#0969DA}{\mathbf{2}}$ | $\color{#BC4C00}{\mathbf{2}}$ | × | $\color{#0969DA}{\mathbf{2}}$ | $\color{#BC4C00}{\mathbf{8}}$ | = | $\color{#0969DA}{\mathbf{6}}\color{#BC4C00}{\mathbf{16}}$ |
| $\color{#0969DA}{\mathbf{2}}$ | $\color{#BC4C00}{\mathbf{3}}$ | × | $\color{#0969DA}{\mathbf{2}}$ | $\color{#BC4C00}{\mathbf{7}}$ | = | $\color{#0969DA}{\mathbf{6}}\color{#BC4C00}{\mathbf{21}}$ |
| $\color{#0969DA}{\mathbf{2}}$ | $\color{#BC4C00}{\mathbf{4}}$ | × | $\color{#0969DA}{\mathbf{2}}$ | $\color{#BC4C00}{\mathbf{6}}$ | = | $\color{#0969DA}{\mathbf{6}}\color{#BC4C00}{\mathbf{24}}$ |
| $\color{#0969DA}{\mathbf{2}}$ | $\color{#BC4C00}{\mathbf{5}}$ | × | $\color{#0969DA}{\mathbf{2}}$ | $\color{#BC4C00}{\mathbf{5}}$ | = | $\color{#0969DA}{\mathbf{6}}\color{#BC4C00}{\mathbf{25}}$ |
| $\color{#0969DA}{\mathbf{2}}$ | $\color{#BC4C00}{\mathbf{6}}$ | × | $\color{#0969DA}{\mathbf{2}}$ | $\color{#BC4C00}{\mathbf{4}}$ | = | $\color{#0969DA}{\mathbf{6}}\color{#BC4C00}{\mathbf{24}}$ |
| $\color{#0969DA}{\mathbf{2}}$ | $\color{#BC4C00}{\mathbf{7}}$ | × | $\color{#0969DA}{\mathbf{2}}$ | $\color{#BC4C00}{\mathbf{3}}$ | = | $\color{#0969DA}{\mathbf{6}}\color{#BC4C00}{\mathbf{21}}$ |
| $\color{#0969DA}{\mathbf{2}}$ | $\color{#BC4C00}{\mathbf{8}}$ | × | $\color{#0969DA}{\mathbf{2}}$ | $\color{#BC4C00}{\mathbf{2}}$ | = | $\color{#0969DA}{\mathbf{6}}\color{#BC4C00}{\mathbf{16}}$ |
| $\color{#0969DA}{\mathbf{2}}$ | $\color{#BC4C00}{\mathbf{9}}$ | × | $\color{#0969DA}{\mathbf{2}}$ | $\color{#BC4C00}{\mathbf{1}}$ | = | $\color{#0969DA}{\mathbf{6}}\color{#BC4C00}{\mathbf{09}}$ |
| $\color{#0969DA}{\mathbf{3}}$ | $\color{#BC4C00}{\mathbf{0}}$ | × | $\color{#0969DA}{\mathbf{3}}$ | $\color{#BC4C00}{\mathbf{0}}$ | = | $\color{#0969DA}{\mathbf{9}}\color{#BC4C00}{\mathbf{00}}$ |
| $\color{#0969DA}{\mathbf{3}}$ | $\color{#BC4C00}{\mathbf{1}}$ | × | $\color{#0969DA}{\mathbf{3}}$ | $\color{#BC4C00}{\mathbf{9}}$ | = | $\color{#0969DA}{\mathbf{12}}\color{#BC4C00}{\mathbf{09}}$ |
| $\color{#0969DA}{\mathbf{3}}$ | $\color{#BC4C00}{\mathbf{2}}$ | × | $\color{#0969DA}{\mathbf{3}}$ | $\color{#BC4C00}{\mathbf{8}}$ | = | $\color{#0969DA}{\mathbf{12}}\color{#BC4C00}{\mathbf{16}}$ |
| $\color{#0969DA}{\mathbf{3}}$ | $\color{#BC4C00}{\mathbf{3}}$ | × | $\color{#0969DA}{\mathbf{3}}$ | $\color{#BC4C00}{\mathbf{7}}$ | = | $\color{#0969DA}{\mathbf{12}}\color{#BC4C00}{\mathbf{21}}$ |
| $\color{#0969DA}{\mathbf{3}}$ | $\color{#BC4C00}{\mathbf{4}}$ | × | $\color{#0969DA}{\mathbf{3}}$ | $\color{#BC4C00}{\mathbf{6}}$ | = | $\color{#0969DA}{\mathbf{12}}\color{#BC4C00}{\mathbf{24}}$ |
| $\color{#0969DA}{\mathbf{3}}$ | $\color{#BC4C00}{\mathbf{5}}$ | × | $\color{#0969DA}{\mathbf{3}}$ | $\color{#BC4C00}{\mathbf{5}}$ | = | $\color{#0969DA}{\mathbf{12}}\color{#BC4C00}{\mathbf{25}}$ |
| $\color{#0969DA}{\mathbf{3}}$ | $\color{#BC4C00}{\mathbf{6}}$ | × | $\color{#0969DA}{\mathbf{3}}$ | $\color{#BC4C00}{\mathbf{4}}$ | = | $\color{#0969DA}{\mathbf{12}}\color{#BC4C00}{\mathbf{24}}$ |
| $\color{#0969DA}{\mathbf{3}}$ | $\color{#BC4C00}{\mathbf{7}}$ | × | $\color{#0969DA}{\mathbf{3}}$ | $\color{#BC4C00}{\mathbf{3}}$ | = | $\color{#0969DA}{\mathbf{12}}\color{#BC4C00}{\mathbf{21}}$ |
| $\color{#0969DA}{\mathbf{3}}$ | $\color{#BC4C00}{\mathbf{8}}$ | × | $\color{#0969DA}{\mathbf{3}}$ | $\color{#BC4C00}{\mathbf{2}}$ | = | $\color{#0969DA}{\mathbf{12}}\color{#BC4C00}{\mathbf{16}}$ |
| $\color{#0969DA}{\mathbf{3}}$ | $\color{#BC4C00}{\mathbf{9}}$ | × | $\color{#0969DA}{\mathbf{3}}$ | $\color{#BC4C00}{\mathbf{1}}$ | = | $\color{#0969DA}{\mathbf{12}}\color{#BC4C00}{\mathbf{09}}$ |
| $\color{#0969DA}{\mathbf{4}}$ | $\color{#BC4C00}{\mathbf{0}}$ | × | $\color{#0969DA}{\mathbf{4}}$ | $\color{#BC4C00}{\mathbf{0}}$ | = | $\color{#0969DA}{\mathbf{16}}\color{#BC4C00}{\mathbf{00}}$ |
| $\color{#0969DA}{\mathbf{4}}$ | $\color{#BC4C00}{\mathbf{1}}$ | × | $\color{#0969DA}{\mathbf{4}}$ | $\color{#BC4C00}{\mathbf{9}}$ | = | $\color{#0969DA}{\mathbf{20}}\color{#BC4C00}{\mathbf{09}}$ |
| $\color{#0969DA}{\mathbf{4}}$ | $\color{#BC4C00}{\mathbf{2}}$ | × | $\color{#0969DA}{\mathbf{4}}$ | $\color{#BC4C00}{\mathbf{8}}$ | = | $\color{#0969DA}{\mathbf{20}}\color{#BC4C00}{\mathbf{16}}$ |
| $\color{#0969DA}{\mathbf{4}}$ | $\color{#BC4C00}{\mathbf{3}}$ | × | $\color{#0969DA}{\mathbf{4}}$ | $\color{#BC4C00}{\mathbf{7}}$ | = | $\color{#0969DA}{\mathbf{20}}\color{#BC4C00}{\mathbf{21}}$ |
| $\color{#0969DA}{\mathbf{4}}$ | $\color{#BC4C00}{\mathbf{4}}$ | × | $\color{#0969DA}{\mathbf{4}}$ | $\color{#BC4C00}{\mathbf{6}}$ | = | $\color{#0969DA}{\mathbf{20}}\color{#BC4C00}{\mathbf{24}}$ |
| $\color{#0969DA}{\mathbf{4}}$ | $\color{#BC4C00}{\mathbf{5}}$ | × | $\color{#0969DA}{\mathbf{4}}$ | $\color{#BC4C00}{\mathbf{5}}$ | = | $\color{#0969DA}{\mathbf{20}}\color{#BC4C00}{\mathbf{25}}$ |
| $\color{#0969DA}{\mathbf{4}}$ | $\color{#BC4C00}{\mathbf{6}}$ | × | $\color{#0969DA}{\mathbf{4}}$ | $\color{#BC4C00}{\mathbf{4}}$ | = | $\color{#0969DA}{\mathbf{20}}\color{#BC4C00}{\mathbf{24}}$ |
| $\color{#0969DA}{\mathbf{4}}$ | $\color{#BC4C00}{\mathbf{7}}$ | × | $\color{#0969DA}{\mathbf{4}}$ | $\color{#BC4C00}{\mathbf{3}}$ | = | $\color{#0969DA}{\mathbf{20}}\color{#BC4C00}{\mathbf{21}}$ |
| $\color{#0969DA}{\mathbf{4}}$ | $\color{#BC4C00}{\mathbf{8}}$ | × | $\color{#0969DA}{\mathbf{4}}$ | $\color{#BC4C00}{\mathbf{2}}$ | = | $\color{#0969DA}{\mathbf{20}}\color{#BC4C00}{\mathbf{16}}$ |
| $\color{#0969DA}{\mathbf{4}}$ | $\color{#BC4C00}{\mathbf{9}}$ | × | $\color{#0969DA}{\mathbf{4}}$ | $\color{#BC4C00}{\mathbf{1}}$ | = | $\color{#0969DA}{\mathbf{20}}\color{#BC4C00}{\mathbf{09}}$ |
| $\color{#0969DA}{\mathbf{5}}$ | $\color{#BC4C00}{\mathbf{0}}$ | × | $\color{#0969DA}{\mathbf{5}}$ | $\color{#BC4C00}{\mathbf{0}}$ | = | $\color{#0969DA}{\mathbf{25}}\color{#BC4C00}{\mathbf{00}}$ |
| $\color{#0969DA}{\mathbf{5}}$ | $\color{#BC4C00}{\mathbf{1}}$ | × | $\color{#0969DA}{\mathbf{5}}$ | $\color{#BC4C00}{\mathbf{9}}$ | = | $\color{#0969DA}{\mathbf{30}}\color{#BC4C00}{\mathbf{09}}$ |
| $\color{#0969DA}{\mathbf{5}}$ | $\color{#BC4C00}{\mathbf{2}}$ | × | $\color{#0969DA}{\mathbf{5}}$ | $\color{#BC4C00}{\mathbf{8}}$ | = | $\color{#0969DA}{\mathbf{30}}\color{#BC4C00}{\mathbf{16}}$ |
| $\color{#0969DA}{\mathbf{5}}$ | $\color{#BC4C00}{\mathbf{3}}$ | × | $\color{#0969DA}{\mathbf{5}}$ | $\color{#BC4C00}{\mathbf{7}}$ | = | $\color{#0969DA}{\mathbf{30}}\color{#BC4C00}{\mathbf{21}}$ |
| $\color{#0969DA}{\mathbf{5}}$ | $\color{#BC4C00}{\mathbf{4}}$ | × | $\color{#0969DA}{\mathbf{5}}$ | $\color{#BC4C00}{\mathbf{6}}$ | = | $\color{#0969DA}{\mathbf{30}}\color{#BC4C00}{\mathbf{24}}$ |
| $\color{#0969DA}{\mathbf{5}}$ | $\color{#BC4C00}{\mathbf{5}}$ | × | $\color{#0969DA}{\mathbf{5}}$ | $\color{#BC4C00}{\mathbf{5}}$ | = | $\color{#0969DA}{\mathbf{30}}\color{#BC4C00}{\mathbf{25}}$ |
| $\color{#0969DA}{\mathbf{5}}$ | $\color{#BC4C00}{\mathbf{6}}$ | × | $\color{#0969DA}{\mathbf{5}}$ | $\color{#BC4C00}{\mathbf{4}}$ | = | $\color{#0969DA}{\mathbf{30}}\color{#BC4C00}{\mathbf{24}}$ |
| $\color{#0969DA}{\mathbf{5}}$ | $\color{#BC4C00}{\mathbf{7}}$ | × | $\color{#0969DA}{\mathbf{5}}$ | $\color{#BC4C00}{\mathbf{3}}$ | = | $\color{#0969DA}{\mathbf{30}}\color{#BC4C00}{\mathbf{21}}$ |
| $\color{#0969DA}{\mathbf{5}}$ | $\color{#BC4C00}{\mathbf{8}}$ | × | $\color{#0969DA}{\mathbf{5}}$ | $\color{#BC4C00}{\mathbf{2}}$ | = | $\color{#0969DA}{\mathbf{30}}\color{#BC4C00}{\mathbf{16}}$ |
| $\color{#0969DA}{\mathbf{5}}$ | $\color{#BC4C00}{\mathbf{9}}$ | × | $\color{#0969DA}{\mathbf{5}}$ | $\color{#BC4C00}{\mathbf{1}}$ | = | $\color{#0969DA}{\mathbf{30}}\color{#BC4C00}{\mathbf{09}}$ |
| $\color{#0969DA}{\mathbf{6}}$ | $\color{#BC4C00}{\mathbf{0}}$ | × | $\color{#0969DA}{\mathbf{6}}$ | $\color{#BC4C00}{\mathbf{0}}$ | = | $\color{#0969DA}{\mathbf{36}}\color{#BC4C00}{\mathbf{00}}$ |
| $\color{#0969DA}{\mathbf{6}}$ | $\color{#BC4C00}{\mathbf{1}}$ | × | $\color{#0969DA}{\mathbf{6}}$ | $\color{#BC4C00}{\mathbf{9}}$ | = | $\color{#0969DA}{\mathbf{42}}\color{#BC4C00}{\mathbf{09}}$ |
| $\color{#0969DA}{\mathbf{6}}$ | $\color{#BC4C00}{\mathbf{2}}$ | × | $\color{#0969DA}{\mathbf{6}}$ | $\color{#BC4C00}{\mathbf{8}}$ | = | $\color{#0969DA}{\mathbf{42}}\color{#BC4C00}{\mathbf{16}}$ |
| $\color{#0969DA}{\mathbf{6}}$ | $\color{#BC4C00}{\mathbf{3}}$ | × | $\color{#0969DA}{\mathbf{6}}$ | $\color{#BC4C00}{\mathbf{7}}$ | = | $\color{#0969DA}{\mathbf{42}}\color{#BC4C00}{\mathbf{21}}$ |
| $\color{#0969DA}{\mathbf{6}}$ | $\color{#BC4C00}{\mathbf{4}}$ | × | $\color{#0969DA}{\mathbf{6}}$ | $\color{#BC4C00}{\mathbf{6}}$ | = | $\color{#0969DA}{\mathbf{42}}\color{#BC4C00}{\mathbf{24}}$ |
| $\color{#0969DA}{\mathbf{6}}$ | $\color{#BC4C00}{\mathbf{5}}$ | × | $\color{#0969DA}{\mathbf{6}}$ | $\color{#BC4C00}{\mathbf{5}}$ | = | $\color{#0969DA}{\mathbf{42}}\color{#BC4C00}{\mathbf{25}}$ |
| $\color{#0969DA}{\mathbf{6}}$ | $\color{#BC4C00}{\mathbf{6}}$ | × | $\color{#0969DA}{\mathbf{6}}$ | $\color{#BC4C00}{\mathbf{4}}$ | = | $\color{#0969DA}{\mathbf{42}}\color{#BC4C00}{\mathbf{24}}$ |
| $\color{#0969DA}{\mathbf{6}}$ | $\color{#BC4C00}{\mathbf{7}}$ | × | $\color{#0969DA}{\mathbf{6}}$ | $\color{#BC4C00}{\mathbf{3}}$ | = | $\color{#0969DA}{\mathbf{42}}\color{#BC4C00}{\mathbf{21}}$ |
| $\color{#0969DA}{\mathbf{6}}$ | $\color{#BC4C00}{\mathbf{8}}$ | × | $\color{#0969DA}{\mathbf{6}}$ | $\color{#BC4C00}{\mathbf{2}}$ | = | $\color{#0969DA}{\mathbf{42}}\color{#BC4C00}{\mathbf{16}}$ |
| $\color{#0969DA}{\mathbf{6}}$ | $\color{#BC4C00}{\mathbf{9}}$ | × | $\color{#0969DA}{\mathbf{6}}$ | $\color{#BC4C00}{\mathbf{1}}$ | = | $\color{#0969DA}{\mathbf{42}}\color{#BC4C00}{\mathbf{09}}$ |
| $\color{#0969DA}{\mathbf{7}}$ | $\color{#BC4C00}{\mathbf{0}}$ | × | $\color{#0969DA}{\mathbf{7}}$ | $\color{#BC4C00}{\mathbf{0}}$ | = | $\color{#0969DA}{\mathbf{49}}\color{#BC4C00}{\mathbf{00}}$ |
| $\color{#0969DA}{\mathbf{7}}$ | $\color{#BC4C00}{\mathbf{1}}$ | × | $\color{#0969DA}{\mathbf{7}}$ | $\color{#BC4C00}{\mathbf{9}}$ | = | $\color{#0969DA}{\mathbf{56}}\color{#BC4C00}{\mathbf{09}}$ |
| $\color{#0969DA}{\mathbf{7}}$ | $\color{#BC4C00}{\mathbf{2}}$ | × | $\color{#0969DA}{\mathbf{7}}$ | $\color{#BC4C00}{\mathbf{8}}$ | = | $\color{#0969DA}{\mathbf{56}}\color{#BC4C00}{\mathbf{16}}$ |
| $\color{#0969DA}{\mathbf{7}}$ | $\color{#BC4C00}{\mathbf{3}}$ | × | $\color{#0969DA}{\mathbf{7}}$ | $\color{#BC4C00}{\mathbf{7}}$ | = | $\color{#0969DA}{\mathbf{56}}\color{#BC4C00}{\mathbf{21}}$ |
| $\color{#0969DA}{\mathbf{7}}$ | $\color{#BC4C00}{\mathbf{4}}$ | × | $\color{#0969DA}{\mathbf{7}}$ | $\color{#BC4C00}{\mathbf{6}}$ | = | $\color{#0969DA}{\mathbf{56}}\color{#BC4C00}{\mathbf{24}}$ |
| $\color{#0969DA}{\mathbf{7}}$ | $\color{#BC4C00}{\mathbf{5}}$ | × | $\color{#0969DA}{\mathbf{7}}$ | $\color{#BC4C00}{\mathbf{5}}$ | = | $\color{#0969DA}{\mathbf{56}}\color{#BC4C00}{\mathbf{25}}$ |
| $\color{#0969DA}{\mathbf{7}}$ | $\color{#BC4C00}{\mathbf{6}}$ | × | $\color{#0969DA}{\mathbf{7}}$ | $\color{#BC4C00}{\mathbf{4}}$ | = | $\color{#0969DA}{\mathbf{56}}\color{#BC4C00}{\mathbf{24}}$ |
| $\color{#0969DA}{\mathbf{7}}$ | $\color{#BC4C00}{\mathbf{7}}$ | × | $\color{#0969DA}{\mathbf{7}}$ | $\color{#BC4C00}{\mathbf{3}}$ | = | $\color{#0969DA}{\mathbf{56}}\color{#BC4C00}{\mathbf{21}}$ |
| $\color{#0969DA}{\mathbf{7}}$ | $\color{#BC4C00}{\mathbf{8}}$ | × | $\color{#0969DA}{\mathbf{7}}$ | $\color{#BC4C00}{\mathbf{2}}$ | = | $\color{#0969DA}{\mathbf{56}}\color{#BC4C00}{\mathbf{16}}$ |
| $\color{#0969DA}{\mathbf{7}}$ | $\color{#BC4C00}{\mathbf{9}}$ | × | $\color{#0969DA}{\mathbf{7}}$ | $\color{#BC4C00}{\mathbf{1}}$ | = | $\color{#0969DA}{\mathbf{56}}\color{#BC4C00}{\mathbf{09}}$ |
| $\color{#0969DA}{\mathbf{8}}$ | $\color{#BC4C00}{\mathbf{0}}$ | × | $\color{#0969DA}{\mathbf{8}}$ | $\color{#BC4C00}{\mathbf{0}}$ | = | $\color{#0969DA}{\mathbf{64}}\color{#BC4C00}{\mathbf{00}}$ |
| $\color{#0969DA}{\mathbf{8}}$ | $\color{#BC4C00}{\mathbf{1}}$ | × | $\color{#0969DA}{\mathbf{8}}$ | $\color{#BC4C00}{\mathbf{9}}$ | = | $\color{#0969DA}{\mathbf{72}}\color{#BC4C00}{\mathbf{09}}$ |
| $\color{#0969DA}{\mathbf{8}}$ | $\color{#BC4C00}{\mathbf{2}}$ | × | $\color{#0969DA}{\mathbf{8}}$ | $\color{#BC4C00}{\mathbf{8}}$ | = | $\color{#0969DA}{\mathbf{72}}\color{#BC4C00}{\mathbf{16}}$ |
| $\color{#0969DA}{\mathbf{8}}$ | $\color{#BC4C00}{\mathbf{3}}$ | × | $\color{#0969DA}{\mathbf{8}}$ | $\color{#BC4C00}{\mathbf{7}}$ | = | $\color{#0969DA}{\mathbf{72}}\color{#BC4C00}{\mathbf{21}}$ |
| $\color{#0969DA}{\mathbf{8}}$ | $\color{#BC4C00}{\mathbf{4}}$ | × | $\color{#0969DA}{\mathbf{8}}$ | $\color{#BC4C00}{\mathbf{6}}$ | = | $\color{#0969DA}{\mathbf{72}}\color{#BC4C00}{\mathbf{24}}$ |
| $\color{#0969DA}{\mathbf{8}}$ | $\color{#BC4C00}{\mathbf{5}}$ | × | $\color{#0969DA}{\mathbf{8}}$ | $\color{#BC4C00}{\mathbf{5}}$ | = | $\color{#0969DA}{\mathbf{72}}\color{#BC4C00}{\mathbf{25}}$ |
| $\color{#0969DA}{\mathbf{8}}$ | $\color{#BC4C00}{\mathbf{6}}$ | × | $\color{#0969DA}{\mathbf{8}}$ | $\color{#BC4C00}{\mathbf{4}}$ | = | $\color{#0969DA}{\mathbf{72}}\color{#BC4C00}{\mathbf{24}}$ |
| $\color{#0969DA}{\mathbf{8}}$ | $\color{#BC4C00}{\mathbf{7}}$ | × | $\color{#0969DA}{\mathbf{8}}$ | $\color{#BC4C00}{\mathbf{3}}$ | = | $\color{#0969DA}{\mathbf{72}}\color{#BC4C00}{\mathbf{21}}$ |
| $\color{#0969DA}{\mathbf{8}}$ | $\color{#BC4C00}{\mathbf{8}}$ | × | $\color{#0969DA}{\mathbf{8}}$ | $\color{#BC4C00}{\mathbf{2}}$ | = | $\color{#0969DA}{\mathbf{72}}\color{#BC4C00}{\mathbf{16}}$ |
| $\color{#0969DA}{\mathbf{8}}$ | $\color{#BC4C00}{\mathbf{9}}$ | × | $\color{#0969DA}{\mathbf{8}}$ | $\color{#BC4C00}{\mathbf{1}}$ | = | $\color{#0969DA}{\mathbf{72}}\color{#BC4C00}{\mathbf{09}}$ |
| $\color{#0969DA}{\mathbf{9}}$ | $\color{#BC4C00}{\mathbf{0}}$ | × | $\color{#0969DA}{\mathbf{9}}$ | $\color{#BC4C00}{\mathbf{0}}$ | = | $\color{#0969DA}{\mathbf{81}}\color{#BC4C00}{\mathbf{00}}$ |
| $\color{#0969DA}{\mathbf{9}}$ | $\color{#BC4C00}{\mathbf{1}}$ | × | $\color{#0969DA}{\mathbf{9}}$ | $\color{#BC4C00}{\mathbf{9}}$ | = | $\color{#0969DA}{\mathbf{90}}\color{#BC4C00}{\mathbf{09}}$ |
| $\color{#0969DA}{\mathbf{9}}$ | $\color{#BC4C00}{\mathbf{2}}$ | × | $\color{#0969DA}{\mathbf{9}}$ | $\color{#BC4C00}{\mathbf{8}}$ | = | $\color{#0969DA}{\mathbf{90}}\color{#BC4C00}{\mathbf{16}}$ |
| $\color{#0969DA}{\mathbf{9}}$ | $\color{#BC4C00}{\mathbf{3}}$ | × | $\color{#0969DA}{\mathbf{9}}$ | $\color{#BC4C00}{\mathbf{7}}$ | = | $\color{#0969DA}{\mathbf{90}}\color{#BC4C00}{\mathbf{21}}$ |
| $\color{#0969DA}{\mathbf{9}}$ | $\color{#BC4C00}{\mathbf{4}}$ | × | $\color{#0969DA}{\mathbf{9}}$ | $\color{#BC4C00}{\mathbf{6}}$ | = | $\color{#0969DA}{\mathbf{90}}\color{#BC4C00}{\mathbf{24}}$ |
| $\color{#0969DA}{\mathbf{9}}$ | $\color{#BC4C00}{\mathbf{5}}$ | × | $\color{#0969DA}{\mathbf{9}}$ | $\color{#BC4C00}{\mathbf{5}}$ | = | $\color{#0969DA}{\mathbf{90}}\color{#BC4C00}{\mathbf{25}}$ |
| $\color{#0969DA}{\mathbf{9}}$ | $\color{#BC4C00}{\mathbf{6}}$ | × | $\color{#0969DA}{\mathbf{9}}$ | $\color{#BC4C00}{\mathbf{4}}$ | = | $\color{#0969DA}{\mathbf{90}}\color{#BC4C00}{\mathbf{24}}$ |
| $\color{#0969DA}{\mathbf{9}}$ | $\color{#BC4C00}{\mathbf{7}}$ | × | $\color{#0969DA}{\mathbf{9}}$ | $\color{#BC4C00}{\mathbf{3}}$ | = | $\color{#0969DA}{\mathbf{90}}\color{#BC4C00}{\mathbf{21}}$ |
| $\color{#0969DA}{\mathbf{9}}$ | $\color{#BC4C00}{\mathbf{8}}$ | × | $\color{#0969DA}{\mathbf{9}}$ | $\color{#BC4C00}{\mathbf{2}}$ | = | $\color{#0969DA}{\mathbf{90}}\color{#BC4C00}{\mathbf{16}}$ |
| $\color{#0969DA}{\mathbf{9}}$ | $\color{#BC4C00}{\mathbf{9}}$ | × | $\color{#0969DA}{\mathbf{9}}$ | $\color{#BC4C00}{\mathbf{1}}$ | = | $\color{#0969DA}{\mathbf{90}}\color{#BC4C00}{\mathbf{09}}$ |
