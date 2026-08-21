# 5. Ponto de Vista misto, e toda a arte refeita sob um Estilo

Data: 2026-08-21

## Status

Aceita — substitui a arte de origem mista das folhas de mundo e do Carro.

## Contexto

A arte do jogo veio de três lugares diferentes: um pacote de terceiros para o Carro, duas folhas
geradas para os Biomas, e uma folha de poeira nunca ligada. Junta, ela não se lê como um jogo só, e
três defeitos concretos explicam por quê:

1. **O Carro mistura projeções dentro da própria folha.** Dos oito quadros, dois são vistos de cima,
   dois são vistos de lado e quatro são 3/4. Ele é o único objeto que gira, então a troca de ponto
   de vista acontece na tela, o tempo todo.
2. **O pixel não tem um tamanho só.** O Carro é desenhado a 0,72 e os objetos de Cenário a 0,55: na
   mesma tela, o pixel do Carro é maior que o pixel do cenário.
3. **Objetos em pé sobre chão visto de cima, sem sombra, flutuam.** O jogo já desenhava os objetos
   como painéis em pé enquanto deitava os pórticos atravessados na Pista — meio de cima, meio de
   lado, sem regra que dissesse qual valia.

A opção conservadora era consertar caso a caso: refazer só o Carro, só os pórticos. Ela não resolve
o terceiro problema, que é de conjunto e não de peça.

## Decisão

Toda a arte é refeita sob um **Estilo** escrito, e o **Ponto de Vista** é misto de propósito: o chão
é visto de cima, os objetos são desenhados em 3/4 em pé.

O chão não pode ser inclinado porque a **Pista** é definida pela **Linha Central** e por uma
largura, e é essa definição que decide a **Batida** — mudar a projeção do chão mudaria a geometria
que mata o jogador. Os objetos podem mentir porque nunca giram.

O Carro é a exceção: ele gira e é 3/4. Ele passa a ter **dezesseis direções desenhadas** e a rotação
do sprite pelo jogo é desligada. Girar um desenho de 3/4 é exatamente o defeito que se está
consertando.

Fica de fora, explicitamente: **a Pista não vira grade de tiles**. O Terreno em volta ganha tilesets
com transição desenhada, mas o leito da Pista continua um polígono derivado da Linha Central, e a
Borda continua o traço que o jogador lê como "aqui você morre". Informação de jogo não é trocada por
textura.

## Consequências

- **Nada da arte atual sobrevive.** As três folhas e o pacote do Carro saem inteiros. São cerca de
  quarenta e três gerações só para o Deserto, feitas em fila.
- **O Carro salta de 22,5 em 22,5 graus** em vez de girar continuamente. É o preço de o desenho
  estar certo em todo ângulo; se as duas gerações de oito direções não casarem entre si, o plano B é
  saltar de 45 em 45.
- **A sombra é do jogo, não do sprite.** Uma elipse no pé do objeto, desenhada em tempo de execução:
  vale para todos de uma vez, obedece o espelhamento e não congela a direção da luz dentro do
  desenho.
- **A escala vira campo do Bioma enquanto durar a troca**, porque o Deserto refeito e os dois Biomas
  antigos não podem dividir o mesmo número. O campo morre quando os três estiverem refeitos.
- **Os recortes deixam de ser medidos à mão.** Como cada objeto passa a nascer em arquivo próprio, a
  folha é remontada por script, que escreve os recortes sozinho — a medição manual que motivou o
  editor de recortes deixa de existir para a arte nova.
- **O jogo fica visivelmente misturado por alguns dias**, com o Deserto novo ao lado da Floresta e do
  Gelo antigos. É deliberado: erra-se o Estilo em vinte e sete objetos em vez de em sessenta.
