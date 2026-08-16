import { BIOMES } from './stage';

/**
 * A Progressão: onde o jogador está na sequência de Etapas.
 * Não termina — os Biomas ciclam, e a Volta cresce a cada ciclo.
 */
export interface Progression {
  biomeIndex: number;
  lap: number;
}

const KEY = 'rally2d.progression';

export const START: Progression = { biomeIndex: 0, lap: 0 };

/** A Etapa seguinte. Ao fechar o ciclo de Biomas, a Volta avança e a Escalada aperta. */
export function nextOf({ biomeIndex, lap }: Progression): Progression {
  const wrapped = biomeIndex + 1 >= BIOMES.length;
  return {
    biomeIndex: wrapped ? 0 : biomeIndex + 1,
    lap: wrapped ? lap + 1 : lap,
  };
}

export function loadProgression(): Progression {
  const raw = localStorage.getItem(KEY);
  if (raw === null) return { ...START };

  try {
    const parsed = JSON.parse(raw) as Partial<Progression>;
    const biomeIndex = Number(parsed.biomeIndex);
    const lap = Number(parsed.lap);
    if (!Number.isInteger(biomeIndex) || !Number.isInteger(lap)) return { ...START };
    if (biomeIndex < 0 || biomeIndex >= BIOMES.length || lap < 0) return { ...START };
    return { biomeIndex, lap };
  } catch {
    return { ...START };
  }
}

export function saveProgression(progression: Progression): void {
  localStorage.setItem(KEY, JSON.stringify(progression));
}

/**
 * Volta ao começo da sequência. Os Melhores Tempos ficam — sem isto, quem parasse
 * numa Volta alta voltaria sempre à dificuldade máxima, sem caminho de volta.
 */
export function resetProgression(): Progression {
  localStorage.removeItem(KEY);
  return { ...START };
}
