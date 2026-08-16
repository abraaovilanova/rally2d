import { TUNING } from './tuning';
import { buildTrack, type SegmentWeights, type Track } from './track';

export interface Palette {
  background: string;
  track: string;
  edge: string;
  car: string;
  aim: string;
  text: string;
}

/** A identidade visual de uma Etapa e o caráter base da sua Pista. */
export interface Biome {
  id: string;
  name: string;
  palette: Palette;
  weights: SegmentWeights;
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
      aim: 'rgba(246, 242, 233, 0.35)',
      text: '#f6f2e9',
    },
    weights: { straight: 4, smoothCurve: 3, tightCurve: 2, chicane: 1 },
  },
  {
    id: 'floresta',
    name: 'Floresta',
    palette: {
      background: '#0c1610',
      track: '#22402c',
      edge: '#6fe38a',
      car: '#f2fff5',
      aim: 'rgba(242, 255, 245, 0.35)',
      text: '#f2fff5',
    },
    weights: { straight: 2, smoothCurve: 3, tightCurve: 3, chicane: 2 },
  },
  {
    id: 'gelo',
    name: 'Gelo',
    palette: {
      background: '#0b131c',
      track: '#22374a',
      edge: '#7fd6ff',
      car: '#eaf6ff',
      aim: 'rgba(234, 246, 255, 0.35)',
      text: '#eaf6ff',
    },
    weights: { straight: 2, smoothCurve: 2, tightCurve: 4, chicane: 3 },
  },
];

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
