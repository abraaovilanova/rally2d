/** Melhor Tempo por Etapa. Só Corridas concluídas produzem Tempo. */
const KEY_PREFIX = 'rally2d.best.';

export function readBestTime(stageId: string): number | null {
  const raw = localStorage.getItem(KEY_PREFIX + stageId);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Grava se for melhor. Devolve true quando um recorde novo foi estabelecido. */
export function recordTime(stageId: string, time: number): boolean {
  const best = readBestTime(stageId);
  if (best !== null && best <= time) return false;
  localStorage.setItem(KEY_PREFIX + stageId, String(time));
  return true;
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}
