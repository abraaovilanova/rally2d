import type { Vec } from './path';
/**
 * Uma Nota: uma curva que vem pela frente, no formato do caderno do navegador de rally.
 *
 * A Pista é determinística, então as Notas são calculadas uma vez junto com ela —
 * o jogo nunca "descobre" uma curva em tempo de execução, ele apenas lê a próxima.
 */
export interface PaceNote {
  /** -1 para esquerda, 1 para direita. */
  direction: -1 | 1;
  /**
   * Severidade na escala de rally: 1 é uma curva fechadíssima, 6 é quase reta.
   * Menor = mais perigoso.
   */
  severity: number;
  /** Índice na Linha Central onde a curva começa e termina. */
  startIndex: number;
  endIndex: number;
  /** Curva de raio pequeno e arco longo — o "longa" das notas reais. */
  long: boolean;
}

/** Curvatura abaixo disto é reta para efeito de Nota. */
const CURVATURE_THRESHOLD = 0.004;
/** Trechos curvos separados por menos que isto viram uma Nota só. */
const MERGE_GAP = 20;
/** Uma curva mais curta que isto não merece Nota. */
const MIN_RUN = 12;

export function buildPaceNotes(center: Vec[], step: number): PaceNote[] {
  const turn = perStepTurn(center);
  const runs = groupRuns(turn);
  const notes: PaceNote[] = [];

  for (const run of runs) {
    const length = run.end - run.start;
    if (length < MIN_RUN) continue;

    const meanTurn = run.total / length;
    const radius = step / Math.abs(meanTurn);
    const arcDegrees = (Math.abs(run.total) * 180) / Math.PI;

    notes.push({
      direction: meanTurn > 0 ? 1 : -1,
      severity: severityFor(radius),
      startIndex: run.start,
      endIndex: run.end,
      long: arcDegrees > 70,
    });
  }

  return notes;
}

/**
 * A Nota que o jogador precisa ler agora: a primeira que ainda não terminou.
 * `distance` é em px até o início dela — negativo quando já está dentro da curva.
 */
export function nextNotes(
  notes: PaceNote[],
  index: number,
  step: number,
): { note: PaceNote; distance: number }[] {
  const result: { note: PaceNote; distance: number }[] = [];

  for (const note of notes) {
    if (note.endIndex <= index) continue;
    result.push({ note, distance: (note.startIndex - index) * step });
    if (result.length === 2) break;
  }

  return result;
}

/** Quanto a linha do meio gira a cada passo, com sinal. */
function perStepTurn(c: Vec[]): number[] {
  const turn = new Array<number>(c.length).fill(0);

  for (let i = 1; i < c.length - 1; i++) {
    const h1 = Math.atan2(c[i].y - c[i - 1].y, c[i].x - c[i - 1].x);
    const h2 = Math.atan2(c[i + 1].y - c[i].y, c[i + 1].x - c[i].x);
    const d = h2 - h1;
    turn[i] = Math.atan2(Math.sin(d), Math.cos(d));
  }

  return turn;
}

interface Run {
  start: number;
  end: number;
  /** Giro acumulado, com sinal. */
  total: number;
}

function groupRuns(turn: number[]): Run[] {
  const runs: Run[] = [];
  let current: Run | null = null;
  let gap = 0;

  for (let i = 0; i < turn.length; i++) {
    const t = turn[i];
    const curving = Math.abs(t) > CURVATURE_THRESHOLD;
    const sign = t > 0 ? 1 : -1;

    if (!curving) {
      // Uma reta curta no meio de uma curva (a saída de uma chicane, por exemplo)
      // não deve partir a Nota em duas.
      if (current && ++gap > MERGE_GAP) {
        current.end = i - gap;
        runs.push(current);
        current = null;
      }
      continue;
    }

    if (current && sign !== Math.sign(current.total)) {
      current.end = i;
      runs.push(current);
      current = null;
    }

    if (!current) current = { start: i, end: i, total: 0 };
    current.total += t;
    current.end = i;
    gap = 0;
  }

  if (current) runs.push(current);
  return runs;
}

function severityFor(radius: number): number {
  if (radius < 260) return 1;
  if (radius < 340) return 2;
  if (radius < 450) return 3;
  if (radius < 600) return 4;
  if (radius < 850) return 5;
  return 6;
}
