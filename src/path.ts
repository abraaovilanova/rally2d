import { buildPaceNotes, type PaceNote } from './pacenotes';

export interface Vec {
  x: number;
  y: number;
}

/**
 * Um traçado percorrível: a linha do meio, as duas bordas e o caderno de notas dele.
 * A Pista principal é um Caminho; cada Rota Alternativa também é.
 */
export interface Path {
  center: Vec[];
  left: Vec[];
  right: Vec[];
  /** Comprimento em px. É o que decide se uma Rota é atalho ou desvio. */
  length: number;
  notes: PaceNote[];
}

export function makePath(center: Vec[], halfWidth: number, step: number): Path {
  const left: Vec[] = [];
  const right: Vec[] = [];
  let length = 0;

  for (let i = 0; i < center.length; i++) {
    const a = center[Math.max(0, i - 1)];
    const b = center[Math.min(center.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    left.push({ x: center[i].x - (dy / len) * halfWidth, y: center[i].y + (dx / len) * halfWidth });
    right.push({ x: center[i].x + (dy / len) * halfWidth, y: center[i].y - (dx / len) * halfWidth });
    if (i > 0) length += Math.hypot(center[i].x - center[i - 1].x, center[i].y - center[i - 1].y);
  }

  return { center, left, right, length, notes: buildPaceNotes(center, step) };
}

export interface Probe {
  /** Índice do ponto mais próximo — o progresso do Carro neste Caminho. */
  index: number;
  /** Distância do Carro à linha do meio deste Caminho. */
  distance: number;
}

/**
 * Onde o Carro está em relação a um Caminho.
 *
 * A janela para a frente é limitada ao que o Carro conseguiu andar neste quadro
 * (`maxAdvance`). Sem esse limite, numa curva fechada o Carro pode cortar por fora
 * e a busca se agarra na *saída* da curva — registrando progresso em vez de Batida.
 */
export function probePath(path: Path, pos: Vec, lastIndex: number, maxAdvance: number): Probe {
  return probeRange(
    path,
    pos,
    Math.max(0, lastIndex - 8),
    Math.min(path.center.length - 2, lastIndex + maxAdvance),
  );
}

/** Busca livre numa faixa de índices. Usada para decidir em qual Caminho o Carro está. */
export function probeRange(path: Path, pos: Vec, from: number, to: number): Probe {
  let bestIndex = from;
  let bestDistSq = Infinity;

  for (let i = Math.max(0, from); i <= Math.min(path.center.length - 2, to); i++) {
    const a = path.center[i];
    const b = path.center[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy || 1;
    const t = clamp(((pos.x - a.x) * dx + (pos.y - a.y) * dy) / lenSq, 0, 1);
    const distSq = (pos.x - (a.x + dx * t)) ** 2 + (pos.y - (a.y + dy * t)) ** 2;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestIndex = i;
    }
  }

  return { index: bestIndex, distance: Math.sqrt(bestDistSq) };
}

/** Vetor normal unitário à esquerda do Caminho no índice dado. */
export function normalAt(center: Vec[], i: number): Vec {
  const a = center[Math.max(0, i - 1)];
  const b = center[Math.min(center.length - 1, i + 1)];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
