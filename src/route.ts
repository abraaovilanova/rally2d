import { probePath, probeRange, type Path, type Probe, type Vec } from './path';
import type { Track } from './track';

/**
 * Em qual Caminho o Carro está e onde nele.
 * `branch` nulo significa a Pista principal.
 */
export interface Route {
  branch: number | null;
  index: number;
}

export const START_ROUTE: Route = { branch: null, index: 0 };

export function pathOf(track: Track, route: Route): Path {
  return route.branch === null ? track.main : track.branches[route.branch].path;
}

export interface RouteStep {
  route: Route;
  probe: Probe;
  /** O Carro terminou uma Rota Alternativa que reencontra a Pista. */
  rejoined: boolean;
  /** O Carro chegou ao fim de um beco sem saída. */
  hitBarrier: boolean;
  /** O Carro cruzou a Linha de Chegada da Pista principal. */
  finished: boolean;
}

/**
 * Avança o Carro no grafo de Caminhos.
 *
 * O Carro **permanece** no Caminho em que está enquanto estiver dentro das bordas dele.
 * Só quando sai é que procuramos um Caminho vizinho que ainda o contenha — e se nenhum
 * contém, é Batida.
 *
 * A regra ingênua de "está no Caminho cuja linha do meio estiver mais perto" não serve:
 * perto da Bifurcação a linha da Rota Alternativa ainda corre *dentro* da Pista, e quem
 * faz a curva colado naquele lado seria levado para o desvio sem ter escolhido.
 *
 * `limit` é a distância à linha do meio a partir da qual o Carro está fora do Caminho.
 */
export function stepRoute(
  track: Track,
  pos: Vec,
  route: Route,
  maxAdvance: number,
  limit: number,
): RouteStep {
  const current = pathOf(track, route);
  let best = { branch: route.branch, probe: probePath(current, pos, route.index, maxAdvance) };

  if (best.probe.distance > limit) {
    for (const option of neighbours(track, pos, route)) {
      if (option.probe.distance < best.probe.distance) best = option;
    }
  }

  const next: Route = { branch: best.branch, index: best.probe.index };
  const path = pathOf(track, next);
  const atEnd = next.index >= path.center.length - 2;

  if (next.branch !== null && atEnd) {
    const branch = track.branches[next.branch];
    if (branch.rejoinIndex === null) {
      return { route: next, probe: best.probe, rejoined: false, hitBarrier: true, finished: false };
    }
    return {
      route: { branch: null, index: branch.rejoinIndex },
      probe: best.probe,
      rejoined: true,
      hitBarrier: false,
      finished: false,
    };
  }

  return {
    route: next,
    probe: best.probe,
    rejoined: false,
    hitBarrier: false,
    finished: next.branch === null && atEnd,
  };
}

/**
 * Os Caminhos que o Carro poderia estar ocupando em vez do atual: as Rotas cuja
 * Bifurcação ele está atravessando, ou a Pista, se ele está na boca de uma Rota.
 */
function neighbours(track: Track, pos: Vec, route: Route): { branch: number | null; probe: Probe }[] {
  const options: { branch: number | null; probe: Probe }[] = [];

  if (route.branch === null) {
    track.branches.forEach((branch, i) => {
      const offset = route.index - branch.forkIndex;
      if (offset < -10 || offset > branch.path.center.length) return;
      options.push({ branch: i, probe: probeRange(branch.path, pos, 0, branch.path.center.length - 2) });
    });
  } else {
    const branch = track.branches[route.branch];
    const rejoin = branch.rejoinIndex ?? branch.forkIndex;
    options.push({
      branch: null,
      probe: probeRange(track.main, pos, branch.forkIndex - 10, rejoin + 10),
    });
  }

  return options;
}

/** Quanto da Pista principal já foi vencido, de 0 a 1. Rotas Alternativas interpolam. */
export function progressOf(track: Track, route: Route): number {
  const total = track.main.center.length - 1;
  if (route.branch === null) return route.index / total;

  const branch = track.branches[route.branch];
  const end = branch.rejoinIndex ?? branch.forkIndex;
  const t = route.index / Math.max(1, branch.path.center.length - 1);
  return (branch.forkIndex + t * (end - branch.forkIndex)) / total;
}

/**
 * O Carro está numa Rota pior que a Pista, além do ponto em que isso fica visível.
 * Um atalho nunca conta como fora de rota — ele é a recompensa por ler a placa.
 */
export function isOffRoute(track: Track, route: Route, revealAt: number): boolean {
  if (route.branch === null) return false;

  const branch = track.branches[route.branch];
  if (branch.kind === 'shortcut') return false;

  return route.index / Math.max(1, branch.path.center.length - 1) > revealAt;
}
