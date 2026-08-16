# 1. Semente fixa por Etapa

Data: 2026-08-16

## Status

Aceita

## Contexto

A Pista de cada Etapa é gerada proceduralmente a partir de uma Semente. Havia duas opções:
sortear uma Semente nova a cada Corrida, ou derivá-la deterministicamente da identidade da Etapa
(bioma + volta).

Geração aleatória por Corrida é a escolha intuitiva para um jogo com progressão infinita — dá
variedade ilimitada de graça e evita que o jogador "decore" o conteúdo.

Duas forças puxam contra ela:

1. **O jogo mede tempo.** Um Melhor Tempo só significa alguma coisa se as Corridas comparadas
   percorreram a mesma Pista. Com Pista sorteada, o recorde vira um registro de qual sorteio foi
   mais generoso.
2. **O jogo ainda não está tunado.** Velocidade, taxa de giro e largura da pista são números que
   precisam ser ajustados por sensação. Com a Pista mudando a cada tentativa, é impossível dizer se
   uma mudança de tuning melhorou o controle ou se a pista só veio mais fácil.

A memorização, que a aleatoriedade evitaria, é na verdade o prazer central de um jogo de tempo de
volta — o jogador quer conhecer a curva 3.

## Decisão

A Semente é derivada deterministicamente da identidade da Etapa. A mesma Etapa produz sempre
exatamente a mesma Pista, entre tentativas e entre sessões.

## Consequências

- Melhores Tempos são comparáveis, e o placar por Etapa significa algo.
- Mudanças de tuning podem ser avaliadas contra uma Pista constante.
- O jogador memoriza traçados — desejável aqui, mas significa que o conteúdo se esgota: a variedade
  precisa vir da Escalada e de novos Biomas, não do gerador.
- Um bug de geração numa Etapa é permanente e reproduzível para todos os jogadores, em vez de
  aparecer aleatoriamente. Mais fácil de diagnosticar, mais visível se não for corrigido.
