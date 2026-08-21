import blueSheet from '../assets/Pixel Cars The 1st Car/pixel cars 8 animations-Sheet blue.png';
import greenSheet from '../assets/Pixel Cars The 1st Car/pixel cars 8 animations-Sheet green.png';
// Em teste: o vermelho é o carro novo, o verde e o azul continuam os antigos — dá para
// comparar os dois em jogo trocando de cor com as teclas 1, 2 e 3.
import redSheet from '../assets/Pixel Cars The 1st Car/rally-grupo-b-red.png';
import { TUNING } from './tuning';

export const CAR_COLORS = ['red', 'green', 'blue'] as const;
export type CarColor = (typeof CAR_COLORS)[number];

/** Cor de tela de cada opção, para o seletor. */
export const CAR_SWATCHES: Record<CarColor, string> = {
  red: '#b3343e',
  green: '#3fa04d',
  blue: '#3c62c4',
};

const SHEETS: Record<CarColor, string> = {
  red: redSheet,
  green: greenSheet,
  blue: blueSheet,
};

/** Os quadros são quadrados e ficam lado a lado; o tamanho deles é a altura da folha. */
const frameSize = (img: HTMLImageElement) => img.naturalHeight;

/**
 * Acima deste salto entre quadros, o canvas gira o sprite para cobrir o vão.
 *
 * É o que separa as duas arte: com 8 direções o vão é de 45°, grande demais para saltar
 * num jogo cujo coração é o giro, e girar um pouco é o mal menor. Com 16 direções o vão
 * é de 22,5°, imperceptível a 46px — e aí girar deixa de ser mal menor e passa a ser o
 * defeito, porque girar um desenho de 3/4 é justamente o que se lê como errado.
 */
const VAO_QUE_EXIGE_ROTACAO = 30;

/** Quantas direções esta folha tem. */
const frameCount = (img: HTMLImageElement) => Math.max(1, Math.round(img.naturalWidth / frameSize(img)));

/**
 * O quadro 0 aponta para cima e cada quadro seguinte gira no sentido **horário**.
 * Em graus de tela (0 = direita, positivo = para baixo): passo × índice − 90°.
 *
 * Verificado pelos faróis e pelo para-choque dianteiro, visíveis só nos quadros 3, 4 e 5
 * da folha de oito (Carro vindo em direção ao jogador), cujos ângulos medidos crescem
 * com o índice.
 */
const frameHeadingDeg = (frame: number, total: number) => (360 / total) * frame - 90;

const images = new Map<CarColor, HTMLImageElement>();

export function preloadCars(): void {
  for (const color of CAR_COLORS) {
    const img = new Image();
    img.src = SHEETS[color];
    images.set(color, img);
  }
}

const KEY = 'rally2d.carColor';

export function readCarColor(): CarColor {
  const raw = localStorage.getItem(KEY);
  return CAR_COLORS.includes(raw as CarColor) ? (raw as CarColor) : 'red';
}

export function saveCarColor(color: CarColor): void {
  localStorage.setItem(KEY, color);
}

/**
 * Desenha o Carro na posição e direção dadas.
 *
 * O Carro gira continuamente e a folha é finita: escolhemos o quadro mais próximo, e o
 * resto depende de quantos quadros a folha tem — ver `VAO_QUE_EXIGE_ROTACAO`.
 * Devolve `false` enquanto a imagem ainda não carregou.
 */
export function drawCarSprite(
  ctx: CanvasRenderingContext2D,
  color: CarColor,
  x: number,
  y: number,
  heading: number,
): boolean {
  const img = images.get(color);
  if (!img?.complete || img.naturalWidth === 0) return false;

  const lado = frameSize(img);
  const total = frameCount(img);
  const vao = 360 / total;
  const headingDeg = (heading * 180) / Math.PI;
  const frame = mod(Math.round((headingDeg + 90) / vao), total);
  const residual = normalizeDeg(headingDeg - frameHeadingDeg(frame, total));
  const size = TUNING.carScreenSize;
  const gira = TUNING.smoothSpriteRotation && vao > VAO_QUE_EXIGE_ROTACAO;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(gira ? (residual * Math.PI) / 180 : 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    img,
    frame * lado,
    0,
    lado,
    lado,
    -size / 2,
    -size / 2,
    size,
    size,
  );
  ctx.restore();

  return true;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function normalizeDeg(d: number): number {
  return ((((d + 180) % 360) + 360) % 360) - 180;
}
