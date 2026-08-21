import desertSheet from '../assets/world/deserto.png';
import iceForestSheet from '../assets/world/gelo-floresta.png';
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

/**
 * O Cenário de um Bioma. Cada Bioma nomeia os seus próprios sprites — um cacto não tem
 * equivalente no gelo — e o que é comum são os papéis: o chão, o leito, os dois pórticos,
 * o que fica na beira e quem assiste.
 */
interface Scenery {
  /** A folha de onde todos os recortes vêm. Duas Biomas podem dividir a mesma. */
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

const makeSheet = (src: string): Sheet => ({ src, image: new Image() });

const DESERT_SHEET = makeSheet(desertSheet);
/** Uma folha só, com a Floresta em cima e o Gelo embaixo. */
const ICE_FOREST_SHEET = makeSheet(iceForestSheet);

/** Medidos na folha `assets/world/deserto.png`. */
const DESERT_SPRITES = {
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
};

/**
 * Medidos na folha `assets/world/gelo-floresta.png`. As duas metades dela são Biomas
 * diferentes; a última fileira, o público, é dividida entre os dois.
 */
const FOREST_SPRITES = {
  largada: r(11, 5, 206, 140),
  chegada: r(571, 12, 202, 129),
  signTrail: r(257, 35, 126, 105),
  signWood: r(421, 40, 121, 100),
  flag: r(820, 24, 75, 106),
  podium: r(946, 46, 140, 73),
  tires: r(1274, 44, 123, 91),
  pines: r(791, 156, 149, 149),
  trees: r(942, 153, 150, 148),
  rocks: r(1102, 173, 143, 115),
  hiker: r(56, 641, 65, 121),
  ranger: r(223, 637, 71, 126),
  biker: r(395, 636, 89, 125),
  crowd: r(1265, 632, 133, 121),
  /** Musgo, para o chão. */
  moss: r(527, 152, 93, 155),
  /** Terra batida entre as samambaias, para o leito da Pista. */
  soil: r(626, 152, 156, 155),
};

const ICE_SPRITES = {
  largada: r(10, 310, 211, 145),
  chegada: r(562, 310, 201, 141),
  signIce: r(261, 339, 92, 116),
  signValley: r(392, 342, 129, 105),
  flag: r(819, 330, 76, 112),
  podium: r(937, 355, 144, 80),
  cubes: r(1267, 337, 131, 104),
  bareTree: r(881, 459, 98, 147),
  snowBush: r(1002, 513, 70, 76),
  crystals: r(1106, 471, 136, 138),
  parka: r(578, 636, 71, 125),
  sculptor: r(747, 637, 107, 123),
  snowmobile: r(902, 633, 159, 130),
  seated: r(1118, 632, 83, 131),
  crowd: r(1265, 632, 133, 121),
  /**
   * Neve lisa, para o chão. O recorte é o miolo opaco do ladrilho: incluir as linhas
   * transparentes da borda abriria uma faixa vazia a cada repetição do padrão.
   */
  snow: r(528, 469, 117, 146),
  /** Neve com marcas de pneu, para o leito da Pista. */
  tracks: r(411, 469, 105, 147),
};

const SCENERY: Record<string, Scenery> = {
  deserto: {
    sheet: DESERT_SHEET,
    sprites: DESERT_SPRITES,
    ground: 'sand',
    bed: 'dirt',
    largada: 'largada',
    chegada: 'chegada',
    roadside: [
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
    ],
    roadsideWeights: [5, 5, 3, 4, 2, 2, 2, 2, 2, 2],
    fans: ['fan1', 'fan2', 'fan3', 'fan4', 'fan5', 'fan6', 'fan7'],
    crowd: 'crowd',
  },
  floresta: {
    sheet: ICE_FOREST_SHEET,
    sprites: FOREST_SPRITES,
    ground: 'moss',
    bed: 'soil',
    largada: 'largada',
    chegada: 'chegada',
    roadside: ['pines', 'trees', 'rocks', 'tires', 'signTrail', 'signWood', 'flag', 'podium'],
    roadsideWeights: [6, 6, 3, 2, 2, 2, 1, 1],
    fans: ['hiker', 'ranger', 'biker'],
    crowd: 'crowd',
  },
  gelo: {
    sheet: ICE_FOREST_SHEET,
    sprites: ICE_SPRITES,
    ground: 'snow',
    bed: 'tracks',
    largada: 'largada',
    chegada: 'chegada',
    roadside: ['bareTree', 'crystals', 'snowBush', 'cubes', 'signIce', 'signValley', 'flag', 'podium'],
    roadsideWeights: [5, 5, 4, 3, 2, 2, 1, 1],
    fans: ['parka', 'sculptor', 'snowmobile', 'seated'],
    crowd: 'crowd',
  },
};

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
  for (const sheet of [DESERT_SHEET, ICE_FOREST_SHEET]) {
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
