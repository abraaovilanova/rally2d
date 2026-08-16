/**
 * Gerador determinístico. A mesma Semente produz sempre a mesma sequência —
 * é o que faz a Pista de uma Etapa ser sempre a mesma.
 * Ver docs/adr/0001-semente-fixa-por-etapa.md
 */
export interface Rng {
  /** [0, 1) */
  next(): number;
  /** [min, max) */
  range(min: number, max: number): number;
  /** Escolhe um item pelos pesos dados. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const range = (min: number, max: number) => min + next() * (max - min);

  const weighted = <T>(items: readonly T[], weights: readonly number[]): T => {
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  };

  return { next, range, weighted };
}

/** Deriva uma Semente estável a partir do identificador de uma Etapa. */
export function seedFromStageId(stageId: string): number {
  let h = 2166136261;
  for (let i = 0; i < stageId.length; i++) {
    h ^= stageId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
