import type { Category } from './category';
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

export function spawnCar(at: Vec, heading: number, category: Category): Car {
  return { x: at.x, y: at.y, heading, speed: category.speedMin };
}

/**
 * O Ponto de Mira carrega os dois controles do jogo: a **direção** que o Carro tenta
 * alcançar, e — pela sua distância ao Carro — a **velocidade**. Cursor esticado é
 * acelerador, cursor colado é freio.
 *
 * O Carro nunca gira mais rápido que a taxa máxima, então quanto mais rápido ele vai,
 * mais aberta fica a curva que ele consegue fazer. É daí que vem a tensão da corrida.
 */
export function driveCar(car: Car, aim: Vec, dt: number, category: Category): void {
  const dx = aim.x - car.x;
  const dy = aim.y - car.y;
  const distance = Math.hypot(dx, dy);

  car.speed = speedFor(distance, category);

  // Dentro da zona morta o vetor de mira é curto demais para ter um ângulo confiável:
  // o Carro segue reto e o jogador controla só a velocidade.
  if (distance > TUNING.aimDeadzone) {
    const wanted = Math.atan2(dy, dx);
    const maxTurn = ((category.turnRate * Math.PI) / 180) * dt;
    const delta = shortestAngle(wanted - car.heading);
    car.heading += Math.max(-maxTurn, Math.min(maxTurn, delta));
  }

  car.x += Math.cos(car.heading) * car.speed * dt;
  car.y += Math.sin(car.heading) * car.speed * dt;
}

/** 0 na velocidade mínima, 1 na máxima. Útil para o HUD. */
export function throttleOf(car: Car, category: Category): number {
  return (car.speed - category.speedMin) / (category.speedMax - category.speedMin);
}

function speedFor(distance: number, category: Category): number {
  const t = clamp01((distance - TUNING.aimNear) / (TUNING.aimFar - TUNING.aimNear));
  return category.speedMin + t * (category.speedMax - category.speedMin);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function shortestAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
