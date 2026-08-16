import { TUNING } from './tuning';
import type { Vec } from './track';

export interface Car {
  x: number;
  y: number;
  /** A direção que o Carro *tem*, em radianos. */
  heading: number;
  /** Velocidade atual, em px/s. Derivada da distância do Ponto de Mira. */
  speed: number;
}

export function spawnCar(at: Vec, heading: number): Car {
  return { x: at.x, y: at.y, heading, speed: TUNING.carSpeedMin };
}

/**
 * O Ponto de Mira carrega os dois controles do jogo: a **direção** que o Carro tenta
 * alcançar, e — pela sua distância ao Carro — a **velocidade**. Cursor esticado é
 * acelerador, cursor colado é freio.
 *
 * O Carro nunca gira mais rápido que a taxa máxima, então quanto mais rápido ele vai,
 * mais aberta fica a curva que ele consegue fazer. É daí que vem a tensão da corrida.
 */
export function driveCar(car: Car, aim: Vec, dt: number): void {
  const dx = aim.x - car.x;
  const dy = aim.y - car.y;
  const distance = Math.hypot(dx, dy);

  car.speed = speedFor(distance);

  // Dentro da zona morta o vetor de mira é curto demais para ter um ângulo confiável:
  // o Carro segue reto e o jogador controla só a velocidade.
  if (distance > TUNING.aimDeadzone) {
    const wanted = Math.atan2(dy, dx);
    const maxTurn = ((TUNING.carTurnRate * Math.PI) / 180) * dt;
    const delta = shortestAngle(wanted - car.heading);
    car.heading += Math.max(-maxTurn, Math.min(maxTurn, delta));
  }

  car.x += Math.cos(car.heading) * car.speed * dt;
  car.y += Math.sin(car.heading) * car.speed * dt;
}

/** 0 na velocidade mínima, 1 na máxima. Útil para o HUD. */
export function throttleOf(car: Car): number {
  return (car.speed - TUNING.carSpeedMin) / (TUNING.carSpeedMax - TUNING.carSpeedMin);
}

function speedFor(distance: number): number {
  const t = clamp01((distance - TUNING.aimNear) / (TUNING.aimFar - TUNING.aimNear));
  return TUNING.carSpeedMin + t * (TUNING.carSpeedMax - TUNING.carSpeedMin);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function shortestAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
