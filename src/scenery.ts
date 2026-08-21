import desertSheet from '../assets/world/deserto.png';
import iceForestSheet from '../assets/world/gelo-floresta.png';
import cenario from './cenario.json';
import { normalAt, type Vec } from './path';
import { createRng, seedFromStageId } from './rng';
import type { Stage } from './stage';

/**
 * O Cenário de um Bioma: o chão, a textura da Pista e os objetos da beira dela.
 *
 * É decoração — nada aqui entra no modelo do jogo. Nenhum objeto de Cenário é
 * obstáculo: a única condição de Batida continua sendo a Borda da Pista.
 *
 * Os recortes não moram aqui: moram em `cenario.json`, que é o que o editor de sprites
 * (`tools/sprites.html`) lê e grava. Medir recorte de sprite na mão, contando pixel em
 * código, é o tipo de coisa que se faz olhando — e olhando é no editor.
 */

/** Um recorte da folha de sprites, em pixels da imagem. */
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * O Cenário de um Bioma. Cada Bioma nomeia os seus próprios sprites — um cacto não tem
 * equivalente no gelo — e o que é comum são os papéis: o chão, o leito, os dois pórticos,
 * o que fica na beira e quem assiste.
 */
interface Scenery {
  /** A folha de onde todos os recortes vêm. Dois Biomas podem dividir a mesma. */
  sheet: Sheet;
  sprites: Record<string, Rect>;
  /** O chão fora da Pista. */
  ground: string;
  /** O leito da Pista. */
  bed: string;
  largada: string;
  chegada: string;
  roadside: readonly string[];
  roadsideWeights: readonly number[];
  fans: readonly string[];
  crowd: string;
}

interface Sheet {
  src: string;
  image: HTMLImageElement;
}

/** As folhas de verdade, resolvidas pelo bundler; o JSON só diz qual é qual pelo nome. */
const SHEETS: Record<string, Sheet> = {
  deserto: { src: desertSheet, image: new Image() },
  'gelo-floresta': { src: iceForestSheet, image: new Image() },
};

const SCENERY: Record<string, Scenery> = Object.fromEntries(
  Object.entries(cenario.biomas).map(([id, b]) => [
    id,
    {
      sheet: SHEETS[b.folha],
      sprites: b.recortes as Record<string, Rect>,
      ground: b.chao,
      bed: b.leito,
      largada: b.largada,
      chegada: b.chegada,
      roadside: b.beira,
      roadsideWeights: b.pesos,
      fans: b.publico,
      crowd: b.plateia,
    },
  ]),
);

/** Tamanho na tela = pixels do sprite × isto. Calibrado contra a largura da Pista. */
const PROP_SCALE = 0.55;

/** Um objeto já posicionado no mundo. O ponto é onde ele toca o chão. */
export interface Prop {
  sprite: string;
  x: number;
  y: number;
  scale: number;
  flip: boolean;
}

export function preloadScenery(): void {
  for (const sheet of Object.values(SHEETS)) {
    if (sheet.image.src === '') sheet.image.src = sheet.src;
  }
}

/** O Cenário existe por Bioma; os que não têm folha continuam só com a paleta. */
export function hasScenery(biomeId: string): boolean {
  const scenery = SCENERY[biomeId];
  if (scenery === undefined) return false;
  const { image } = scenery.sheet;
  return image.complete && image.naturalWidth > 0;
}

// ---------------------------------------------------------------- chão e leito

/** Padrões custam um canvas cada; são os mesmos para o jogo todo. */
const patterns = new Map<string, CanvasPattern | null>();

/**
 * Ladrilhar um recorte que não é contínuo deixa costura visível a cada repetição.
 * Espelhar em 2×2 faz as bordas do bloco baterem consigo mesmas e a costura some.
 */
function patternOf(
  ctx: CanvasRenderingContext2D,
  biomeId: string,
  role: 'ground' | 'bed',
): CanvasPattern | null {
  const key = `${biomeId}:${role}`;
  const cached = patterns.get(key);
  if (cached !== undefined) return cached;

  const scenery = SCENERY[biomeId];
  if (scenery === undefined) return null;

  const src = scenery.sprites[scenery[role]];
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
    tctx.drawImage(scenery.sheet.image, src.x, src.y, src.w, src.h, 0, 0, src.w, src.h);
    tctx.restore();
  }

  const pattern = ctx.createPattern(tile, 'repeat');
  patterns.set(key, pattern);
  return pattern;
}

/** O chão do Bioma, já em coordenadas de mundo (chamar dentro do translate da câmera). */
export function drawGround(
  ctx: CanvasRenderingContext2D,
  biomeId: string,
  cam: Vec,
  width: number,
  height: number,
  tint: string,
): void {
  const pattern = patternOf(ctx, biomeId, 'ground');
  if (!pattern) return;

  ctx.fillStyle = pattern;
  ctx.fillRect(cam.x, cam.y, width, height);

  // A areia — e a neve mais ainda — é clara demais para a Pista se destacar dela.
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = tint;
  ctx.fillRect(cam.x, cam.y, width, height);
  ctx.globalAlpha = 1;
}

/** A textura do leito da Pista, para usar como `fillStyle` no lugar da cor da paleta. */
export function trackFill(ctx: CanvasRenderingContext2D, biomeId: string): CanvasPattern | null {
  return patternOf(ctx, biomeId, 'bed');
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
  const scenery = SCENERY[stage.biome.id];
  if (scenery === undefined) return [];

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
      sprite: rng.weighted(scenery.roadside, scenery.roadsideWeights),
      x,
      y,
      scale: PROP_SCALE * rng.range(0.85, 1.15),
      flip: rng.next() < 0.5,
    });
  }

  // Público na largada e na chegada: é onde a Corrida começa e termina de valer.
  addCrowd(props, stage, scenery, rng, 8, 90);
  addCrowd(props, stage, scenery, rng, last - 90, last - 8);

  return props;
}

function addCrowd(
  props: Prop[],
  stage: Stage,
  scenery: Scenery,
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
      sprite:
        rng.next() < 0.25
          ? scenery.crowd
          : scenery.fans[Math.floor(rng.range(0, scenery.fans.length))],
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
  biomeId: string,
  props: readonly Prop[],
  cam: Vec,
  width: number,
  height: number,
): void {
  const scenery = SCENERY[biomeId];
  if (scenery === undefined) return;

  ctx.imageSmoothingEnabled = false;

  for (const prop of props) {
    if (prop.x < cam.x - 200 || prop.x > cam.x + width + 200) continue;
    if (prop.y < cam.y - 300 || prop.y > cam.y + height + 200) continue;
    drawSprite(ctx, scenery, prop.sprite, prop.x, prop.y, prop.scale, prop.flip);
  }
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  scenery: Scenery,
  name: string,
  x: number,
  y: number,
  scale: number,
  flip = false,
): void {
  const s = scenery.sprites[name];
  if (s === undefined) return;
  const w = s.w * scale;
  const h = s.h * scale;

  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(scenery.sheet.image, s.x, s.y, s.w, s.h, -w / 2, -h, w, h);
  ctx.restore();
}

/**
 * Os pórticos de largada e chegada, atravessados sobre a Pista.
 * Marcam no mundo os dois pontos que o HUD só sabe dizer em número.
 */
export function drawGates(ctx: CanvasRenderingContext2D, stage: Stage): void {
  const scenery = SCENERY[stage.biome.id];
  if (scenery === undefined) return;

  const center = stage.track.main.center;
  gate(ctx, scenery, center, 6, scenery.largada, stage.track.width);
  gate(ctx, scenery, center, center.length - 6, scenery.chegada, stage.track.width);
}

function gate(
  ctx: CanvasRenderingContext2D,
  scenery: Scenery,
  center: Vec[],
  index: number,
  name: string,
  trackWidth: number,
): void {
  const i = Math.min(Math.max(index, 1), center.length - 1);
  const a = center[i - 1];
  const b = center[i];
  const heading = Math.atan2(b.y - a.y, b.x - a.x);
  const s = scenery.sprites[name];
  const w = trackWidth * 1.15;
  const h = (s.h / s.w) * w;

  ctx.save();
  ctx.translate(b.x, b.y);
  // Deitado sobre a Pista: visto de cima, o pórtico é uma faixa cruzando o traçado.
  ctx.rotate(heading + Math.PI / 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scenery.sheet.image, s.x, s.y, s.w, s.h, -w / 2, -h / 2, w, h);
  ctx.restore();
}
