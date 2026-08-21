import desertTerrainSheet from '../assets/world/deserto-terreno.png';
import desertV2Sheet from '../assets/world/deserto-v2.png';
import forestTerrainSheet from '../assets/world/floresta-terreno.png';
import forestV2Sheet from '../assets/world/floresta-v2.png';
import iceTerrainSheet from '../assets/world/gelo-terreno.png';
import iceV2Sheet from '../assets/world/gelo-v2.png';
import cenario from './cenario.json';
import { CELULA, ladrilhoDaCelula } from './terreno';
import etapas from './cenario-etapas.json';
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
 *
 * Os objetos de uma Etapa vêm de dois lugares que se somam: o sorteio, que enche os 23
 * mil pixels de Pista sem ninguém ter de encostar neles, e o que foi **posto à mão** no
 * editor de pista (`tools/pista.html`), guardado em `cenario-etapas.json`. Uma Etapa pode
 * dispensar o sorteio e ficar só com o que foi posto — mas não ao contrário: não existe
 * "quase à mão".
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
  /** O leito da Pista, e as variantes dele que o jogo alterna ao longo da Etapa. */
  bed: string;
  beds: readonly string[];
  largada: string;
  chegada: string;
  roadside: readonly string[];
  roadsideWeights: readonly number[];
  fans: readonly string[];
  crowd: string;
  /** Tamanho na tela = pixels do sprite × isto. */
  propScale: number;
  /** O tileset de canto do chão, quando o Bioma já tem um. */
  terreno: { sheet: Sheet; tile: number; pares: number } | null;
  /**
   * Os recortes que ficam deitados no chão — marca de pneu, rachadura, mancha. Não são
   * painéis em pé, então não têm o que projetar: dar sombra a eles é a sombra flutuar.
   */
  rasteiros: readonly string[];
  /** Nome base → recortes numerados, para o que tem mais de um quadro. */
  quadros: Map<string, string[]>;
  /** Recortes que o jogo desenha por conta própria — a Poeira, por exemplo. */
  efeitos: readonly string[];
  /**
   * Espelhar o ladrilho em 2×2 ao montar o padrão. Serve para esconder a costura de um
   * recorte que não fecha consigo mesmo — e **estraga** um ladrilho que já fecha, porque
   * espelhar uma textura com direção produz losangos de caleidoscópio.
   */
  espelharLadrilho: boolean;
}

interface Sheet {
  src: string;
  image: HTMLImageElement;
}

/**
 * As folhas de verdade, resolvidas pelo bundler; o JSON só diz qual é qual pelo nome.
 *
 * As folhas antigas — `deserto.png` e `gelo-floresta.png` — continuam no repositório mas
 * saíram daqui: nenhum Bioma as usa desde que os três foram refeitos.
 */
const SHEETS: Record<string, Sheet> = {
  // O Deserto refeito. O chão e o leito ainda são os antigos, recortados para dentro
  // dela: os ladrilhos novos são os últimos da fila.
  'deserto-v2': { src: desertV2Sheet, image: new Image() },
  'deserto-terreno': { src: desertTerrainSheet, image: new Image() },
  'floresta-v2': { src: forestV2Sheet, image: new Image() },
  'floresta-terreno': { src: forestTerrainSheet, image: new Image() },
  'gelo-v2': { src: iceV2Sheet, image: new Image() },
  'gelo-terreno': { src: iceTerrainSheet, image: new Image() },
};

/** A escala da arte antiga, calibrada à mão contra a largura da Pista. */
const PROP_SCALE_ANTIGA = 0.55;

/**
 * `torcedor1-0` e `torcedor1-1` são o mesmo objeto em dois momentos. A convenção é o
 * sufixo numerado, que é o que o empacotador de folha escreve — assim um objeto ganha
 * quadros sem ganhar campo nenhum no arquivo.
 */
function agruparQuadros(nomes: readonly string[]): Map<string, string[]> {
  const mapa = new Map<string, string[]>();

  for (const nome of nomes) {
    const casa = /^(.+)-(\d+)$/.exec(nome);
    if (!casa) continue;
    const lista = mapa.get(casa[1]) ?? [];
    lista[Number(casa[2])] = nome;
    mapa.set(casa[1], lista);
  }

  // Um objeto de um quadro só não é animação; some do mapa para não custar nada.
  for (const [base, lista] of mapa) {
    if (lista.filter(Boolean).length < 2) mapa.delete(base);
  }
  return mapa;
}

/**
 * Lê um campo que pode não existir no arquivo, sem deixar o compilador estreitar o tipo
 * do Bioma para `never` quando todos por acaso o têm. O arquivo é dado, e dado muda.
 */
function campo<T>(b: object, nome: string, padrao: T): T {
  return nome in b ? ((b as Record<string, unknown>)[nome] as T) : padrao;
}

/** O tileset do Terreno como está no arquivo: por nome de folha, não por imagem. */
interface Tileset {
  folha: string;
  tile: number;
  pares: number;
}

function montarTerreno(t: Tileset | null): Scenery['terreno'] {
  return t ? { sheet: SHEETS[t.folha], tile: t.tile, pares: t.pares } : null;
}

const SCENERY: Record<string, Scenery> = Object.fromEntries(
  Object.entries(cenario.biomas).map(([id, b]) => [
    id,
    {
      sheet: SHEETS[b.folha],
      sprites: b.recortes as Record<string, Rect>,
      ground: b.chao,
      bed: b.leito,
      beds: campo<string[]>(b, 'leitos', [b.leito]),
      largada: b.largada,
      chegada: b.chegada,
      roadside: b.beira,
      roadsideWeights: b.pesos,
      fans: b.publico,
      crowd: b.plateia,
      // A arte refeita nasce já no tamanho final; a antiga não. Enquanto os dois
      // convivem, cada Bioma carrega a sua escala — e o campo morre quando o último
      // Bioma antigo for refeito.
      propScale: campo(b, 'escala', PROP_SCALE_ANTIGA),
      rasteiros: campo<string[]>(b, 'rasteiros', []),
      terreno: montarTerreno(campo<Tileset | null>(b, 'terreno', null)),
      quadros: agruparQuadros(Object.keys(b.recortes)),
      efeitos: campo<string[]>(b, 'efeitos', []),
      espelharLadrilho: campo(b, 'espelhar', true),
    },
  ]),
);

/** Um objeto já posicionado no mundo. O ponto é onde ele toca o chão. */
export interface Prop {
  sprite: string;
  x: number;
  y: number;
  scale: number;
  flip: boolean;
  /**
   * Em que ponto do ciclo este objeto começa, de 0 a 1. Vem da Semente: sem ela o
   * público inteiro acena junto, e um estádio piscando em uníssono é pior que um parado.
   */
  fase: number;
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
  variante = 0,
): CanvasPattern | null {
  const key = `${biomeId}:${role}:${variante}`;
  const cached = patterns.get(key);
  if (cached !== undefined) return cached;

  const scenery = SCENERY[biomeId];
  if (scenery === undefined) return null;

  const nome = role === 'bed' ? scenery.beds[variante % scenery.beds.length] : scenery[role];
  const src = scenery.sprites[nome];
  if (src === undefined) return null;
  const espelhar = scenery.espelharLadrilho;
  const tile = document.createElement('canvas');
  tile.width = src.w * (espelhar ? 2 : 1);
  tile.height = src.h * (espelhar ? 2 : 1);
  const tctx = tile.getContext('2d');
  if (!tctx) return null;

  if (espelhar) {
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
  } else {
    tctx.drawImage(scenery.sheet.image, src.x, src.y, src.w, src.h, 0, 0, src.w, src.h);
  }

  const pattern = ctx.createPattern(tile, 'repeat');
  patterns.set(key, pattern);
  return pattern;
}

/**
 * O Terreno: o chão desenhado célula a célula, com a transição entre tipos de chão vinda
 * do tileset de canto. Substitui o ladrilho único onde o Bioma já tem tileset.
 *
 * Cada célula é resolvida na hora a partir da Semente — não há mapa guardado. O custo é
 * um `drawImage` por célula visível, algumas centenas por quadro, o que é barato perto de
 * guardar um mapa de uma Pista de vinte e três mil pixels.
 */
export function drawTerreno(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  cam: Vec,
  width: number,
  height: number,
): boolean {
  const scenery = SCENERY[stage.biome.id];
  const terreno = scenery?.terreno;
  if (!terreno || !terreno.sheet.image.complete || terreno.sheet.image.naturalWidth === 0) {
    return false;
  }

  const t = terreno.tile;
  const de = { x: Math.floor(cam.x / CELULA), y: Math.floor(cam.y / CELULA) };
  const ate = { x: Math.ceil((cam.x + width) / CELULA), y: Math.ceil((cam.y + height) / CELULA) };

  ctx.imageSmoothingEnabled = false;

  for (let cy = de.y; cy <= ate.y; cy++) {
    for (let cx = de.x; cx <= ate.x; cx++) {
      const { par, forma } = ladrilhoDaCelula(stage, cx, cy, terreno.pares);
      ctx.drawImage(
        terreno.sheet.image,
        (forma % 4) * t,
        (par * 4 + Math.floor(forma / 4)) * t,
        t,
        t,
        cx * CELULA,
        cy * CELULA,
        CELULA,
        CELULA,
      );
    }
  }

  return true;
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
export function trackFill(
  ctx: CanvasRenderingContext2D,
  biomeId: string,
  variante = 0,
): CanvasPattern | null {
  return patternOf(ctx, biomeId, 'bed', variante);
}

/** Quantas variantes de leito este Bioma tem. */
export function bedCount(biomeId: string): number {
  return SCENERY[biomeId]?.beds.length ?? 1;
}

// ------------------------------------------------------------------- objetos

const byStage = new Map<string, Prop[]>();

/** O que foi posto à mão numa Etapa, no formato do arquivo. */
interface PostoAMao {
  sprite: string;
  x: number;
  y: number;
  escala: number;
  espelhado: boolean;
}

interface EtapaAMao {
  /** Dispensa o sorteio: a Etapa fica só com o que foi posto à mão. */
  semSorteio?: boolean;
  postos: PostoAMao[];
}

const A_MAO = etapas as Record<string, EtapaAMao>;

/**
 * Os objetos de uma Etapa: o que o sorteio pôs mais o que foi posto à mão. Os sorteados
 * saem da mesma Semente, então a Etapa é sempre igual a si mesma.
 *
 * O que é posto à mão não desvia da Pista como o sorteio desvia — quem põe está vendo
 * onde põe. E continua sem ser obstáculo: a única condição de Batida é a Borda da Pista.
 */
export function sceneryOf(stage: Stage): Prop[] {
  const cached = byStage.get(stage.id);
  if (cached) return cached;

  // Ordenados pelo pé: em 3/4, quem está mais abaixo na tela está mais perto de quem
  // olha, e tem de tapar quem está atrás. Feito uma vez por Etapa, não por quadro.
  const props = [...proceduraisDe(stage), ...postosDe(stage)].sort((a, b) => a.y - b.y);
  byStage.set(stage.id, props);
  return props;
}

/** Só os sorteados. Separado porque o editor de pista precisa distinguir os dois. */
export function proceduraisDe(stage: Stage): Prop[] {
  return A_MAO[stage.id]?.semSorteio ? [] : buildProps(stage);
}

/** Só os postos à mão. */
export function postosDe(stage: Stage): Prop[] {
  return (A_MAO[stage.id]?.postos ?? []).map((p) => ({
    sprite: p.sprite,
    x: p.x,
    y: p.y,
    scale: (SCENERY[stage.biome.id]?.propScale ?? PROP_SCALE_ANTIGA) * p.escala,
    flip: p.espelhado,
    // Posto à mão não tem Semente; a fase sai da posição, que é fixa e única.
    fase: ((p.x * 7 + p.y * 13) % 100) / 100,
  }));
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
      scale: scenery.propScale * rng.range(0.85, 1.15),
      flip: rng.next() < 0.5,
      fase: rng.next(),
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
      scale: scenery.propScale * rng.range(0.8, 1.0),
      flip: side > 0,
      fase: rng.next(),
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

/** Quantas vezes por segundo um objeto de dois quadros troca de quadro. */
const QUADROS_POR_SEGUNDO = 4;

/**
 * A Poeira, deitada no chão e não em pé: é o único desenho do Cenário que não é painel.
 * Nasce pequena e opaca, morre grande e transparente — o sprite é sempre o mesmo, quem
 * anima é o tempo.
 */
export function drawPoeira(
  ctx: CanvasRenderingContext2D,
  biomeId: string,
  sopros: readonly { x: number; y: number; idade: number; vida: number; tamanho: number; giro: number }[],
): void {
  const scenery = SCENERY[biomeId];
  const nome = scenery?.efeitos.find((e) => e === 'poeira');
  const s = nome ? scenery.sprites[nome] : undefined;
  if (!scenery || s === undefined) return;

  ctx.imageSmoothingEnabled = false;

  for (const sopro of sopros) {
    const t = sopro.idade / sopro.vida;
    if (t >= 1) continue;

    // Cresce até o dobro e some no fim; a opacidade cai mais rápido que o tamanho cresce,
    // senão a nuvem fica sólida e tapa a Pista bem onde o jogador precisa olhar.
    const tamanho = sopro.tamanho * (1 + t);

    ctx.save();
    ctx.globalAlpha = 0.8 * (1 - t) ** 1.3;
    ctx.translate(sopro.x, sopro.y);
    ctx.rotate(sopro.giro);
    ctx.drawImage(scenery.sheet.image, s.x, s.y, s.w, s.h, -tamanho / 2, -tamanho / 2, tamanho, tamanho);
    ctx.restore();
  }
}

/** Desenha os objetos visíveis. O sprite fica em pé, apoiado no ponto do mundo. */
export function drawProps(
  ctx: CanvasRenderingContext2D,
  biomeId: string,
  props: readonly Prop[],
  cam: Vec,
  width: number,
  height: number,
  tempo = performance.now() / 1000,
): void {
  const scenery = SCENERY[biomeId];
  if (scenery === undefined) return;

  ctx.imageSmoothingEnabled = false;

  for (const prop of props) {
    if (prop.x < cam.x - 200 || prop.x > cam.x + width + 200) continue;
    if (prop.y < cam.y - 300 || prop.y > cam.y + height + 200) continue;

    const nome = quadroAgora(scenery, prop, tempo);
    const s = scenery.sprites[nome];
    if (s === undefined) continue;

    if (!scenery.rasteiros.includes(prop.sprite)) sombra(ctx, prop.x, prop.y, s.w * prop.scale);
    drawSprite(ctx, scenery, nome, prop.x, prop.y, prop.scale, prop.flip);
  }
}

/** O quadro deste objeto agora. Objeto de um quadro só devolve o próprio nome. */
function quadroAgora(scenery: Scenery, prop: Prop, tempo: number): string {
  const lista = scenery.quadros.get(prop.sprite);
  if (lista === undefined) return prop.sprite;

  const passo = Math.floor(tempo * QUADROS_POR_SEGUNDO + prop.fase * lista.length);
  return lista[((passo % lista.length) + lista.length) % lista.length] ?? prop.sprite;
}

/**
 * A sombra de contato: uma elipse no pé do objeto.
 *
 * Painel em pé sobre chão visto de cima flutua sem ela — é o defeito que faz arte boa
 * parecer colada. Fica aqui, e não desenhada dentro do sprite, porque assim vale para
 * todos de uma vez, obedece o espelhamento e não congela a direção da luz no desenho.
 */
function sombra(ctx: CanvasRenderingContext2D, x: number, y: number, largura: number): void {
  ctx.save();
  ctx.globalAlpha = 0.26;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, y, largura * 0.42, largura * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
 * Os pórticos de largada e chegada, em pé sobre a Pista.
 *
 * Ficavam deitados atravessados no traçado, que é convenção de vista de cima. Com o
 * Ponto de Vista misto — chão de cima, objeto em 3/4 — o pórtico é objeto: fica em pé,
 * apoiado no meio da Pista, e o Carro passa por baixo dele.
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
  const b = center[i];
  const s = scenery.sprites[name];
  // Largo o bastante para atravessar a Pista: o pórtico é o que diz onde ela começa.
  const w = trackWidth * 1.15;
  const h = (s.h / s.w) * w;

  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.imageSmoothingEnabled = false;
  // Em pé e apoiado no chão, como todo objeto: não gira com o traçado.
  ctx.drawImage(scenery.sheet.image, s.x, s.y, s.w, s.h, -w / 2, -h, w, h);
  ctx.restore();
}
