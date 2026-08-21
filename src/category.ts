/**
 * A Categoria: o carro que o jogador escolhe no Grid. Um pacote fechado, não um ajuste.
 *
 * A regra que mantém as três vivas: **quem ganha velocidade perde giro**. Sem ela a A
 * seria estritamente melhor que as outras e ninguém jogaria B ou C. E a velocidade
 * mínima mais alta da A é o que a impede de ser "B com turbo": nela não dá para
 * rastejar numa chicane.
 *
 * O Acelerador (`aimNear`/`aimFar`) e a Zona Morta ficam no TUNING, iguais nas três:
 * se a curva de aceleração mudasse junto, Categoria viraria jogo diferente em vez de
 * carro diferente.
 */
export interface Category {
  id: CategoryId;
  name: string;
  /** Velocidade com o cursor colado no Carro, em px/s. Nunca zero — o Carro não para. */
  speedMin: number;
  /** Velocidade com o cursor esticado, em px/s. */
  speedMax: number;
  /** Taxa de giro máxima, em graus/s. Constante dentro da Corrida. */
  turnRate: number;
  /** O que o jogador precisa saber antes de escolher, em uma linha. */
  blurb: string;
}

export const CATEGORY_IDS = ['A', 'B', 'C'] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const CATEGORIES: Record<CategoryId, Category> = {
  A: {
    id: 'A',
    name: 'Categoria A',
    speedMin: 130,
    speedMax: 560,
    turnRate: 135,
    blurb: 'Rápida e ingovernável. Não desce o suficiente para uma chicane.',
  },
  B: {
    id: 'B',
    name: 'Categoria B',
    speedMin: 110,
    speedMax: 430,
    turnRate: 150,
    blurb: 'Equilibrada. Freia nas fechadas, voa no resto.',
  },
  C: {
    id: 'C',
    name: 'Categoria C',
    speedMin: 110,
    speedMax: 340,
    turnRate: 165,
    blurb: 'Perdoa. Cabe em quase toda curva sem tirar o pé.',
  },
};

/**
 * O raio mínimo que a Categoria consegue fazer a fundo, em px. Comparado com
 * `tightCurveRadius`, é o que diz se aquela curva **obriga** a frear.
 */
export function minTurnRadius(category: Category): number {
  return category.speedMax / ((category.turnRate * Math.PI) / 180);
}

const KEY = 'rally2d.category';

export function readCategory(): CategoryId {
  const raw = localStorage.getItem(KEY);
  return isCategoryId(raw) ? raw : 'B';
}

export function saveCategory(id: CategoryId): void {
  localStorage.setItem(KEY, id);
}

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && (CATEGORY_IDS as readonly string[]).includes(value);
}
