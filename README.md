# Rally 2D — como construir este jogo do zero

Um rali visto de cima: o cursor (ou o dedo, no celular) é a **mira**, a Pista é gerada por uma
**Semente**, e o que se disputa é o **Tempo**.

Este arquivo é um roteiro de aprendizado, não a documentação do código pronto. Ele é feito de
passos: cada um constrói uma coisa jogável, diz **por que** ela é assim, e termina com *o que você
tem de ver na tela* antes de seguir. Se um passo não fecha, não adianta ir para o seguinte — os
próximos assumem que o anterior funciona.

Três arquivos são o mapa do território, e vale abri-los junto:

- `CONTEXT.md` — o glossário do domínio (Etapa, Pista, Mira, Batida…). As palavras em **negrito**
  aqui vêm de lá, e no código elas aparecem com o mesmo nome.
- `docs/adr/` — as decisões que já foram tomadas e o porquê. Cinco decisões, cinco arquivos.
- `docs/estilo.md` — os números da arte, para tudo que for gerado sair parecendo o mesmo jogo.

---

## Passo 0 — O esqueleto

Vite + TypeScript, sem framework. O jogo inteiro é um `<canvas>` em tela cheia e um `<div>` de UI
por cima dele.

```bash
npm create vite@latest rally2d -- --template vanilla-ts
cd rally2d && npm install
```

Uma decisão que parece detalhe e não é: **um pixel de canvas é um pixel de CSS**. Nada de
`devicePixelRatio`. Com ele no meio, a quantidade de Pista visível — e portanto a dificuldade —
mudaria conforme a tela do jogador.

```ts
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
```

Monte o laço de quadros já com o `dt` limitado: `Math.min((now - last) / 1000, 1 / 30)`. Sem esse
teto, uma aba em segundo plano volta com um `dt` gigante, o Carro atravessa a Borda inteira num
quadro só e a **Batida** nunca é detectada.

**Na tela:** um retângulo colorido que ocupa a janela e não muda de tamanho quando você redimensiona
o navegador para uma proporção estranha.

---

## Passo 1 — O Carro, e o controle que define o jogo

Antes de qualquer pista, resolva o controle — é ele que decide se o jogo é bom.

O **Ponto de Mira** carrega **os dois controles ao mesmo tempo** (`src/car.ts`, e a decisão em
`docs/adr/0002`):

- a **direção** que o Carro tenta alcançar é o ângulo do Carro até a mira;
- a **velocidade** é a **distância** do Carro até a mira. Cursor colado é freio, cursor esticado é
  acelerador.

```ts
const distance = Math.hypot(aim.x - car.x, aim.y - car.y);
car.speed = speedMin + clamp01((distance - aimNear) / (aimFar - aimNear)) * (speedMax - speedMin);
```

Três detalhes que só aparecem quando você joga:

1. **Zona morta** (`aimDeadzone`, 40px). Com o cursor em cima do Carro o vetor de mira é curto demais
   para ter ângulo confiável: sem a zona morta, frear seria virar sem querer. Dentro dela, o Carro
   segue reto e você controla só a velocidade.
2. **O Carro nunca gira mais rápido que a taxa máxima.** Limite o giro por quadro a
   `turnRate * dt`. É daí que vem a tensão inteira do jogo: quanto mais rápido ele vai, mais aberta
   fica a curva que ele consegue fazer.
3. **A velocidade mínima nunca é zero.** O Carro não para; ele rasteja. Um jogo em que dá para
   parar e pensar não tem cronômetro que valha.

**Na tela:** um triângulo que persegue o cursor, acelera quando você afasta o mouse, e não consegue
fazer a curva se você tentar virar 180° a fundo.

---

## Passo 2 — Derrapagem: o Carro anda para onde não aponta

O Carro tem **duas** direções, e essa separação é o modelo de física inteiro:

- `heading` — para onde ele **aponta**;
- `drift` — para onde ele de fato **anda**.

Em chão seco são a mesma coisa. Onde a **Aderência** é baixa, `drift` fica para trás, e essa
diferença *é* a Derrapagem:

```ts
const chase = slipResponse * grip ** 3 * dt;   // ao cubo, não direto
car.drift += clamp(shortestAngle(car.heading - car.drift), -chase, chase);
car.x += Math.cos(car.drift) * car.speed * dt;
```

O expoente **3** é a lição cara deste passo. Com resposta proporcional à Aderência, mesmo o Gelo
(0,5) perseguia a 3 rad/s contra um giro de ~2,6 rad/s: o deslocamento alcançava a direção dentro do
mesmo quadro e a Derrapagem simplesmente nunca acontecia, em nenhum Bioma. O cubo é o que separa
"escorrega um pouco" de "escorrega muito" em vez de deixar tudo agarrado.

A regra que faz a Aderência ser uma decisão de traçado, e não de acelerador: **a Aderência entra
depois do volante, não nele**. O Carro vira igual em qualquer chão — o que muda é o quanto o chão
devolve. Frear na poça também não ajuda.

**Na tela:** baixe a Aderência para 0,4 na mão e veja o Carro andar de lado ao sair de uma curva.

---

## Passo 3 — A Pista, a partir de uma Semente

A Pista não é desenhada: é **gerada**, e sempre a mesma para a mesma **Etapa**
(`docs/adr/0001`). Semente sorteada por Corrida deixaria os Tempos incomparáveis — e um recorde
numa pista que nunca mais existe não é um recorde.

O gerador tem três camadas, e vale escrever nesta ordem (`src/rng.ts`, `src/track.ts`, `src/path.ts`):

1. **Um RNG determinístico** com semente. Um `mulberry32` de seis linhas basta. A Semente vem de um
   hash FNV do `stageId` (`"deserto-l0"`), então a identidade da Etapa *é* a Pista.
2. **Uma lista de comandos** — trechos de curvatura constante: `{ curvature, length }`. Sorteie
   **tipos de Segmento** por peso: reta, curva rápida, curva fechada, chicane. Cada tipo vira um ou
   mais comandos (a chicane vira três: curva, respiro, curva ao contrário).
3. **Um caminhante** que percorre os comandos de `step` em `step` (8px) integrando o ângulo, e
   cospe a **Linha Central** como uma lista de pontos.

Duas travas que evitam pistas inúteis:

- **Puxão de volta ao eixo.** Se a linha já está inclinada mais que metade do máximo, a próxima
  curva puxa para o outro lado. Sem isso a Pista sobe (ou desce) para sempre e deixa de correr da
  esquerda para a direita.
- **Comprimento fixo, não duração alvo.** 23.400px para todas as Etapas. A distância é o que é igual
  para todos; o Tempo é o que varia. É o que faz o cronômetro significar alguma coisa.

As **bordas** saem da Linha Central de graça: para cada ponto, ande meia largura na direção normal
(`makePath`). É também aí que se calcula o comprimento — e você vai precisar dele no Passo 6.

O número mais sensível do jogo é a **largura** (150px). É ela que decide quanto dá para cortar a
curva. E a alavanca de dificuldade é o **raio das curvas fechadas** (80–125px): abaixo do raio de
giro do Carro na velocidade máxima — `speedMax / turnRate`, que a função `minTurnRadius` calcula —
a curva **obriga** a frear.

**Na tela:** uma fita cinza que serpenteia e que é idêntica a cada recarregamento da página.

---

## Passo 4 — Onde o Carro está, e a Batida

O Carro está em coordenadas de mundo; a Pista é uma lista de pontos. Falta ligar os dois.

`probePath` procura, numa janela de índices, o segmento da Linha Central mais próximo do Carro, e
devolve **índice** (o progresso) e **distância** (o quanto ele está fora do meio). Batida é uma
linha:

```ts
if (probe.distance > track.width / 2 - carRadius) game.phase = 'crashed';
```

A armadilha aqui é a janela de busca. Limite o avanço ao que o Carro **de fato andou neste quadro**
(`speed * dt / step`). Sem esse limite, numa curva fechada o Carro corta por fora e a busca se agarra
na *saída* da curva — o jogo registra progresso em vez de Batida, e o jogador atravessa a grama
impune.

Câmera: o Carro fica a 20% da largura da tela (`cameraCarX`), não no meio. Você precisa ver pista à
frente, não atrás.

**Na tela:** o Carro segue a fita, o cronômetro conta, e sair da fita para a corrida.

---

## Passo 5 — Grid, recordes e Progressão

Ainda sem arte, resolva o ciclo de vida — é ele que transforma "um carro numa fita" em jogo.

As **Fases** são quatro: `grid`, `running`, `crashed`, `finished` (`src/game.ts`). E as regras que
importam:

- **A Corrida não começa sozinha**: nasce do **Grid**, onde se escolhe a Etapa e a Categoria.
- **Uma Batida devolve direto à largada**, sem passar pelo Grid. Repetir a tentativa não é uma
  decisão, é um reflexo — e um clique/toque basta.
- **Só a Conclusão produz Tempo.**

**Melhor Tempo** vai no `localStorage`, com a chave carregando Etapa **e** Categoria: um Tempo da
Categoria A não se compara com um da C.

**Progressão**: os Biomas ciclam indefinidamente, e ao fechar o ciclo a **Volta** avança. A
**Escalada** aperta duas coisas por Volta — a Pista estreita (150 → 96px, com piso) e o catálogo de
Segmentos pesa mais curva fechada e chicane (até o platô na Volta 3). Ter **Teto** é o que impede o
jogo de virar impossível em vez de difícil.

**Na tela:** um menu de largada, um cronômetro que grava recorde, e uma sequência de provas que não
acaba.

---

## Passo 6 — Bifurcações: a decisão que não é o volante

Aqui o jogo ganha a segunda decisão. Uma **Rota Alternativa** é um **deslocamento lateral da própria
Pista**, com um perfil `sin²` — que vale zero *e tem derivada zero* nas duas pontas. É por isso que
ela sai e reencontra tangencialmente, sem bico na junção.

O truque bonito: você não precisa de dois geradores. **Deslocar para fora de uma curva alonga a
Rota; deslocar para dentro encurta.** Gere candidatos dos dois lados, **meça** cada um contra o
trecho equivalente da Pista, e o sinal da diferença diz o que ele é: atalho ou desvio. Reserve
sempre uma vaga para um atalho — se toda Rota fosse pior, a placa só teria uma resposta possível, e
isso não é uma decisão.

Duas invariantes, e a segunda é a que de fato importa:

- Bifurcação só nasce em trecho de raio suave (>200px): dobrar uma curva fechada para dentro produz
  um traçado sobre si mesmo, e seria ilegível de qualquer jeito.
- **A Rota gerada tem de ser dirigível**: reprove qualquer uma cujo raio mínimo caia abaixo de 70px,
  porque ali ela exigiria mais giro do que o Carro tem.

E o detalhe de colisão que quase todo mundo erra: **o Carro permanece no Caminho em que está
enquanto estiver dentro das bordas dele** (`src/route.ts`). A regra ingênua — "está no Caminho cuja
linha do meio estiver mais perto" — não serve: perto da Bifurcação a linha da Rota ainda corre
*dentro* da Pista, e quem faz a curva colado naquele lado seria levado para o desvio sem ter
escolhido.

**Na tela:** uma placa, dois caminhos, e um deles chega antes.

---

## Passo 7 — Biomas, Aderência e Poças

Um **Bioma** é uma paleta + pesos de Segmento + Aderência + clima. Seis deles, ciclando
(`src/stage.ts`).

A diferença que vale entender: a **Poça** é um *lugar* dentro de uma Etapa — dá para desviar, e por
isso é uma decisão; o **Gelo** é a *Etapa* — não dá, e por isso é uma condição. Poças nascem
**sobre** a Pista (ao contrário do cenário, que a evita): uma poça que dá para passar ao largo sem
sair da linha não é decisão nenhuma. E nunca cobrem a Pista inteira — sempre sobra um lado, e o
preço de desviar é ir para a borda.

Duas regras de justiça, e as duas custaram partidas perdidas para aparecer:

- **A largada tem de estar limpa.** Nada de obstáculo nos primeiros ~120 pontos: bater por causa de
  algo que já estava lá quando você largou não é uma corrida perdida, é uma emboscada.
- **O chão que escorrega tem de ser sabido antes da largada.** O Grid avisa. Descobrir no meio da
  primeira curva não é dificuldade, é pegadinha — e o Tempo já foi.

**Na tela:** seis provas que se parecem e se dirigem de formas diferentes.

---

## Passo 8 — O caderno do navegador

A Pista é determinística, então as **Notas** são calculadas **uma vez**, junto com ela
(`src/pacenotes.ts`). O jogo nunca "descobre" uma curva em tempo de execução; ele só lê a próxima.

O algoritmo: ângulo de giro por passo → agrupar trechos curvos contíguos (juntando os separados por
menos de 20 passos, descartando os menores que 12) → média da curvatura → raio → **severidade na
escala de rally**, de 1 (fechadíssima) a 6 (quase reta). Menor é mais perigoso.

Isso vira decoração até o Passo 9 — e ali vira o único jeito de correr.

---

## Passo 9 — A noite, e por que ela existe

A Montanha corre de noite: você só vê o que os **faróis** alcançam, desenhados com dois fachos
cônicos e uma auréola em volta do Carro (para ele não sumir ao girar).

Isso não é enfeite de paleta. É a Etapa em que o caderno do navegador **deixa de ser conforto e vira
o único jeito de correr** — o que estiver além do farol você precisa *saber*.

O alcance (430px) é a alavanca: abaixo do que o Carro percorre no tempo de reação, a Etapa vira
sorteio em vez de prova. Calibre contra a `speedMax` da Categoria mais rápida, não no olho.

---

## Passo 10 — Arte, Terreno e cenário

Aqui vale ler `docs/adr/0005` antes de gerar um pixel. A arte veio de três lugares diferentes e não
se lia como um jogo só; a saída foi refazer **tudo** sob um **Estilo** único, com os números em
`docs/estilo.md`.

O **Ponto de Vista é misto, de propósito**: chão (Pista, Terreno, chegada) visto **de cima**, a 90°;
objetos (Carro, árvores, público, pórtico) em **3/4**. É a convenção do rali 2D clássico, e ela
funciona porque é consistente.

Nenhum sprite traz sombra desenhada: a sombra é uma elipse que o **jogo** desenha no pé do objeto,
em tempo de execução. Assim ela vale para todos de uma vez, obedece o espelhamento e não congela a
direção da luz dentro do desenho.

O **Terreno** (o chão fora da Pista) não é uma textura repetida — era, e a repetição era exatamente
o que se enxergava. São tipos de chão que se encostam, com a passagem entre eles **desenhada** num
tileset de canto (Wang), e as manchas saem de ruído de valor com a mesma Semente da Etapa. Os níveis
são **encaixados** (o nível 2 só aparece dentro do 1), porque só existe transição desenhada entre
níveis vizinhos.

E o Carro: **tamanho na tela em pixels, não escala de sprite** (46px), calibrado contra o diâmetro
de colisão. Folhas diferentes têm resoluções diferentes; o que precisa ficar constante é o Carro na
tela. Um sprite maior que a colisão faz o jogador perder sem entender o motivo.

---

## Passo 11 — Som

Três camadas, e elas são coisas diferentes: **trilha** por Bioma (trocar de prova troca de música, e
repetir a mesma prova não recomeça a que já está tocando), **motor** com o tom seguindo o
acelerador, e efeitos de derrapagem e freio.

A pegadinha do navegador: som só toca **depois de um gesto do jogador**, e a recusa é **silenciosa**
— sem tratar isso, o jogo simplesmente parece não ter música. Libere o áudio no primeiro
`pointerdown`/`keydown`.

---

## Passo 12 — Ranking Mundial

Firestore, e a decisão está em `docs/adr/0004`: o Ranking é **separado** do Melhor Tempo, não uma
mudança dele de lugar. O Melhor Tempo é seu recorde e existe nos dois Modos; o Ranking é o mundo e
só existe Online. **Nada do jogo depende de rede** — se a leitura falhar, ela devolve nulo e a
corrida segue.

Duas escolhas de modelagem que evitam dor:

- **Um documento por Etapa × Categoria**, com os Tempos numa subcoleção. Assim o topo é um
  `orderBy('time')` simples. Um `where` de Etapa + `where` de Categoria + `orderBy` exigiria índice
  composto, que quebra em produção no primeiro deploy.
- **Cada Conclusão vira uma linha**, inclusive as suas repetidas. É um placar de fliperama: uma
  lista de Corridas, não de pessoas. O Nome não é conta — é digitado na primeira Conclusão Online e
  lembrado no navegador.

---

## Passo 13 — Celular

O celular não precisa de controle novo: precisa do **mesmo** controle. Trocar `mousemove` por
eventos `pointer*` no canvas cobre mouse e dedo pelo mesmo caminho — a mira segue o dedo enquanto
ele está na tela, e fica onde ficou quando ele sai (soltar não é freio, igual ao mouse parado).

O resto é impedir o navegador de sequestrar o gesto: `touch-action: none` no canvas,
`overscroll-behavior: none` no body, e viewport sem zoom. E no Grid, o botão **Largar** fica
**acima** do ranking: o ranking chega pela rede, e enquanto não chegava ele empurrava o botão para
baixo do dedo.

---

## Passo 14 — Ajustar até virar jogo

Deixe **todos** os números de sensação num arquivo só (`src/tuning.ts`), comentados com *o que
acontece se você mexer neles*. Um número sem essa frase é um número que ninguém vai ousar tocar
daqui a um mês.

O que **não** mora lá: velocidade mínima, máxima e giro — esses pertencem à **Categoria**
(`src/category.ts`). A regra que mantém as três vivas é **quem ganha velocidade perde giro**; sem
ela, a A seria estritamente melhor e ninguém jogaria B ou C. E a velocidade *mínima* mais alta da A
é o que a impede de ser "B com turbo": nela não dá para rastejar numa chicane.

Categorias são **pacotes fechados, não sliders** (`docs/adr/0003`). Deixar o jogador ajustar
livremente transforma o jogo em "descobrir o ajuste ótimo" uma vez, e depois nunca mais escolher
nada.

---

## A ordem, resumida

| # | Passo | Você tem de conseguir |
|---|---|---|
| 0 | Canvas e laço | redimensionar sem mudar a dificuldade |
| 1 | Carro e mira | acelerar afastando o cursor |
| 2 | Derrapagem | andar de lado no chão solto |
| 3 | Pista da Semente | a mesma pista a cada recarga |
| 4 | Progresso e Batida | perder ao sair da fita |
| 5 | Grid e recordes | uma sequência de provas |
| 6 | Bifurcações | escolher e chegar antes |
| 7 | Biomas e Poças | seis provas com dedo diferente |
| 8 | Notas | ler a curva antes de vê-la |
| 9 | Noite | correr pelo caderno |
| 10 | Arte e Terreno | parecer um jogo só |
| 11 | Som | motor que sobe com o pé |
| 12 | Ranking | disputar com quem não está na sala |
| 13 | Celular | jogar com o dedo |
| 14 | Tuning | mexer sem medo |

## Rodando este repositório

```bash
npm install
npm run dev        # o jogo
npm run editor     # editor de traçado de Pista (tools/pista.html)
npm run recortes   # editor de recortes de sprite (tools/sprites.html)
npm run build      # tsc + vite build, saída em dist/
```

O deploy é manual: o conteúdo de `dist/` vai para a branch `gh-pages`, que é o que o GitHub Pages
serve.
