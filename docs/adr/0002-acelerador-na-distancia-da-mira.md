# 2. O Acelerador é a distância do cursor, e a Pista tem comprimento fixo

Data: 2026-08-16

## Status

Aceita — substitui a velocidade constante da versão inicial.

## Contexto

Na primeira versão o Carro andava a velocidade constante e a Pista era dimensionada por uma duração
alvo (90 segundos). Isso tinha um furo: com velocidade constante, o Tempo de uma Corrida limpa é
essencialmente `comprimento ÷ velocidade` para todo mundo. O Melhor Tempo mal variava entre
tentativas, e o placar não media habilidade nenhuma — só media se você bateu ou não.

O jogo se apresenta como um jogo de tempo, mas não tinha nada para o tempo medir.

## Decisão

Duas mudanças acopladas:

1. A **Pista tem comprimento fixo** em px, não duração alvo. A distância é igual para todos; o
   Tempo é o que varia.
2. A distância entre o cursor e o Carro é o **Acelerador**. Cursor esticado acelera, cursor colado
   freia. A velocidade mínima nunca é zero — sem isso o jogador para antes de cada curva e o jogo
   degenera em "espere o relógio".

A taxa de giro fica **constante**. Como o raio de giro é `velocidade ÷ taxa de giro`, a velocidade
já se pune sozinha alargando a curva: não é preciso uma segunda regra penalizando velocidade.

Uma **Zona Morta** em torno do Carro faz a mira controlar só a velocidade quando o cursor está
muito perto. Sem ela, o ângulo de um vetor de mira de poucos pixels fica instável exatamente no
momento em que o jogador precisa frear com precisão — um defeito de input que o jogador leria como
o jogo tendo falhado.

## Consequências

- O Melhor Tempo passa a medir a coisa certa: **quanta velocidade o jogador carrega sem tocar a
  Borda**.
- O raio das curvas fechadas passa a ser a alavanca principal de dificuldade, e por isso vive no
  `TUNING`. Curvas com raio acima do raio de giro do Carro na velocidade máxima simplesmente não
  pedem freio.
- Simulando pilotos automáticos, a volta mais rápida encontrada é quase a fundo (~53s contra ~59s
  freando nas curvas fechadas), mas só **2 a 4 de 8 trajetórias testadas sobrevivem** a fundo. O
  freio não é obrigatório — é gestão de risco. O ótimo teórico é rápido e frágil, o que é o
  comportamento certo para um jogo de corrida, mas significa que a dificuldade real depende da
  precisão humana, não da geometria.
- A largura da Pista virou o parâmetro mais sensível do jogo: ela define quanta folga o jogador tem
  para cortar a curva, e cortar aumenta muito mais o raio efetivo do que apertar a curva o reduz.
