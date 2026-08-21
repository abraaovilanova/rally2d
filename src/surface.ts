import { normalAt } from './path';
import { createRng, seedFromStageId } from './rng';
import type { Stage } from './stage';
import { TUNING } from './tuning';

/**
 * A Aderência: quanto do que o volante pede o chão devolve.
 *
 * Aderência 1 é o chão seco — a direção que o Carro aponta e a que ele percorre são a
 * mesma, como sempre foram. Abaixo de 1 elas se separam: o Carro vira na hora, o
 * deslocamento demora a acompanhar, e o que sobra é Derrapagem.
 *
 * Duas coisas tiram Aderência, e são coisas diferentes: a **Poça**, que é um lugar
 * dentro de uma Etapa, e o Bioma inteiro, que é o caso do Gelo. Uma Poça é uma decisão
 * — dá para desviar; o Gelo não é — é a Etapa.
 */

/** Um lugar da Etapa onde a Aderência cai. Existe onde o Bioma tem Poças. */
export interface Puddle {
  x: number;
  y: number;
  radius: number;
  /** Poça é redonda demais para parecer água; isto a achata na direção da Pista. */
  angle: number;
  stretch: number;
}

const byStage = new Map<string, Puddle[]>();

/** As Poças de uma Etapa. Saem da Semente: a Etapa é sempre igual a si mesma. */
export function puddlesOf(stage: Stage): Puddle[] {
  const cached = byStage.get(stage.id);
  if (cached) return cached;

  const puddles = stage.biome.puddles ? buildPuddles(stage) : [];
  byStage.set(stage.id, puddles);
  return puddles;
}

/**
 * A Aderência do chão num ponto: a do Bioma, e a da Poça quando o ponto está dentro de
 * uma. Vale a menor das duas — uma Poça sobre o Gelo não devolveria Aderência.
 */
export function gripAt(stage: Stage, x: number, y: number): number {
  const base = stage.biome.grip;

  for (const puddle of puddlesOf(stage)) {
    if (inside(puddle, x, y)) return Math.min(base, TUNING.puddleGrip);
  }

  return base;
}

/** Dentro da elipse da Poça. */
export function inside(puddle: Puddle, x: number, y: number): boolean {
  const dx = x - puddle.x;
  const dy = y - puddle.y;
  const cos = Math.cos(-puddle.angle);
  const sin = Math.sin(-puddle.angle);
  const u = (dx * cos - dy * sin) / (puddle.radius * puddle.stretch);
  const v = (dx * sin + dy * cos) / puddle.radius;
  return u * u + v * v <= 1;
}

/**
 * Poças nascem **sobre** a Pista, ao contrário dos objetos de Cenário, que a evitam: uma
 * Poça que dá para passar ao largo sem sair da linha não é uma decisão. Ficam deslocadas
 * do meio de propósito — o preço de desviar tem de ser ir para a borda.
 */
function buildPuddles(stage: Stage): Puddle[] {
  const center = stage.track.main.center;
  const rng = createRng(seedFromStageId(`${stage.id}-pocas`));
  const puddles: Puddle[] = [];

  const last = center.length - 1;
  // A largada tem de estar limpa: bater na primeira curva por causa de algo que já
  // estava lá quando o jogador largou não é uma Corrida perdida, é uma emboscada.
  for (let i = 120; i < last - 40; i += TUNING.puddleSpacing) {
    if (rng.next() > TUNING.puddleChance) continue;

    const radius = rng.range(TUNING.puddleRadius[0], TUNING.puddleRadius[1]);
    const n = normalAt(center, i);
    // Nunca cobre a Pista inteira: sempre sobra um lado por onde passar.
    const away = rng.range(0.15, 0.5) * stage.track.width * (rng.next() < 0.5 ? -1 : 1);
    const a = center[Math.max(0, i - 1)];
    const b = center[i];

    puddles.push({
      x: b.x + n.x * away,
      y: b.y + n.y * away,
      radius,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      stretch: rng.range(1.3, 2.1),
    });
  }

  return puddles;
}
