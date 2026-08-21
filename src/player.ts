/**
 * O Modo e o Nome: as duas preferências do jogador que dizem respeito ao mundo,
 * e não à Corrida. Ambas vivem no navegador.
 */

export type Mode = 'online' | 'offline';

const MODE_KEY = 'rally2d.mode';
const NAME_KEY = 'rally2d.name';

/** Nulo até o jogador escolher no menu de abertura. */
export function readMode(): Mode | null {
  const raw = localStorage.getItem(MODE_KEY);
  return raw === 'online' || raw === 'offline' ? raw : null;
}

export function saveMode(mode: Mode): void {
  localStorage.setItem(MODE_KEY, mode);
}

/**
 * O Nome não é uma conta: é digitado na primeira Conclusão Online e lembrado depois.
 * Nada impede dois jogadores usarem o mesmo — é o preço de ninguém ter de se cadastrar.
 */
export function readName(): string | null {
  const raw = localStorage.getItem(NAME_KEY);
  return raw === null ? null : normalizeName(raw) || null;
}

export function saveName(name: string): void {
  localStorage.setItem(NAME_KEY, normalizeName(name));
}

/** 16 caracteres é o que cabe numa linha do Ranking sem quebrar o alinhamento. */
export function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, 16);
}
