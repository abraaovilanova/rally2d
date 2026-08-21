import { driveCar, spawnCar, type Car } from './car';
import { readCarColor, saveCarColor, type CarColor } from './carSprite';
import { CATEGORIES, readCategory, saveCategory, type Category, type CategoryId } from './category';
import { saveMode, type Mode } from './player';
import {
  loadProgression,
  nextOf,
  resetProgression,
  saveProgression,
  type Progression,
} from './progression';
import { readBestTime, recordTime } from './records';
import { makeStage, type Stage } from './stage';
import type { Vec } from './path';
import { pathOf, progressOf, START_ROUTE, stepRoute, type Route } from './route';
import { TUNING } from './tuning';

/**
 * A Corrida não começa sozinha: nasce do Grid. Uma Batida devolve o jogador direto à
 * largada, sem passar por ele — repetir a Tentativa não é uma decisão, é um reflexo.
 */
export type Phase = 'grid' | 'running' | 'crashed' | 'finished';

export interface Game {
  progression: Progression;
  /** Preferência do jogador, não estado da Corrida. */
  carColor: CarColor;
  /** O carro desta Corrida. Trocar de Categoria recomeça a Corrida. */
  category: CategoryId;
  /** Online só adiciona o Ranking Mundial; nada do jogo depende de rede. */
  mode: Mode;
  stage: Stage;
  car: Car;
  /** Ponto de Mira: a posição do cursor no mundo, na última atualização. */
  aim: Vec;
  phase: Phase;
  /** Tempo decorrido da Corrida atual, em segundos. */
  elapsed: number;
  /** Em qual Caminho o Carro está e onde nele. */
  route: Route;
  /** O Carro bateu numa Barreira de beco sem saída, e não na Borda da Pista. */
  hitBarrier: boolean;
  /** Tentativas nesta Etapa. Zera ao avançar de Etapa. */
  attempts: number;
  bestTime: number | null;
  /** A última Corrida concluída bateu o recorde? */
  newRecord: boolean;
}

/** O carro desta Corrida, resolvido. */
export function categoryOf(game: Game): Category {
  return CATEGORIES[game.category];
}

/** Retoma a Progressão de onde o jogador parou, parado no Grid da Etapa atual. */
export function createGame(mode: Mode): Game {
  const progression = loadProgression();
  const stage = makeStage(progression.biomeIndex, progression.lap);

  const game: Game = {
    progression,
    carColor: readCarColor(),
    category: readCategory(),
    mode,
    stage,
    car: startingCar(stage, CATEGORIES[readCategory()]),
    aim: { x: 0, y: 0 },
    phase: 'grid',
    elapsed: 0,
    route: { ...START_ROUTE },
    hitBarrier: false,
    attempts: 1,
    bestTime: null,
    newRecord: false,
  };

  resetRace(game, 'grid');
  return game;
}

/** Larga: a única transição que sai do Grid. */
export function startRace(game: Game): void {
  if (game.phase !== 'grid') return;
  game.phase = 'running';
  game.elapsed = 0;
}

/** Volta ao Grid de propósito, para trocar de Categoria ou de Modo sem bater. */
export function openGrid(game: Game): void {
  resetRace(game, 'grid');
}

export function setMode(game: Game, mode: Mode): void {
  game.mode = mode;
  saveMode(mode);
}

/**
 * Um Tempo pertence à Categoria com que foi feito, do começo ao fim: trocar no meio de
 * uma Corrida a joga fora e recomeça. A Progressão não é afetada — a Categoria é o carro
 * do momento, e o progresso é do jogador.
 */
export function setCategory(game: Game, category: CategoryId): void {
  if (game.category === category) return;
  game.category = category;
  saveCategory(category);

  const attempts = game.attempts;
  resetRace(game, game.phase === 'grid' ? 'grid' : 'running');
  game.attempts = attempts;
}

/** Nova Tentativa na mesma Etapa. Uma Batida nunca faz retroceder na Progressão. */
export function retry(game: Game): void {
  const attempts = game.attempts + 1;
  resetRace(game, 'running');
  game.attempts = attempts;
}

/** Avança para a próxima Etapa. Só uma Conclusão chega aqui. */
export function advance(game: Game): void {
  game.progression = nextOf(game.progression);
  saveProgression(game.progression);
  enterStage(game, makeStage(game.progression.biomeIndex, game.progression.lap));
}

/**
 * Escolhe a Etapa direto no Grid. Mexe na Progressão porque ela é uma só: o jogador não
 * fica com um lugar onde estava e outro onde está correndo — daqui em diante a sequência
 * segue da Etapa escolhida. Os Melhores Tempos ficam, cada um na sua Etapa.
 */
export function selectStage(game: Game, biomeIndex: number, lap: number): void {
  if (game.progression.biomeIndex === biomeIndex && game.progression.lap === lap) return;
  game.progression = { biomeIndex, lap };
  saveProgression(game.progression);
  enterStage(game, makeStage(biomeIndex, lap));
}

/** Volta ao início da sequência, preservando os Melhores Tempos. */
export function restartProgression(game: Game): void {
  game.progression = resetProgression();
  enterStage(game, makeStage(game.progression.biomeIndex, game.progression.lap));
}

export function setCarColor(game: Game, color: CarColor): void {
  game.carColor = color;
  saveCarColor(color);
}

function enterStage(game: Game, stage: Stage): void {
  game.stage = stage;
  resetRace(game, 'grid');
}

function resetRace(game: Game, phase: Phase): void {
  game.bestTime = readBestTime(game.stage.id, game.category);
  game.car = startingCar(game.stage, categoryOf(game));
  game.aim = { x: game.car.x, y: game.car.y };
  game.phase = phase;
  game.elapsed = 0;
  game.route = { ...START_ROUTE };
  game.hitBarrier = false;
  game.attempts = 1;
  game.newRecord = false;
}

export function updateGame(game: Game, aim: Vec, dt: number): void {
  if (game.phase !== 'running') return;

  game.elapsed += dt;
  game.aim = aim;
  driveCar(game.car, aim, dt, categoryOf(game));

  // O progresso só pode avançar o que o Carro de fato andou neste quadro. A folga extra
  // cobre as Rotas Alternativas, cujos pontos ficam um pouco mais espaçados que o passo.
  const maxAdvance = Math.ceil((game.car.speed * dt) / game.stage.track.step) + 3;
  const limit = game.stage.track.width / 2 - TUNING.carRadius;
  const step = stepRoute(game.stage.track, game.car, game.route, maxAdvance, limit);
  game.route = step.route;

  if (step.hitBarrier) {
    game.phase = 'crashed';
    game.hitBarrier = true;
    return;
  }

  // Batida: o Carro saiu do Caminho em que estava e nenhum vizinho o contém.
  if (step.probe.distance > limit) {
    game.phase = 'crashed';
    return;
  }

  // Conclusão: única forma de produzir um Tempo.
  if (step.finished) {
    game.phase = 'finished';
    game.newRecord = recordTime(game.stage.id, game.category, game.elapsed);
    game.bestTime = readBestTime(game.stage.id, game.category);
  }
}

/** Quanto da Etapa já foi vencido, de 0 a 1. */
export function progress(game: Game): number {
  return progressOf(game.stage.track, game.route);
}

/** O Caminho em que o Carro está agora. */
export function currentPath(game: Game) {
  return pathOf(game.stage.track, game.route);
}

function startingCar(stage: Stage, category: Category): Car {
  const [a, b] = stage.track.main.center;
  return spawnCar(a, Math.atan2(b.y - a.y, b.x - a.x), category);
}
