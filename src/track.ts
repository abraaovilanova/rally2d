import { makePath, normalAt, type Path, type Vec } from './path';
import { createRng, seedFromStageId, type Rng } from './rng';
import { TUNING } from './tuning';

export type { Vec } from './path';

/** Pesos do catálogo de Segmentos. Vêm do Bioma; a Escalada os ajusta. */
export interface SegmentWeights {
  straight: number;
  smoothCurve: number;
  tightCurve: number;
  chicane: number;
}

export interface TrackSpec {
  stageId: string;
  width: number;
  /** Comprimento da Pista principal, em px. */
  length: number;
  weights: SegmentWeights;
  branchCount: number;
}

/** Para onde uma Rota Alternativa leva. */
export type RouteKind = 'shortcut' | 'detour' | 'deadEnd';

/**
 * Uma Rota Alternativa: um Caminho que sai da Pista principal numa Bifurcação e
 * ou volta a ela mais adiante, ou termina numa Barreira.
 */
export interface Branch {
  path: Path;
  kind: RouteKind;
  /** Índice na Pista principal onde a Bifurcação começa. */
  forkIndex: number;
  /** Índice na Pista principal onde a Rota reencontra. Nulo num beco sem saída. */
  rejoinIndex: number | null;
  /** -1 sai pela esquerda, 1 pela direita. */
  side: -1 | 1;
  /** Diferença de comprimento contra o trecho equivalente da Pista, em px. */
  delta: number;
}

/**
 * Uma Pista: a rota principal mais as Rotas Alternativas que saem dela.
 * Derivada inteiramente da Semente — a mesma Etapa produz sempre esta mesma Pista.
 */
export interface Track {
  main: Path;
  branches: Branch[];
  width: number;
  step: number;
}

/** Um trecho de linha do meio de curvatura constante. */
interface Command {
  /** 1/raio, com sinal. Zero para reta. */
  curvature: number;
  length: number;
}

const SEGMENT_KINDS = ['straight', 'smoothCurve', 'tightCurve', 'chicane'] as const;
type SegmentKind = (typeof SEGMENT_KINDS)[number];

export function buildTrack(spec: TrackSpec): Track {
  const rng = createRng(seedFromStageId(spec.stageId));
  const step = TUNING.centerlineStep;
  const half = spec.width / 2;

  const center = buildCenterline(spec, rng, step);
  const main = makePath(center, half, step);
  const branches = buildBranches(main, spec, rng, step, half);

  return { main, branches, width: spec.width, step };
}

function buildCenterline(spec: TrackSpec, rng: Rng, step: number): Vec[] {
  const maxHeading = (TUNING.maxHeading * Math.PI) / 180;
  const commands: Command[] = [{ curvature: 0, length: TUNING.runInLength }];
  let planned = TUNING.runInLength;
  let headingGuess = 0;

  const weights = SEGMENT_KINDS.map((k) => spec.weights[k]);

  while (planned < spec.length) {
    const kind: SegmentKind = rng.weighted(SEGMENT_KINDS, weights);

    // Se a linha do meio já está inclinada, a próxima curva puxa de volta para o eixo.
    // Sem isso a Pista sobe ou desce indefinidamente e deixa de correr da esquerda para a direita.
    const bias = headingGuess > maxHeading * 0.5 ? -1 : headingGuess < -maxHeading * 0.5 ? 1 : 0;
    const dir = bias !== 0 ? bias : rng.next() < 0.5 ? -1 : 1;

    for (const cmd of makeSegment(kind, dir, rng)) {
      commands.push(cmd);
      planned += cmd.length;
      headingGuess += cmd.curvature * cmd.length;
    }

    const breather = { curvature: 0, length: rng.range(80, 220) };
    commands.push(breather);
    planned += breather.length;
  }

  return walk(commands, step, spec.length, maxHeading);
}

function makeSegment(kind: SegmentKind, dir: number, rng: Rng): Command[] {
  switch (kind) {
    case 'straight':
      return [{ curvature: 0, length: rng.range(250, 700) }];

    case 'smoothCurve': {
      const radius = rng.range(...TUNING.smoothCurveRadius);
      const arc = rng.range(25, 60);
      return [{ curvature: dir / radius, length: (arc * Math.PI * radius) / 180 }];
    }

    case 'tightCurve': {
      // Abaixo do raio de giro do Carro na velocidade máxima, de propósito: é o que
      // obriga o jogador a frear em vez de correr a pista inteira a fundo.
      const radius = rng.range(...TUNING.tightCurveRadius);
      const arc = rng.range(...TUNING.tightCurveArc);
      return [{ curvature: dir / radius, length: (arc * Math.PI * radius) / 180 }];
    }

    case 'chicane': {
      const radius = rng.range(...TUNING.chicaneRadius);
      const arc = rng.range(30, 50);
      const len = (arc * Math.PI * radius) / 180;
      return [
        { curvature: dir / radius, length: len },
        { curvature: 0, length: rng.range(40, 120) },
        { curvature: -dir / radius, length: len },
      ];
    }
  }
}

function walk(commands: Command[], step: number, targetLength: number, maxHeading: number): Vec[] {
  const points: Vec[] = [{ x: 0, y: 0 }];
  let heading = 0;
  let x = 0;
  let y = 0;
  let travelled = 0;

  for (const cmd of commands) {
    const steps = Math.max(1, Math.round(cmd.length / step));
    for (let i = 0; i < steps; i++) {
      heading = clamp(heading + cmd.curvature * step, -maxHeading, maxHeading);
      x += Math.cos(heading) * step;
      y += Math.sin(heading) * step;
      points.push({ x, y });
      travelled += step;
      if (travelled >= targetLength) return points;
    }
  }

  return points;
}

/**
 * As Rotas Alternativas são deslocamentos laterais da própria Pista, com um perfil que
 * é zero *e tem derivada zero* nas duas pontas — por isso elas saem e reencontram
 * tangencialmente, sem um bico na junção.
 *
 * Deslocar para fora de uma curva alonga a Rota; deslocar para dentro a encurta. É daí
 * que saem naturalmente o desvio e o atalho, sem precisar de dois geradores.
 */
function buildBranches(main: Path, spec: TrackSpec, rng: Rng, step: number, half: number): Branch[] {
  const n = main.center.length;
  const margin = 260;
  const candidates: Branch[] = [];

  const radii = localRadii(main.center, step);

  // Gera candidatos dos dois lados e **mede** cada um. Deslocar para fora alonga sempre;
  // deslocar para dentro de uma curva sustentada encurta. Medir é mais barato do que
  // tentar prever qual dos dois um trecho qualquer vai produzir.
  for (let attempt = 0; attempt < 600; attempt++) {
    const span = Math.round(rng.range(80, 230));
    const fork = Math.round(rng.range(margin, n - margin - span));
    const rejoin = fork + span;

    // Bifurcação só em trecho suave. Deslocar uma curva para dentro mais do que o seu
    // próprio raio faz o traçado dobrar sobre si mesmo e produz uma Rota impossível —
    // e uma Bifurcação no meio de uma curva fechada seria ilegível de qualquer forma.
    const tightest = minIn(radii, fork, rejoin);
    if (tightest < TUNING.branchMinSectionRadius) continue;

    for (const side of [-1, 1] as const) {
      // Amplitude sempre maior que a largura: senão a Rota corre inteira dentro da
      // Pista e a "Bifurcação" não separa nada. O que impede um traçado dobrado não é
      // um limite de amplitude, e sim a verificação de dirigibilidade logo abaixo —
      // ela reprova o lado de dentro quando a curva é fechada demais para comportá-lo.
      const amplitude = spec.width * rng.range(1.3, 2.4);
      const path = makePath(offsetSection(main.center, fork, rejoin, side, amplitude), half, step);
      const delta = path.length - (rejoin - fork) * step;

      // Uma Rota que mal difere da Pista não é uma decisão — é ruído.
      if (Math.abs(delta) < spec.width * 0.6) continue;

      // A verificação que de fato importa: a Rota tem de ser dirigível.
      if (minIn(localRadii(path.center, step), 1, path.center.length - 2) < TUNING.branchMinRouteRadius) {
        continue;
      }

      candidates.push({
        path,
        kind: delta < 0 ? 'shortcut' : 'detour',
        forkIndex: fork,
        rejoinIndex: rejoin,
        side,
        delta,
      });
    }
  }

  return pickBranches(candidates, spec.branchCount);
}

/**
 * Escolhe as Bifurcações que não se sobrepõem, priorizando um atalho.
 *
 * Sem essa reserva, quase toda Rota gerada seria um desvio mais longo — e aí a placa
 * só teria uma resposta possível, o que não é uma decisão.
 */
function pickBranches(candidates: Branch[], count: number): Branch[] {
  const chosen: Branch[] = [];
  const overlaps = (b: Branch) =>
    chosen.some((c) => b.forkIndex < (c.rejoinIndex ?? c.forkIndex) + 60 && c.forkIndex - 60 < (b.rejoinIndex ?? b.forkIndex));

  const shortcuts = candidates.filter((b) => b.kind === 'shortcut').sort((a, b) => a.delta - b.delta);
  const detours = candidates.filter((b) => b.kind === 'detour').sort((a, b) => b.delta - a.delta);

  for (const branch of shortcuts) {
    if (chosen.length >= 1) break;
    if (!overlaps(branch)) chosen.push(branch);
  }

  for (const branch of detours) {
    if (chosen.length >= count) break;
    if (!overlaps(branch)) chosen.push(branch);
  }

  return chosen.sort((a, b) => a.forkIndex - b.forkIndex);
}

/** Raio de curvatura da linha do meio em cada ponto. Infinito nas retas. */
function localRadii(center: Vec[], step: number): number[] {
  const radii = new Array<number>(center.length).fill(Infinity);

  for (let i = 1; i < center.length - 1; i++) {
    const h1 = Math.atan2(center[i].y - center[i - 1].y, center[i].x - center[i - 1].x);
    const h2 = Math.atan2(center[i + 1].y - center[i].y, center[i + 1].x - center[i].x);
    const turn = Math.abs(Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1)));
    if (turn > 1e-9) radii[i] = step / turn;
  }

  return radii;
}

function minIn(values: number[], from: number, to: number): number {
  let min = Infinity;
  for (let i = from; i <= to; i++) if (values[i] < min) min = values[i];
  return min;
}

/** Desloca lateralmente um trecho da Pista com um perfil sin², suave nas duas pontas. */
function offsetSection(
  center: Vec[],
  from: number,
  to: number,
  side: -1 | 1,
  amplitude: number,
): Vec[] {
  const out: Vec[] = [];

  for (let i = from; i <= to; i++) {
    const t = (i - from) / (to - from);
    const profile = Math.sin(Math.PI * t) ** 2;
    const nrm = normalAt(center, i);
    out.push({
      x: center[i].x + nrm.x * side * amplitude * profile,
      y: center[i].y + nrm.y * side * amplitude * profile,
    });
  }

  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
