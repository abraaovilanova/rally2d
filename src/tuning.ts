/**
 * Todos os números que definem a sensação do jogo, num lugar só.
 * Edite aqui e recarregue.
 */
export const TUNING = {
  /** Velocidade do Carro com o cursor colado nele, em px/s. Nunca zero. */
  carSpeedMin: 110,

  /** Velocidade do Carro com o cursor esticado, em px/s. */
  carSpeedMax: 430,

  /** Distância da mira, em px, a partir da qual o Carro sai da velocidade mínima. */
  aimNear: 60,

  /** Distância da mira, em px, a partir da qual o Carro já está na velocidade máxima. */
  aimFar: 520,

  /**
   * Raio, em px, dentro do qual a mira só controla velocidade, não direção.
   * Com o cursor colado no Carro o ângulo do vetor de mira fica instável — sem a
   * zona morta, frear seria involuntariamente virar.
   */
  aimDeadzone: 40,

  /**
   * Taxa de giro máxima do Carro, em graus/s. Constante: como o raio de giro é
   * velocidade ÷ taxa de giro, a velocidade já se pune sozinha alargando a curva.
   */
  carTurnRate: 150,

  /** Raio de colisão do Carro, em px. */
  carRadius: 9,

  /**
   * Escala do sprite de 64px. Calibrada para a largura do carro desenhado bater com o
   * diâmetro de colisão (2 × carRadius): um sprite maior que a colisão faz o jogador
   * perder sem entender o motivo. Se aumentar aqui, aumente `carRadius` junto.
   */
  carSpriteScale: 0.72,

  /**
   * Gira o sprite no canvas para cobrir os ângulos entre os 8 quadros da folha.
   * Desligue para ver o Carro saltando de 45 em 45 graus, no estilo do asset original.
   */
  smoothSpriteRotation: true,

  /** Largura da Pista, em px. Constante dentro de uma Etapa. */
  trackWidth: 150,

  /**
   * Comprimento da Pista, em px. Fixo: é a distância que é igual para todos,
   * e o Tempo é o que varia. Dá 70–100s num ritmo realista.
   */
  trackLength: 23400,

  /**
   * A Escalada: largura da Pista por Volta, em px. O último valor é o piso — Voltas
   * além dele repetem essa largura, e o jogo vira um platô de dificuldade constante.
   *
   * Passos pequenos de propósito: a largura é o parâmetro mais sensível do jogo, porque
   * é ela que decide quanto o jogador pode cortar a curva. De 150 a 96 a folga lateral
   * cai de 66px para 39px — quase metade da margem de erro.
   */
  escalationWidths: [150, 132, 118, 106, 96] as readonly number[],

  /** A Volta em que o catálogo de Segmentos atinge sua agressividade máxima. */
  escalationPlateauLap: 3,

  /** Multiplicador do peso de curvas fechadas e chicanes no platô da Escalada. */
  escalationCurveWeight: 2,

  /**
   * Faixa de raio das curvas fechadas, em px. A alavanca principal de dificuldade:
   * abaixo do raio de giro do Carro na velocidade máxima, a curva **obriga** a frear.
   */
  tightCurveRadius: [80, 125] as [number, number],

  /** Faixa de arco das curvas fechadas, em graus. Arco longo = frear por mais tempo. */
  tightCurveArc: [70, 120] as [number, number],

  /** Faixa de raio das curvas rápidas, em px. Passáveis a fundo. */
  smoothCurveRadius: [450, 800] as [number, number],

  /** Faixa de raio de cada metade de uma chicane, em px. */
  chicaneRadius: [150, 240] as [number, number],

  /**
   * Raio mínimo do trecho da Pista onde uma Bifurcação pode nascer, em px.
   * Trechos mais fechados que isto produzem Rotas dobradas sobre si mesmas.
   */
  branchMinSectionRadius: 200,

  /**
   * Raio mínimo aceitável na Rota Alternativa gerada, em px. É a invariante que importa:
   * abaixo disto a Rota exige mais giro do que o Carro tem e vira intransitável.
   */
  branchMinRouteRadius: 70,

  /** Quantas Bifurcações uma Etapa tenta ter. */
  branchesPerStage: 3,

  /**
   * Fração inicial de uma Rota Alternativa em que ela ainda parece a Pista normal.
   * Depois disso o asfalto escurece: na boca da Bifurcação os dois caminhos têm de ser
   * idênticos, senão não há decisão a tomar — só bordas amarelas a seguir.
   */
  routeRevealAt: 0.15,

  /** Distância entre pontos da Linha Central, em px. Menor = curvas mais lisas. */
  centerlineStep: 8,

  /** Quanto a Linha Central pode divergir do eixo horizontal, em graus. */
  maxHeading: 72,

  /** Reta inicial antes da primeira curva, em px. */
  runInLength: 300,

  /** Fração da largura da tela em que o Carro fica. Menor = mais pista à frente. */
  cameraCarX: 0.2,

  /** Distância, em px, dentro da qual uma Nota aparece no caderno. */
  paceNoteLookahead: 1600,

  /** Quantos px de Pista valem um "metro" na leitura das Notas. */
  pixelsPerMeter: 10,
} as const;
