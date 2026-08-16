import blueSheet from '../assets/Pixel Cars The 1st Car/pixel cars 8 animations-Sheet blue.png';
import greenSheet from '../assets/Pixel Cars The 1st Car/pixel cars 8 animations-Sheet green.png';
import redSheet from '../assets/Pixel Cars The 1st Car/pixel cars 8 animations-Sheet red.png';
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

/** Cada folha tem 8 direções de 64×64, lado a lado. */
const FRAME_SIZE = 64;
const FRAME_COUNT = 8;

/**
 * O quadro 0 aponta para cima e cada quadro seguinte gira 45° no sentido **horário**.
 * Em graus de tela (0 = direita, positivo = para baixo): 45° × índice − 90°.
 *
 * Verificado pelos faróis e pelo para-choque dianteiro, visíveis só nos quadros 3, 4 e 5
 * (Carro vindo em direção ao jogador), cujos ângulos medidos crescem com o índice.
 */
const frameHeadingDeg = (frame: number) => 45 * frame - 90;

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
 * A folha só tem 8 direções, mas o Carro gira continuamente. Escolhemos o quadro mais
 * próximo e giramos o resto (no máximo 22,5°) no canvas: sem isso o Carro andaria aos
 * saltos de 45°, o que num jogo de mira precisa se lê como o controle falhando.
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

  const headingDeg = (heading * 180) / Math.PI;
  const frame = mod(Math.round((headingDeg + 90) / 45), FRAME_COUNT);
  const residual = normalizeDeg(headingDeg - frameHeadingDeg(frame));
  const size = FRAME_SIZE * TUNING.carSpriteScale;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(TUNING.smoothSpriteRotation ? (residual * Math.PI) / 180 : 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    img,
    frame * FRAME_SIZE,
    0,
    FRAME_SIZE,
    FRAME_SIZE,
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
