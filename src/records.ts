import type { CategoryId } from './category';

/**
 * Melhor Tempo por Etapa × Categoria. Só Corridas concluídas produzem Tempo.
 *
 * É local sempre, nos dois Modos: é o recorde do jogador, não do mundo, e não pode
 * depender de rede nem de Nome. O Ranking Mundial (`leaderboard.ts`) é outra coisa.
 */
const KEY_PREFIX = 'rally2d.best.';

/**
 * A chave carrega a Categoria porque um Tempo da A não se compara com um da C.
 * Recordes gravados antes das Categorias existirem eram todos com os números da B,
 * então a B lê a chave antiga como fallback em vez de fingir que o jogador nunca correu.
 */
function keyOf(stageId: string, category: CategoryId): string {
  return `${KEY_PREFIX}${stageId}.${category}`;
}

export function readBestTime(stageId: string, category: CategoryId): number | null {
  const raw =
    localStorage.getItem(keyOf(stageId, category)) ??
    (category === 'B' ? localStorage.getItem(KEY_PREFIX + stageId) : null);

  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Grava se for melhor. Devolve true quando um recorde novo foi estabelecido. */
export function recordTime(stageId: string, category: CategoryId, time: number): boolean {
  const best = readBestTime(stageId, category);
  if (best !== null && best <= time) return false;
  localStorage.setItem(keyOf(stageId, category), String(time));
  return true;
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}
