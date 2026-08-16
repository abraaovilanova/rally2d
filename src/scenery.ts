import desertSheet from '../assets/world/deserto.png';
import { normalAt, type Vec } from './path';
import { createRng, seedFromStageId } from './rng';
import type { Stage } from './stage';

/**
 * O Cenário de um Bioma: o chão, a textura da Pista e os objetos da beira dela.
 *
 * É decoração — nada aqui entra no modelo do jogo. Nenhum objeto de Cenário é
 * obstáculo: a única condição de Batida continua sendo a Borda da Pista.
 */

/** Um recorte da folha de sprites, em pixels da imagem. */
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

/** Medidos na folha `assets/world/deserto.png`. */
const DESERT = {
  largada: r(22, 30, 200, 81),
  chegada: r(589, 19, 179, 81),
  cactus: r(1150, 338, 58, 96),
  bush: r(1298, 348, 74, 71),
  rocks: r(14, 486, 140, 111),
  smallRocks: r(1103, 507, 116, 62),
  cone: r(233, 516, 52, 62),
  flagYellow: r(412, 493, 54, 91),
  flagBlue: r(598, 492, 52, 89),
  fence: r(726, 515, 145, 62),
  guardrail: r(918, 508, 121, 71),
  tires: r(1279, 189, 115, 87),
  startSign: r(974, 203, 88, 67),
  finishSign: r(1133, 203, 88, 67),
  checkeredFlag: r(635, 151, 119, 150),
  brazilFlag: r(821, 25, 74, 105),
  crowd: r(1266, 633, 131, 118),
  fan1: r(51, 643, 69, 117),
  fan2: r(237, 656, 41, 100),
  fan3: r(401, 629, 100, 127),
  fan4: r(583, 638, 65, 118),
  fan5: r(757, 627, 78, 130),
  fan6: r(952, 633, 55, 121),
  fan7: r(1126, 633, 69, 123),
  /** Areia lisa, para o chão. */
  sand: r(755, 315, 140, 138),
  /** Terra com marcas de pneu, para o leito da Pista. */
  dirt: r(20, 318, 132, 134),
} as const;

type SpriteName = keyof typeof DESERT;

/** Objetos da beira da Pista e seus pesos de sorteio. */
const ROADSIDE: readonly SpriteName[] = [
  'cactus',
  'bush',
  'rocks',
  'smallRocks',
  'cone',
  'flagYellow',
  'flagBlue',
  'fence',
  'guardrail',
  'tires',
];
const ROADSIDE_WEIGHTS: readonly number[] = [5, 5, 3, 4, 2, 2, 2, 2, 2, 2];

const FANS: readonly SpriteName[] = ['fan1', 'fan2', 'fan3', 'fan4', 'fan5', 'fan6', 'fan7'];

/** Tamanho na tela = pixels do sprite × isto. Calibrado contra a largura da Pista. */
const PROP_SCALE = 0.55;

/** Um objeto já posicionado no mundo. O ponto é onde ele toca o chão. */
export interface Prop {
  sprite: SpriteName;
  x: number;
  y: number;
  scale: number;
  flip: boolean;
}

const sheet = new Image();
let sheetRequested = false;

export function preloadScenery(): void {
  if (sheetRequested) return;
  sheetRequested = true;
  sheet.src = desertSheet;
}

/** O Cenário existe por Bioma; os que não têm folha continuam só com a paleta. */
export function hasScenery(biomeId: string): boolean {
  return biomeId === 'deserto' && sheet.complete && sheet.naturalWidth > 0;
}

// ---------------------------------------------------------------- chão e leito

/** Padrões custam um canvas cada; são os mesmos para o jogo todo. */
const patterns = new Map<'sand' | 'dirt', CanvasPattern | null>();

/**
 * Ladrilhar um recorte que não é contínuo deixa costura visível a cada repetição.
 * Espelhar em 2×2 faz as bordas do bloco baterem consigo mesmas e a costura some.
 */
function patternOf(ctx: CanvasRenderingContext2D, name: 'sand' | 'dirt'): CanvasPattern | null {
  const cached = patterns.get(name);
  if (cached !== undefined) return cached;

  const src = DESERT[name];
  const tile = document.createElement('canvas');
  tile.width = src.w * 2;
  tile.height = src.h * 2;
  const tctx = tile.getContext('2d');
  if (!tctx) return null;

  for (const [sx, sy] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ]) {
    tctx.save();
    tctx.translate(sx ? src.w * 2 : 0, sy ? src.h * 2 : 0);
    tctx.scale(sx ? -1 : 1, sy ? -1 : 1);
    tctx.drawImage(sheet, src.x, src.y, src.w, src.h, 0, 0, src.w, src.h);
    tctx.restore();
  }

  const pattern = ctx.createPattern(tile, 'repeat');
  patterns.set(name, pattern);
  return pattern;
}

/** O chão de areia, já em coordenadas de mundo (chamar dentro do translate da câmera). */
export function drawGround(
  ctx: CanvasRenderingContext2D,
  cam: Vec,
  width: number,
  height: number,
  tint: string,
): void {
  const pattern = patternOf(ctx, 'sand');
  if (!pattern) return;

  ctx.fillStyle = pattern;
  ctx.fillRect(cam.x, cam.y, width, height);

  // A areia crua é clara demais para a Pista se destacar dela.
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = tint;
  ctx.fillRect(cam.x, cam.y, width, height);
  ctx.globalAlpha = 1;
}

/** A textura do leito da Pista, para usar como `fillStyle` no lugar da cor da paleta. */
export function trackFill(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  return patternOf(ctx, 'dirt');
}

// ------------------------------------------------------------------- objetos

const byStage = new Map<string, Prop[]>();

/** Os objetos de uma Etapa. Saem da mesma Semente: a Etapa é sempre igual a si mesma. */
export function sceneryOf(stage: Stage): Prop[] {
  const cached = byStage.get(stage.id);
  if (cached) return cached;

  const props = buildProps(stage);
  byStage.set(stage.id, props);
  return props;
}

function buildProps(stage: Stage): Prop[] {
  const { track } = stage;
  const center = track.main.center;
  const rng = createRng(seedFromStageId(`${stage.id}-cenario`));
  const props: Prop[] = [];

  // Onde há Caminho não pode haver objeto: um cacto sobre a Pista se leria como obstáculo.
  const occupied = occupiedCells(stage);

  const last = center.length - 1;
  for (let i = 12; i < last - 12; i += 9) {
    if (rng.next() > 0.55) continue;

    const side = rng.next() < 0.5 ? -1 : 1;
    const n = normalAt(center, i);
    const away = track.width / 2 + 26 + rng.range(0, 150);
    const x = center[i].x + n.x * away * side;
    const y = center[i].y + n.y * away * side;
    if (occupied.has(cellKey(x, y))) continue;

    props.push({
      sprite: rng.weighted(ROADSIDE, ROADSIDE_WEIGHTS),
      x,
      y,
      scale: PROP_SCALE * rng.range(0.85, 1.15),
      flip: rng.next() < 0.5,
    });
  }

  // Público na largada e na chegada: é onde a Corrida começa e termina de valer.
  addCrowd(props, stage, rng, 8, 90);
  addCrowd(props, stage, rng, last - 90, last - 8);

  return props;
}

function addCrowd(
  props: Prop[],
  stage: Stage,
  rng: ReturnType<typeof createRng>,
  from: number,
  to: number,
): void {
  const center = stage.track.main.center;

  for (let i = Math.max(1, from); i < to; i += 7) {
    if (rng.next() > 0.7) continue;

    const side = rng.next() < 0.5 ? -1 : 1;
    const n = normalAt(center, i);
    const away = stage.track.width / 2 + 22 + rng.range(0, 40);

    props.push({
      sprite: rng.next() < 0.25 ? 'crowd' : FANS[Math.floor(rng.range(0, FANS.length))],
      x: center[i].x + n.x * away * side,
      y: center[i].y + n.y * away * side,
      scale: PROP_SCALE * rng.range(0.8, 1.0),
      flip: side > 0,
    });
  }
}

const CELL = 70;
const cellKey = (x: number, y: number) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;

/** As células que a Pista e as Rotas Alternativas ocupam, com uma folga em volta. */
function occupiedCells(stage: Stage): Set<string> {
  const cells = new Set<string>();
  const paths = [stage.track.main, ...stage.track.branches.map((b) => b.path)];
  const pad = stage.track.width / 2 + 20;

  for (const path of paths) {
    for (let i = 0; i < path.center.length; i += 2) {
      const n = normalAt(path.center, i);
      for (let t = -pad; t <= pad; t += CELL / 2) {
        cells.add(cellKey(path.center[i].x + n.x * t, path.center[i].y + n.y * t));
      }
    }
  }

  return cells;
}

/** Desenha os objetos visíveis. O sprite fica em pé, apoiado no ponto do mundo. */
export function drawProps(
  ctx: CanvasRenderingContext2D,
  props: readonly Prop[],
  cam: Vec,
  width: number,
  height: number,
): void {
  ctx.imageSmoothingEnabled = false;

  for (const prop of props) {
    if (prop.x < cam.x - 200 || prop.x > cam.x + width + 200) continue;
    if (prop.y < cam.y - 300 || prop.y > cam.y + height + 200) continue;
    drawSprite(ctx, prop.sprite, prop.x, prop.y, prop.scale, prop.flip);
  }
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  name: SpriteName,
  x: number,
  y: number,
  scale: number,
  flip = false,
): void {
  const s = DESERT[name];
  const w = s.w * scale;
  const h = s.h * scale;

  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(sheet, s.x, s.y, s.w, s.h, -w / 2, -h, w, h);
  ctx.restore();
}

/**
 * Os pórticos de largada e chegada, atravessados sobre a Pista.
 * Marcam no mundo os dois pontos que o HUD só sabe dizer em número.
 */
export function drawGates(ctx: CanvasRenderingContext2D, stage: Stage): void {
  const center = stage.track.main.center;
  gate(ctx, center, 6, 'largada', stage.track.width);
  gate(ctx, center, center.length - 6, 'chegada', stage.track.width);
}

function gate(
  ctx: CanvasRenderingContext2D,
  center: Vec[],
  index: number,
  name: SpriteName,
  trackWidth: number,
): void {
  const i = Math.min(Math.max(index, 1), center.length - 1);
  const a = center[i - 1];
  const b = center[i];
  const heading = Math.atan2(b.y - a.y, b.x - a.x);
  const s = DESERT[name];
  const w = trackWidth * 1.15;
  const h = (s.h / s.w) * w;

  ctx.save();
  ctx.translate(b.x, b.y);
  // Deitado sobre a Pista: visto de cima, o pórtico é uma faixa cruzando o traçado.
  ctx.rotate(heading + Math.PI / 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, s.x, s.y, s.w, s.h, -w / 2, -h / 2, w, h);
  ctx.restore();
}
