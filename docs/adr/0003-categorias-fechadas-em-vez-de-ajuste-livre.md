# 3. Categorias fechadas em vez de ajuste livre do Carro

Data: 2026-08-17

## Status

Aceita

## Contexto

O pedido original era deixar o jogador escolher, antes de largar, a velocidade máxima, a velocidade
mínima e a sensibilidade do giro. Isso bate de frente com duas afirmações que o domínio já fazia:
a Pista "tem comprimento fixo — é a distância que é igual para todos, e o Tempo é o que varia", e a
Semente "é o que torna um Tempo comparável a outro".

Com sliders livres, o que varia deixa de ser só o Tempo. Dois jogadores na mesma Etapa deixam de
estar fazendo a mesma coisa, e o Ranking Mundial — pedido na mesma conversa — mediria quem escolheu
os números melhores, não quem pilota melhor. Um slider contínuo também é uma decisão que o jogador
não tem como tomar bem: ele escolhe um número antes de saber o que o número faz.

Alternativas consideradas: ajuste livre restrito a um modo Treino fora do Ranking; ajuste livre com
os números gravados junto do Tempo, aceitando comparação frouxa; ajuste livre e Ranking ignorando o
assunto.

## Decisão

O ajuste vira um conjunto fechado de três **Categorias**, no espírito das classes de Le Mans. Cada
uma é um pacote de velocidade mínima, velocidade máxima e taxa de giro:

| | vel. mín | vel. máx | giro |
|---|---|---|---|
| **C** | 110 | 340 | 165°/s |
| **B** | 110 | 430 | 150°/s |
| **A** | 130 | 560 | 135°/s |

A regra que as governa: **quem ganha velocidade perde giro**. Sem ela A seria estritamente melhor
que B e C, e as outras duas não seriam jogadas. A velocidade mínima mais alta da A é o que a impede
de ser "B com turbo" — nela não dá para rastejar numa chicane.

O Acelerador (`aimNear`/`aimFar`) e a Zona Morta ficam idênticos nas três. A sensibilidade do giro,
que o pedido original queria livre, passa a pertencer à Categoria: não existe ajustar o carro,
existe escolher entre três.

O Ranking Mundial é recortado por Etapa × Categoria.

## Consequências

- "Distância igual para todos, o Tempo é o que varia" continua verdade — agora dentro da Categoria.
  O carro do primeiro colocado é idêntico ao seu.
- Três Rankings por Etapa em vez de um. Cada um com menos gente; o placar fica mais magro em troca
  de significar alguma coisa.
- O jogador escolhe entre três coisas com caráter, não entre infinitos números sem referência.
- Parte do pedido original morre de propósito: não há como ajustar a sensibilidade para conforto
  pessoal. Se isso incomodar na prática, o caminho de volta é um multiplicador de conforto por cima
  da sensibilidade base da Categoria — e aí é preciso decidir se ele entra no Ranking.
- A Progressão continua única. Trocar de Categoria não devolve o jogador à Etapa 1; o carro é do
  momento, o progresso é do jogador. Sem isso, ninguém experimentaria as outras duas.
- Os números do TUNING deixam de ser globais para os três campos que a Categoria define, e passam a
  precisar ser tunados três vezes.
