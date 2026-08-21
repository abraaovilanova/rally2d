import type { Car } from './car';
import { slipOf } from './car';
import { TUNING } from './tuning';

/**
 * A Poeira: o rastro que o Carro levanta do chão.
 *
 * É decoração pura — não muda nada do modelo — mas é o que dá peso ao que já existe: a
 * velocidade só se lê como velocidade quando alguma coisa reage a ela, e a Derrapagem só
 * se lê como Derrapagem quando o chão sai voando de lado.
 *
 * Um sopro é um sprite só, que nasce pequeno e opaco e morre grande e transparente. Não
 * há folha de animação: o desenho da nuvem é o mesmo, o que anima é o tempo.
 */

export interface Sopro {
  x: number;
  y: number;
  /** Para onde o sopro se afasta, em px/s. Herda um pouco do Carro e um pouco do acaso. */
  vx: number;
  vy: number;
  /** Idade em segundos. Passou da vida, morreu. */
  idade: number;
  vida: number;
  /** Tamanho na tela em px, no nascimento. */
  tamanho: number;
  giro: number;
}

/**
 * Quantos sopros cabem ao mesmo tempo. É um anel: o mais velho é o que dá lugar ao novo,
 * então não há alocação no meio da Corrida nem lista crescendo sem teto.
 */
const TETO = 96;

const anel: Sopro[] = [];
let proximo = 0;
let acumulado = 0;

export function limparPoeira(): void {
  anel.length = 0;
  proximo = 0;
  acumulado = 0;
}

export function sopros(): readonly Sopro[] {
  return anel;
}

/**
 * Nasce poeira atrás do Carro, em quantidade proporcional ao que ele está fazendo com o
 * chão: velocidade levanta pouco, Derrapagem levanta muito. Aderência baixa levanta mais
 * ainda — é o mesmo chão solto que faz escorregar.
 */
export function emitirPoeira(car: Car, aderencia: number, velocidadeMax: number, dt: number): void {
  const rapido = Math.min(1, car.speed / velocidadeMax);
  const derrapando = Math.min(1, Math.abs(slipOf(car)) / 0.6);
  const solto = 1 - aderencia;

  const forca = rapido * 0.35 + derrapando * 0.9 + solto * 0.5;
  if (forca < 0.12) return;

  acumulado += forca * TUNING.poeiraPorSegundo * dt;

  while (acumulado >= 1) {
    acumulado -= 1;
    nascer(car, forca);
  }
}

function nascer(car: Car, forca: number): void {
  // Sai de trás do Carro, do ponto por onde o pneu passou — não do meio dele.
  const atras = -TUNING.carScreenSize * 0.32;
  const lado = (Math.random() - 0.5) * TUNING.carScreenSize * 0.45;
  const cos = Math.cos(car.drift);
  const sen = Math.sin(car.drift);

  const sopro: Sopro = {
    x: car.x + cos * atras - sen * lado,
    y: car.y + sen * atras + cos * lado,
    // Empurrada para trás e para os lados: é o ar que o Carro deixou girando.
    vx: -cos * TUNING.poeiraRecuo + (Math.random() - 0.5) * 40,
    vy: -sen * TUNING.poeiraRecuo + (Math.random() - 0.5) * 40,
    idade: 0,
    vida: TUNING.poeiraVida * (0.7 + Math.random() * 0.6),
    tamanho: TUNING.poeiraTamanho * (0.6 + forca * 0.7) * (0.8 + Math.random() * 0.4),
    giro: Math.random() * Math.PI * 2,
  };

  if (anel.length < TETO) {
    anel.push(sopro);
  } else {
    anel[proximo] = sopro;
    proximo = (proximo + 1) % TETO;
  }
}

/** Envelhece a poeira. O sopro desacelera: ele não tem motor, só a inércia que ganhou. */
export function moverPoeira(dt: number): void {
  const freio = Math.exp(-dt * 2.4);

  for (const s of anel) {
    if (s.idade >= s.vida) continue;
    s.idade += dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vx *= freio;
    s.vy *= freio;
  }
}
