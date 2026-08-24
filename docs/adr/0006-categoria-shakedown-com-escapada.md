# 6. A Categoria Shakedown troca a Batida por uma Escapada com prazo

Data: 2026-08-24

## Status

Aceita

## Contexto

O jogo tem uma única punição, e ela é total: tocar a **Borda da Pista** encerra a Corrida e devolve
o jogador à largada. Isso *é* o jogo — a tensão vem de que ir rápido custa capacidade de curva, e o
erro não é negociável.

Também é a porta que fecha na cara de quem chega. Nas primeiras dezenas de tentativas o jogador não
está aprendendo a traçar; está assistindo à mesma largada. A Categoria mais perdoadora (**C**) alivia
o giro, mas não alivia a regra: a Borda continua matando.

O pedido foi uma Categoria em que a lateral não devolve ao começo — o Carro sai da Pista e fica muito
mais lento —, com o carro da **A**, e com um limite de dez segundos fora da Pista, depois do qual o
Bioma engole o Carro.

Isso bate de frente com duas coisas escritas. O glossário define **Batida** como tocar a Borda, sem
qualificação. E o ADR 0003 diz que a Categoria é um pacote de três números, com o aviso explícito de
que mexer em mais do que isso faria dela "um jogo diferente em vez de um carro diferente".

## Decisão

A **Shakedown** existe, e ela é de fato **um jogo diferente** — assumido, não disfarçado. O nome vem
do rali: a volta de acerto antes de a prova valer.

O carro é o da **A**, número por número (130 / 560 / 135°/s). A diferença não está na máquina, está
na regra:

- Sair da Pista é **Escapada**: o Carro continua correndo do lado de fora a 28% da velocidade, o
  cronômetro não para, e voltar é dirigir de volta. A Barreira do beco sem saída também só freia.
- A Escapada tem **prazo de dez segundos**. Passado ele, vem a **Engolida**: o Bioma come o Carro e a
  Corrida acaba como qualquer Batida — sem Tempo, na mesma Etapa, sem retroceder na Progressão.
- Cruzar a Linha de Chegada em Escapada não é Conclusão. Chegar é chegar pela Pista.
- A contagem é mostrada na tela, e os três últimos segundos aparecem em números grandes. Um prazo que
  o jogador não vê não é um prazo, é uma armadilha.

O prazo é o que impede a Escapada de virar um segundo traçado. Sem ele, o fora da Pista seria uma
rota lenta porém segura, e cortar curva por fora passaria a ser uma tática em vez de um erro.

**Cada Bioma engole do seu jeito**, e isso também é regra e não enfeite: o fora da Pista pertence ao
lugar. Deserto, o verme; Dunas, a tempestade que soterra; Floresta, a mata que fecha; Montanha, o
chão que cede; Lamaçal, o lodo que traga; Gelo, a placa que racha. Todas procedurais, desenhadas em
cima do Carro — seis folhas de arte seriam seis dívidas de estilo.

A **Shakedown fica fora do Ranking Mundial**. Um Tempo feito onde a Borda não mata na hora não é
comparável a um Tempo onde ela mata, e como o carro é *o mesmo* da A, deixá-los no mesmo mundo — mesmo
em listas separadas — daria a impressão de serem a mesma prova em dificuldades diferentes. O **Melhor
Tempo** local existe nela como em qualquer Categoria.

Alternativas consideradas: Escapada sem prazo (vira segundo traçado); penalidade de N segundos com
recolocação na Pista (ensina a aceitar o pedágio, não a traçar, e exige decidir *onde* recolocar); um
"modo treino" fora das Categorias (seria o mesmo objeto com outro nome, duplicando a escolha do Grid).

## Consequências

- Quem chega tem onde aprender a Pista sem decorar a largada, e no carro que vai querer levar depois.
- **A Shakedown é estritamente mais permissiva que a A com o mesmo carro.** Quem só quer chegar ao fim
  não tem motivo para escolher a A. O que sustenta a A é exatamente o que a Shakedown não tem: o
  Ranking Mundial. Aceito — e é a razão de a exclusão do Ranking não ser negociável.
- A Categoria deixa de ser só três números: ganha um campo de regra (`runoff`). O ADR 0003 fica de pé
  para A, B e C; a Shakedown é a exceção declarada, e não um precedente para Categorias com regras
  próprias.
- O Grid passa a ter quatro cartões, e o Bioma passa a ter uma propriedade de Engolida — todo Bioma
  novo precisa escolher a sua.
- Se o multiplayer com Elo acontecer, a Shakedown não pode participar dele pelo mesmo motivo que não
  entra no Ranking, e isso precisa ser dito na sala, não descoberto no fim da Prova.
