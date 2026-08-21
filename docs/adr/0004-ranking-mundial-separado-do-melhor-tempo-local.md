# 4. O Ranking Mundial é separado do Melhor Tempo local

Data: 2026-08-17

## Status

Aceita

## Contexto

O pedido era guardar o score dos jogadores no Firebase para virar uma competição mundial. A leitura
intuitiva é "mover os recordes para a nuvem": o Firebase passa a ser a verdade e o `localStorage`
sai de cena.

Isso quebra coisas que hoje funcionam. O jogo roda inteiro no cliente e é single-player; deixar uma
falha de rede apagar o recorde do jogador é dano gratuito. E um Tempo feito sem conexão não tem
carimbo confiável de quando ou como foi feito — subi-lo depois é convidar o problema que a decisão
de não combater trapaça (abaixo) já assume.

Também não há login: a identidade é um Nome digitado. Um Nome não é uma conta, então o Firebase não
tem como ser dono do recorde de ninguém.

## Decisão

São dois conceitos, não duas cópias do mesmo dado.

O **Melhor Tempo** é local, pessoal, e existe nos dois Modos. Vive no `localStorage`, funciona sem
rede, e não depende de Nome.

O **Ranking Mundial** vive no Firestore, existe só no Modo Online, e recebe automaticamente cada
Corrida concluída com conexão no momento. Tempos feitos Offline nunca sobem depois.

Detalhes que caem daí:

- **Firestore**, não Realtime Database: a consulta do Ranking é "os N menores Tempos desta Etapa
  nesta Categoria", uma query ordenada com limite.
- **Sem autenticação.** O Nome é digitado na primeira Conclusão e lembrado. Nada impede alguém usar
  o Nome de outro.
- **Sem defesa contra trapaça.** O tempo é medido no cliente; quem abrir o console posta o que
  quiser. Decisão consciente: o jogo é pequeno, e as alternativas (piso de plausibilidade nas
  regras, ou gravação de inputs re-simulada no servidor) custam mais do que o placar vale hoje.
- **Uma linha por Corrida concluída**, não um recorde por jogador. Placar de fliperama: uma lista de
  Corridas, não de pessoas.
- **Um Ranking por Etapa**, e portanto por Volta, para sempre.
- Queda de rede no meio de uma Corrida avisa e segue jogável. Nenhuma Corrida morre por causa de
  rede.

## Consequências

- O jogo continua inteiramente jogável sem internet, e o modo Online é aditivo — o que mantém o
  Firebase fora do caminho crítico de tudo que já existe.
- O Top 10 pode acabar sendo o mesmo Nome dez vezes: com uma linha por Corrida, o placar premia
  insistência junto com habilidade. Aceito.
- O Ranking vai receber tempos impossíveis mais cedo ou mais tarde. Quando incomodar, o remédio
  barato é um piso de plausibilidade (comprimento da Pista ÷ velocidade máxima da Categoria) nas
  Security Rules.
- Nas Voltas altas o Ranking terá pouca ou nenhuma gente — provavelmente só o próprio jogador.
  Aceito: a alternativa (repetir Sementes a partir da Volta 4, onde a Escalada bate no Teto, para
  juntar todo mundo num Ranking só) faria a Progressão virar a mesma Pista repetindo para sempre.
- Tempos feitos Offline são perdidos para o mundo. O jogador precisa saber disso no menu, senão vai
  correr bem sem conexão e descobrir depois.
