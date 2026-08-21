# Ficha do Estilo

O **Estilo** e o **Ponto de Vista** estão definidos no glossário (`CONTEXT.md`); a decisão e o custo
estão em `docs/adr/0005`. Este arquivo é a parte operacional: os números que entram literalmente em
cada geração. Se um número daqui mudar, a arte já feita fica fora do Estilo — mude sabendo disso.

## Ponto de Vista, na prática

- **Chão** — Pista, Terreno, linha de chegada: visto **de cima**, a 90°.
- **Objetos** — Carro, cenário, público, pórtico: **3/4**, câmera a ~60° do chão, de frente para
  quem joga.
- **Nenhum objeto traz sombra desenhada.** A sombra é uma elipse que o jogo desenha no pé do objeto,
  em tempo de execução: assim ela vale para todos de uma vez, obedece o espelhamento e não congela a
  direção da luz dentro do desenho. Todo pedido diz `no shadow, no ground, transparent background`.

## Números

| | |
|---|---|
| Tela de geração | 128×128 (personagem: 128×128; tileset: 128 por tile) |
| Escala na tela | 0,5 — um sprite de 128 aparece com 64px |
| Tamanho real | pela **ocupação do quadro**, nunca por escala no jogo |
| Luz | do alto à esquerda; sombra própria curta, caindo para a direita-baixo |
| Contorno | escuro **seletivo** — só onde separa do fundo, nunca em toda a silhueta |
| Cores por sprite | 8 a 12, tiradas da paleta-mestra |
| Detalhe | médio: legível a 64px, sem textura que vira ruído ao reduzir |

**Ocupação do quadro** — é isto que decide o tamanho, já que a escala é uma só:

| Ocupação | Aparece com | Exemplos |
|---|---|---|
| ¼ do quadro | ~16px | pedrinha, rachadura, marca de pneu, cone |
| ½ do quadro | ~32px | arbusto, pneus, pedras pequenas, placa |
| ⅔ do quadro | ~43px | **Carro**, espectador, cacto, pedras |
| quadro inteiro | ~64px | pórtico, alambrado, plateia |

O campo `escala` do editor de pista existe só para variação (0,85–1,15). Consertar tamanho é gerar
de novo, não esticar.

## Paleta-mestra

32 cores, em `tools/paleta.json`. Derivada das cores que o jogo já usa — as 13 âncoras (fundos,
leitos, bordas, texto e as três pinturas do Carro) estão todas dentro dela, então a arte nova nunca
briga com o HUD nem com a borda que o jogador lê como "aqui você morre".

| Rampa | Para quê |
|---|---|
| `tinta` | contorno e sombra; inclui o fundo do Deserto |
| `neutro` | branco sujo, texto, vidro |
| `areia` | Deserto: leito, terreno, e a borda amarela no topo |
| `terra` | pedra, madeira, sujeira — serve aos três Biomas |
| `verde` | Floresta |
| `gelo` | Gelo |
| `pele` | público, em qualquer Bioma |
| `acento` | as três pinturas do Carro, laranja quente e branco puro |

## O pedido

Todo pedido carrega este bloco, sem exceção:

```
top-down 3/4 pixel art, camera 60° above ground, single light from upper-left,
short own-shadow to lower-right, selective dark outline only where it separates
from the background, 8-12 colors from the given palette, medium detail readable
at 64px, no cast shadow, no ground plane, transparent background
```

Mais: a **imagem de referência** (a pedra de toque aprovada) e a **paleta** em toda chamada. Sem os
dois, cada geração volta um pouco diferente da anterior — foi assim que a folha do Gelo saiu de um
lugar diferente da folha do Deserto.

## Pedra de toque

Antes da fila, três objetos em escalas diferentes: **Carro**, **cacto** e **espectador**. É em humano
que estilo de pixel art costuma quebrar, e é em objeto pequeno que o detalhe médio costuma virar
ruído. Aprovado o trio, o Carro vira a imagem de referência de todo o resto.

## O Carro

Rali **Grupo B, anos 80**: para-lamas largos, asa traseira, faróis auxiliares no capô, para-barros,
número na porta, entrada de ar no teto, sujo de terra na parte de baixo. Silhueta de caixote —
é o que sobrevive a 43px; carro moderno é liso demais e some.

**16 direções**, feitas como duas gerações de 8 defasadas em 22,5°, por pintura. A rotação do sprite
pelo jogo fica **desligada**: girar um desenho de 3/4 é o defeito que se está consertando. Se as duas
gerações de uma pintura não casarem entre si, o plano B é ficar com 8 e saltar de 45 em 45 — melhor
saltar do que derrapar de lado.

## Onde a arte nasce e como vira jogo

Cada objeto nasce em um PNG próprio. `tools/montar-folha.py` empacota os PNGs de um Bioma numa folha
e **escreve os recortes no `cenario.json` sozinho** — a medição à mão que motivou o editor de
recortes deixa de existir para a arte nova. Depois disso, o editor de pista é quem manda.

Enquanto a troca durar, o Deserto refeito (escala 0,5) e os Biomas antigos (0,55) não podem dividir
o mesmo número: a escala vira campo do Bioma no `cenario.json`, e o campo morre quando os três
estiverem refeitos.
