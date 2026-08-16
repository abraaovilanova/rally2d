import { driveCar, spawnCar, type Car } from './car';
import { readCarColor, saveCarColor, type CarColor } from './carSprite';
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

export type Phase = 'running' | 'crashed' | 'finished';

export interface Game {
  progression: Progression;
  /** Preferência do jogador, não estado da Corrida. */
  carColor: CarColor;
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

/** Retoma a Progressão de onde o jogador parou. */
export function createGame(): Game {
  const progression = loadProgression();
  const stage = makeStage(progression.biomeIndex, progression.lap);

  const game: Game = {
    progression,
    carColor: readCarColor(),
    stage,
    car: startingCar(stage),
    aim: { x: 0, y: 0 },
    phase: 'running',
    elapsed: 0,
    route: { ...START_ROUTE },
    hitBarrier: false,
    attempts: 1,
    bestTime: readBestTime(stage.id),
    newRecord: false,
  };

  resetRace(game);
  return game;
}

/** Nova Tentativa na mesma Etapa. Uma Batida nunca faz retroceder na Progressão. */
export function retry(game: Game): void {
  const attempts = game.attempts + 1;
  resetRace(game);
  game.attempts = attempts;
}

/** Avança para a próxima Etapa. Só uma Conclusão chega aqui. */
export function advance(game: Game): void {
  game.progression = nextOf(game.progression);
  saveProgression(game.progression);
  enterStage(game, makeStage(game.progression.biomeIndex, game.progression.lap));
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
  game.bestTime = readBestTime(stage.id);
  resetRace(game);
}

function resetRace(game: Game): void {
  game.car = startingCar(game.stage);
  game.aim = { x: game.car.x, y: game.car.y };
  game.phase = 'running';
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
  driveCar(game.car, aim, dt);

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
    game.newRecord = recordTime(game.stage.id, game.elapsed);
    game.bestTime = readBestTime(game.stage.id);
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

function startingCar(stage: Stage): Car {
  const [a, b] = stage.track.main.center;
  return spawnCar(a, Math.atan2(b.y - a.y, b.x - a.x));
}
