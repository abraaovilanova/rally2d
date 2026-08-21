import { createRng, seedFromStageId } from './rng';
import type { Stage } from './stage';

/**
 * O Terreno: o chão de um Bioma fora da Pista.
 *
 * Não é uma textura só repetida — era, e a repetição era o que se enxergava. São tipos de
 * chão que se encostam, com a passagem de um para o outro **desenhada** num tileset de
 * canto (Wang), e as manchas saem da Semente: mesma Etapa, mesmo chão, sempre.
 *
 * Terreno não é Pista. Não tem Borda, e pisar nele não é nada — não se chega nele sem já
 * ter batido. Por isso ele pode ser puro desenho, sem uma linha sequer no modelo.
 */

/**
 * Quantos tipos de chão um Bioma encosta é decidido pelo Bioma: um tileset desenha a
 * transição entre **dois** terrenos, então N tilesets dão N+1 tipos de chão.
 *
 * Os níveis são **encaixados**, não vizinhos quaisquer: o nível 2 só aparece dentro de
 * regiões do nível 1, porque todos saem de faixas do mesmo campo contínuo. É isso que
 * garante que só existam encontros entre níveis vizinhos — os únicos para os quais há
 * transição desenhada. Um encontro 0–2 exigiria um tileset que ninguém gerou.
 */
const FAIXAS: Record<number, number[]> = {
  1: [0.55],
  2: [0.42, 0.72],
  3: [0.36, 0.6, 0.8],
};

/** Tamanho da célula do Terreno em pixels de mundo. Uma célula = um ladrilho. */
export const CELULA = 96;

/**
 * Ruído de valor: um sorteio por vértice da grade, interpolado suavemente entre eles.
 *
 * É o mais simples que produz manchas em vez de chuvisco, e é determinístico a partir da
 * Semente — que é o que a Etapa exige de tudo que a compõe.
 */
function ruidoBruto(semente: number, x: number, y: number): number {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(semente, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

const suave = (t: number) => t * t * (3 - 2 * t);

/** O campo contínuo, em coordenadas de célula. Duas oitavas bastam para a mancha. */
function campo(semente: number, cx: number, cy: number): number {
  let total = 0;
  let peso = 0;

  for (const [escala, forca] of [
    [0.14, 1],
    [0.37, 0.45],
  ]) {
    const x = cx * escala;
    const y = cy * escala;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = suave(x - x0);
    const fy = suave(y - y0);

    const a = ruidoBruto(semente, x0, y0);
    const b = ruidoBruto(semente, x0 + 1, y0);
    const c = ruidoBruto(semente, x0, y0 + 1);
    const d = ruidoBruto(semente, x0 + 1, y0 + 1);

    total += forca * (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy);
    peso += forca;
  }

  return total / peso;
}

const sementes = new Map<string, number>();

function sementeDe(stage: Stage): number {
  const cache = sementes.get(stage.id);
  if (cache !== undefined) return cache;
  const semente = createRng(seedFromStageId(`${stage.id}-terreno`)).next() * 2 ** 31;
  sementes.set(stage.id, semente | 0);
  return semente | 0;
}

/** O nível do Terreno num **vértice** da grade, de 0 ao número de pares. */
export function nivelNoVertice(stage: Stage, vx: number, vy: number, pares: number): number {
  const v = campo(sementeDe(stage), vx, vy);
  let nivel = 0;
  for (const faixa of FAIXAS[pares] ?? FAIXAS[2]) if (v >= faixa) nivel++;
  return nivel;
}

/**
 * Que ladrilho vai numa célula: qual par de níveis ela encosta e qual das 16 formas.
 *
 * A forma vem dos quatro cantos, que é como um tileset de canto funciona: cada canto é
 * do terreno de baixo ou do de cima, e os quatro bits juntos dão a peça.
 *
 * A ordem dos bits não foi adivinhada — foi medida na folha gerada, amostrando o desvio
 * e a média de cada canto das dezesseis peças: **1 = sudeste, 2 = sudoeste, 4 = nordeste,
 * 8 = noroeste**, com o bit ligado quando aquele canto é o terreno **de baixo**. Peça 0 é
 * tudo de cima; peça 15 é tudo de baixo.
 */
export interface Ladrilho {
  /** 0 para o tileset areia↔pedregoso, 1 para pedregoso↔rachado. */
  par: number;
  /** 0 a 15. */
  forma: number;
}

const BIT = [8, 4, 1, 2]; // noroeste, nordeste, sudeste, sudoeste

export function ladrilhoDaCelula(stage: Stage, cx: number, cy: number, pares: number): Ladrilho {
  const cantos = [
    nivelNoVertice(stage, cx, cy, pares),
    nivelNoVertice(stage, cx + 1, cy, pares),
    nivelNoVertice(stage, cx + 1, cy + 1, pares),
    nivelNoVertice(stage, cx, cy + 1, pares),
  ];

  const menor = Math.min(...cantos);
  const maior = Math.max(...cantos);

  // Célula inteira num nível só: a peça cheia, do lado certo do par.
  if (menor === maior) {
    return menor === 0 ? { par: 0, forma: 15 } : { par: menor - 1, forma: 0 };
  }

  // Encontro de níveis não vizinhos: não existe transição desenhada para ele — os níveis
  // são encaixados justamente para isso não acontecer. Se acontecer, cai no par de baixo.
  const par = maior - menor === 1 ? menor : 0;

  let forma = 0;
  for (let i = 0; i < 4; i++) if (cantos[i] === par) forma |= BIT[i];
  return { par, forma };
}
