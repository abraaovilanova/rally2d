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
  /**
   * A Borda da Pista freia em vez de matar: tocá-la é **Escapada**, não **Batida** — e a
   * Escapada tem prazo. Ver `docs/adr/0006`.
   */
  runoff: boolean;
}

export const CATEGORY_IDS = ['S', 'A', 'B', 'C'] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const CATEGORIES: Record<CategoryId, Category> = {
  /**
   * O carro é o da A, número por número. A Shakedown não é um carro mais fácil — é a
   * mesma máquina numa prova em que sair da Pista ainda dá para consertar, e só por
   * dez segundos. É por isso que ela não vale Ranking: o carro é igual, a prova não.
   */
  S: {
    id: 'S',
    name: 'Shakedown',
    speedMin: 130,
    speedMax: 560,
    turnRate: 135,
    blurb: 'O carro da A. A borda não mata — mas você tem 10s para voltar.',
    runoff: true,
  },
  A: {
    id: 'A',
    name: 'Categoria A',
    speedMin: 130,
    speedMax: 560,
    turnRate: 135,
    blurb: 'Rápida e ingovernável. Não desce o suficiente para uma chicane.',
    runoff: false,
  },
  B: {
    id: 'B',
    name: 'Categoria B',
    speedMin: 110,
    speedMax: 430,
    turnRate: 150,
    blurb: 'Equilibrada. Freia nas fechadas, voa no resto.',
    runoff: false,
  },
  C: {
    id: 'C',
    name: 'Categoria C',
    speedMin: 110,
    speedMax: 340,
    turnRate: 165,
    blurb: 'Perdoa. Cabe em quase toda curva sem tirar o pé.',
    runoff: false,
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
