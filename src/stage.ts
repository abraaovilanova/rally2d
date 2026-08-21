import type { Clima } from './clima';
import { TUNING } from './tuning';
import { buildTrack, type SegmentWeights, type Track } from './track';

export interface Palette {
  background: string;
  track: string;
  edge: string;
  car: string;
  text: string;
}

/** A identidade visual de uma Etapa e o caráter base da sua Pista. */
export interface Biome {
  id: string;
  name: string;
  palette: Palette;
  weights: SegmentWeights;
  /**
   * A Aderência do chão do Bioma, de 0 a 1. Um é o chão seco, onde a direção que o Carro
   * aponta e a que ele percorre são a mesma. O Gelo é o Bioma que escorrega inteiro.
   */
  grip: number;
  /** O Bioma tem Poças — trechos soltos de Aderência baixa, que dá para desviar. */
  puddles: boolean;
  /** A Etapa corre de noite: só se vê o que os faróis do Carro alcançam. */
  noite?: boolean;
  /** Quanto o chão é sombreado pelo próprio relevo, de 0 a 1. */
  relevo?: number;
  /** O que cai ou voa entre a câmera e o mundo. Desenho, não Aderência. */
  clima?: Clima;
}

export const BIOMES: readonly Biome[] = [
  {
    id: 'deserto',
    name: 'Deserto',
    palette: {
      background: '#1c1410',
      track: '#5d4a30',
      edge: '#e8b04b',
      car: '#f6f2e9',
      text: '#f6f2e9',
    },
    weights: { straight: 4, smoothCurve: 3, tightCurve: 2, chicane: 1 },
    grip: 1,
    puddles: false,
  },
  {
    id: 'floresta',
    name: 'Floresta',
    palette: {
      background: '#0c1610',
      track: '#22402c',
      edge: '#6fe38a',
      car: '#f2fff5',
      text: '#f2fff5',
    },
    weights: { straight: 2, smoothCurve: 3, tightCurve: 3, chicane: 2 },
    grip: 1,
    puddles: true,
  },
  {
    id: 'montanha',
    name: 'Montanha',
    palette: {
      background: '#0a0c14',
      track: '#2a2c34',
      edge: '#ffc14d',
      car: '#f2f4ff',
      text: '#e6e9f2',
    },
    weights: { straight: 2, smoothCurve: 2, tightCurve: 4, chicane: 2 },
    // Cascalho solto de estrada de serra: escorrega menos que gelo e mais que asfalto.
    // Abaixo de 0,74 a perseguição cai sob a taxa de giro e a traseira começa a sair —
    // é o que separa "estrada de terra" de "estrada de terra à noite".
    grip: 0.72,
    puddles: false,
    /**
     * A Montanha corre de noite. Não é enfeite de paleta: à noite o jogador só vê o que
     * os faróis alcançam, e o que estiver além disso ele precisa **saber** — é a Etapa em
     * que o caderno do navegador deixa de ser conforto e vira o único jeito de correr.
     */
    noite: true,
    /**
     * O relevo: a mesma altura que decide o Terreno passa a ser sombreada, e o chão deixa
     * de ser plano. É o que dá a impressão de subir e descer sem o jogo ter uma terceira
     * dimensão para isso.
     */
    relevo: 1,
  },
  {
    id: 'lamacal',
    name: 'Lamaçal',
    palette: {
      background: '#141a16',
      track: '#3a3026',
      edge: '#8fe3a8',
      car: '#eef6f0',
      text: '#e8f2ea',
    },
    weights: { straight: 3, smoothCurve: 3, tightCurve: 3, chicane: 2 },
    /** Chão encharcado: a Aderência mais baixa do jogo fora do Gelo. */
    grip: 0.62,
    puddles: true,
    clima: {
      cor: 'rgba(196, 224, 232, 0.5)',
      densidade: 0.42,
      angulo: Math.PI / 2 + 0.28,
      velocidade: 1250,
      risco: 22,
      veu: 'rgba(120, 150, 160, 0.12)',
    },
  },
  {
    id: 'dunas',
    name: 'Dunas',
    palette: {
      background: '#2a1a12',
      track: '#7a5636',
      edge: '#ffb347',
      car: '#fff3e2',
      text: '#ffeeda',
    },
    weights: { straight: 4, smoothCurve: 4, tightCurve: 2, chicane: 1 },
    /** Areia solta e funda: escorrega pouco, mas escorrega o tempo todo. */
    grip: 0.86,
    puddles: false,
    /** A duna é feita de relevo — sem ele, é um deserto plano com outro nome. */
    relevo: 0.7,
    clima: {
      cor: 'rgba(255, 224, 170, 0.42)',
      densidade: 0.3,
      angulo: 0.14,
      velocidade: 1500,
      risco: 34,
      veu: 'rgba(214, 150, 70, 0.08)',
    },
  },
  {
    id: 'gelo',
    name: 'Gelo',
    palette: {
      background: '#0b131c',
      track: '#22374a',
      edge: '#7fd6ff',
      car: '#eaf6ff',
      text: '#eaf6ff',
    },
    weights: { straight: 2, smoothCurve: 2, tightCurve: 4, chicane: 3 },
    grip: TUNING.iceGrip,
    puddles: false,
  },
];

/**
 * As Voltas que o Grid deixa escolher. A Progressão continua indo além delas; o que para
 * em 3 é a escolha direta — acima disso a Escalada já platôs e a lista viraria uma tabela
 * infinita de Etapas que ninguém correu.
 */
export const SELECTABLE_LAPS = 3;

/** Uma Etapa: o que o jogador de fato joga, e a chave dos seus recordes. */
export interface Stage {
  id: string;
  biome: Biome;
  /** Quantos ciclos completos de Biomas o jogador já percorreu. */
  lap: number;
  track: Track;
}

export function makeStage(biomeIndex: number, lap: number): Stage {
  const biome = BIOMES[biomeIndex];
  const id = `${biome.id}-l${lap}`;

  const track = buildTrack({
    stageId: id,
    width: widthForLap(lap),
    length: TUNING.trackLength,
    weights: escalate(biome.weights, lap),
    branchCount: TUNING.branchesPerStage,
  });

  return { id, biome, lap, track };
}

/** A Escalada estreita a Pista até o piso, e para ali. */
function widthForLap(lap: number): number {
  const widths = TUNING.escalationWidths;
  return widths[Math.min(lap, widths.length - 1)];
}

/** A Escalada também puxa o catálogo para curvas fechadas, até o platô. */
function escalate(weights: SegmentWeights, lap: number): SegmentWeights {
  const t = Math.min(lap, TUNING.escalationPlateauLap) / TUNING.escalationPlateauLap;
  const boost = 1 + t * (TUNING.escalationCurveWeight - 1);

  return {
    straight: weights.straight,
    smoothCurve: weights.smoothCurve,
    tightCurve: weights.tightCurve * boost,
    chicane: weights.chicane * boost,
  };
}
