import { slipOf, throttleOf } from './car';
import { CAR_COLORS, CAR_SWATCHES, drawCarSprite } from './carSprite';
import { drawClima } from './clima';
import { categoryOf, currentPath, engolindo, progress, runoffLeft, type Game } from './game';
import { nextNotes, type PaceNote } from './pacenotes';
import type { Path, Vec } from './path';
import { formatTime } from './records';
import { sopros } from './poeira';
import { isOffRoute } from './route';
import { bedCount, drawGates, drawGround, drawPoeira, drawProps, drawRelevo, drawTerreno, hasScenery, sceneryOf, trackFill, type Prop } from './scenery';
import { seedFromStageId } from './rng';
import { puddlesOf, type Puddle } from './surface';
import type { Stage } from './stage';
import type { Track } from './track';
import { TUNING } from './tuning';

/** Cores de uma Rota Alternativa depois que ela se revela pior que a Pista. */
const OFF_ROUTE_FILL = 'rgba(0, 0, 0, 0.45)';
/** Placa de organizador: condensada, caixa alta, pequena. */
const PLACA = '600 13px "Saira Condensed", "Arial Narrow", system-ui, sans-serif';

/** Número cronometrado: monoespaçado, para o dígito não dançar enquanto conta. */
const NUMERO = (px: number) => `${px}px "Share Tech Mono", ui-monospace, monospace`;

const OFF_ROUTE_EDGE = '#6a6a72';

/** Canto superior esquerdo da câmera, em coordenadas de mundo. */
export function cameraAt(game: Game, canvas: HTMLCanvasElement): Vec {
  // O Carro fica à esquerda da tela: a Pista que importa é a que ainda vem pela frente.
  return {
    x: game.car.x - canvas.width * TUNING.cameraCarX,
    y: game.car.y - canvas.height / 2,
  };
}

export function render(ctx: CanvasRenderingContext2D, game: Game): void {
  const canvas = ctx.canvas;
  const palette = game.stage.biome.palette;
  const cam = cameraAt(game, canvas);
  const track = game.stage.track;
  const mainIndex = Math.round(progress(game) * (track.main.center.length - 1));

  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  const [from, to] = windowAround(track.main, mainIndex);
  drawScene(ctx, game.stage, cam, canvas.width, canvas.height, from, to);
  // A Poeira fica sobre o chão e sob tudo o mais: ela é o chão levantado, não um objeto.
  drawPoeira(ctx, game.stage.biome.id, sopros());
  drawForkSigns(ctx, game, from, to);
  drawNoteMarkers(ctx, game);
  drawFinishLine(ctx, track.main, palette.edge);
  drawCar(ctx, game, palette.car);
  drawEngolida(ctx, game);

  ctx.restore();

  // O Clima fica entre o mundo e a interface, e antes da noite: chuva atrás do escuro é
  // chuva que não se vê.
  drawClima(ctx, game.stage, performance.now() / 1000);

  // A noite entra entre o mundo e a interface: escurece o que foi desenhado, e não o que
  // o jogador precisa ler para dirigir.
  drawNoite(ctx, game, cam);

  // A mira é desenhada depois do `restore`, em coordenadas de tela: é assim que cada
  // bloco cai inteiro numa casa da grade de pixels.
  drawMira(ctx, game, cam);

  drawPaceNotes(ctx, game);
  drawHud(ctx, game);
}

/**
 * O mundo de uma Etapa, sem nada da Corrida: chão, Pista, Rotas, Poças, pórticos e
 * objetos. Está separado porque o editor de pista (`tools/pista.html`) desenha a mesma
 * coisa — e um editor que mostra algo diferente do jogo não serve para posicionar nada.
 */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  cam: Vec,
  width: number,
  height: number,
  from: number,
  to: number,
  props: readonly Prop[] = sceneryOf(stage),
): void {
  const palette = stage.biome.palette;
  const biomeId = stage.biome.id;
  const scenery = hasScenery(biomeId);

  // O Terreno quando o Bioma já tem tileset; o ladrilho único é o que sobrou para os
  // Biomas ainda não refeitos.
  if (!drawTerreno(ctx, stage, cam, width, height) && scenery) {
    drawGround(ctx, biomeId, cam, width, height, palette.background);
  }

  const surface = (scenery && trackFill(ctx, biomeId)) || palette.track;

  // O relevo vai sobre o chão e sob a Pista: a Pista é plana e não sobe encosta nenhuma.
  drawRelevo(ctx, stage, cam, width, height);

  drawLeito(ctx, stage, from, to, surface);
  drawBranches(ctx, stage, from, to, surface);
  // Sobre o leito e debaixo de tudo o mais: a Poça é chão, não objeto.
  drawPuddles(ctx, stage, cam, width, height);

  if (scenery) {
    drawGates(ctx, stage);
    drawProps(ctx, biomeId, props, cam, width, height);
  }
}

/** Quantos pontos da Linha Central um trecho de leito cobre antes de trocar de textura. */
const TRECHO_DE_LEITO = 90;

/**
 * O leito da Pista, em trechos.
 *
 * Era uma textura só do começo ao fim, e numa Pista de vinte e três mil pixels isso se lê
 * como um corredor infinito da mesma coisa. Agora cada trecho sorteia a sua variante — o
 * liso, o de sulcos fundos, o de cascalho, o coberto de areia — a partir da Semente, que
 * é o que mantém a Etapa igual a si mesma.
 */
function drawLeito(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  from: number,
  to: number,
  padrao: string | CanvasPattern,
): void {
  const variantes = bedCount(stage.biome.id);
  if (variantes <= 1 || typeof padrao === 'string') {
    drawPathWindow(ctx, stage.track.main, from, to, padrao, stage.biome.palette.edge);
    return;
  }

  const semente = seedFromStageId(`${stage.id}-leito`);
  const primeiro = Math.floor(from / TRECHO_DE_LEITO);
  const ultimo = Math.floor(to / TRECHO_DE_LEITO);

  for (let t = primeiro; t <= ultimo; t++) {
    // Um trecho vizinho nunca repete a variante do anterior: dois trechos iguais lado a
    // lado são o mesmo corredor infinito que se está tentando quebrar.
    const anterior = ((semente + (t - 1) * 2654435761) >>> 0) % variantes;
    const bruto = ((semente + t * 2654435761) >>> 0) % variantes;
    const variante = bruto === anterior ? (bruto + 1) % variantes : bruto;

    const fill = trackFill(ctx, stage.biome.id, variante) ?? padrao;
    // Um ponto de sobreposição entre trechos: sem ele a costura vira uma linha de fundo.
    const de = Math.max(from, t * TRECHO_DE_LEITO);
    const ate = Math.min(to, (t + 1) * TRECHO_DE_LEITO + 1);
    if (ate > de) drawPathWindow(ctx, stage.track.main, de, ate, fill, stage.biome.palette.edge);
  }
}

export function windowAround(path: Path, index: number): [number, number] {
  return [Math.max(0, index - 200), Math.min(path.center.length - 1, index + 600)];
}

function drawPathWindow(
  ctx: CanvasRenderingContext2D,
  path: Path,
  from: number,
  to: number,
  fill: string | CanvasPattern,
  edge: string,
): void {
  if (to <= from) return;

  ctx.beginPath();
  ctx.moveTo(path.left[from].x, path.left[from].y);
  for (let i = from + 1; i <= to; i++) ctx.lineTo(path.left[i].x, path.left[i].y);
  for (let i = to; i >= from; i--) ctx.lineTo(path.right[i].x, path.right[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.strokeStyle = edge;
  ctx.lineWidth = 4;
  for (const side of [path.left, path.right]) {
    ctx.beginPath();
    ctx.moveTo(side[from].x, side[from].y);
    for (let i = from + 1; i <= to; i++) ctx.lineTo(side[i].x, side[i].y);
    ctx.stroke();
  }
}

/**
 * As Rotas Alternativas. A boca da Bifurcação é desenhada igual à Pista de propósito:
 * se o caminho errado já fosse escuro na entrada, não haveria decisão a tomar.
 */
function drawBranches(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  from: number,
  to: number,
  surface: string | CanvasPattern,
): void {
  const { track, biome } = stage;

  for (const branch of track.branches) {
    const end = branch.rejoinIndex ?? branch.forkIndex + branch.path.center.length;
    if (end < from || branch.forkIndex > to) continue;

    const last = branch.path.center.length - 1;
    const reveal = Math.round(last * TUNING.routeRevealAt);

    drawPathWindow(ctx, branch.path, 0, reveal, surface, biome.palette.edge);

    if (branch.kind === 'shortcut') {
      drawPathWindow(ctx, branch.path, reveal, last, surface, biome.palette.edge);
    } else {
      drawPathWindow(ctx, branch.path, reveal, last, surface, OFF_ROUTE_EDGE);
      drawPathWindow(ctx, branch.path, reveal, last, OFF_ROUTE_FILL, OFF_ROUTE_EDGE);
    }
  }
}

/**
 * A placa de rota: diz de que lado fica o Caminho mais rápido, antes da Bifurcação.
 * É a única informação que o jogador tem na hora de escolher — sem ela a Bifurcação
 * seria uma moeda jogada na primeira passagem por cada Etapa.
 */
function drawForkSigns(ctx: CanvasRenderingContext2D, game: Game, from: number, to: number): void {
  const { track } = game.stage;

  for (const branch of track.branches) {
    const at = branch.forkIndex - 40;
    if (at < from || at > to || at < 1) continue;

    // Atalho: a placa manda entrar. Desvio ou beco: manda seguir pelo outro lado.
    const towards: -1 | 1 = branch.kind === 'shortcut' ? branch.side : ((-branch.side) as -1 | 1);
    drawSign(ctx, track, at, towards);
  }
}

function drawSign(ctx: CanvasRenderingContext2D, track: Track, index: number, towards: -1 | 1): void {
  const c = track.main.center;
  const a = c[index - 1];
  const b = c[index];
  const heading = Math.atan2(b.y - a.y, b.x - a.x);
  const offset = track.width / 2 + 34;

  ctx.save();
  ctx.translate(b.x - Math.sin(heading) * offset * -1, b.y + Math.cos(heading) * offset * -1);
  ctx.rotate(heading);

  ctx.fillStyle = '#12351d';
  ctx.strokeStyle = '#7ce38b';
  ctx.lineWidth = 2.5;
  roundedRect(ctx, -20, -13, 40, 26, 4);
  ctx.fill();
  ctx.stroke();

  // Seta apontando para o lado do Caminho recomendado.
  ctx.strokeStyle = '#7ce38b';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-11, 0);
  ctx.lineTo(11, 0);
  ctx.moveTo(4, -7 * towards);
  ctx.lineTo(11, 0);
  ctx.lineTo(4, 7 * towards);
  ctx.stroke();

  ctx.restore();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * As Poças. Precisam ser lidas antes de serem pisadas, senão a Derrapagem vira azar:
 * escuras contra o leito, com um brilho na borda que é o que denuncia água de longe.
 */
function drawPuddles(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  cam: Vec,
  width: number,
  height: number,
): void {
  const puddles = puddlesOf(stage);
  if (puddles.length === 0) return;

  for (const puddle of puddles) {
    const reach = puddle.radius * puddle.stretch;
    if (puddle.x < cam.x - reach || puddle.x > cam.x + width + reach) continue;
    if (puddle.y < cam.y - reach || puddle.y > cam.y + height + reach) continue;
    puddleShape(ctx, puddle);
  }
}

function puddleShape(ctx: CanvasRenderingContext2D, puddle: Puddle): void {
  ctx.save();
  ctx.translate(puddle.x, puddle.y);
  ctx.rotate(puddle.angle);
  ctx.scale(puddle.stretch, 1);

  ctx.beginPath();
  ctx.arc(0, 0, puddle.radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(34, 25, 14, 0.66)';
  ctx.fill();

  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(126, 148, 106, 0.55)';
  ctx.stroke();

  // O reflexo: sem ele a Poça se lê como buraco, e buraco o jogador tenta desviar sempre.
  ctx.beginPath();
  ctx.ellipse(-puddle.radius * 0.25, -puddle.radius * 0.3, puddle.radius * 0.4, puddle.radius * 0.18, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(198, 226, 206, 0.2)';
  ctx.fill();

  ctx.restore();
}

function drawFinishLine(ctx: CanvasRenderingContext2D, path: Path, color: string): void {
  const last = path.center.length - 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.setLineDash([12, 12]);
  ctx.beginPath();
  ctx.moveTo(path.left[last].x, path.left[last].y);
  ctx.lineTo(path.right[last].x, path.right[last].y);
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * As cores do Acelerador, do freio ao fundo.
 *
 * Verde, amarelo e vermelho porque é o que qualquer um lê sem manual — e porque o
 * Acelerador é a única coisa do jogo que tem "muito" e "pouco" numa escala só. As três
 * saem da paleta-mestra e são legíveis nos três Biomas: no gelo claro, na areia e no
 * verde da floresta.
 */
const ACELERADOR = [
  { t: 0, cor: [255, 95, 86] },
  { t: 0.5, cor: [255, 193, 77] },
  { t: 1, cor: [111, 227, 138] },
] as const;

function corDoAcelerador(t: number, alfa = 1): string {
  const fim = ACELERADOR.findIndex((p) => t <= p.t);
  if (fim <= 0) return `rgba(${ACELERADOR[0].cor.join(',')},${alfa})`;

  const a = ACELERADOR[fim - 1];
  const b = ACELERADOR[fim];
  const k = (t - a.t) / (b.t - a.t);
  const c = a.cor.map((v, i) => Math.round(v + (b.cor[i] - v) * k));
  return `rgba(${c.join(',')},${alfa})`;
}

let noiteCanvas: HTMLCanvasElement | null = null;

/**
 * A noite, e os dois faróis que abrem um buraco nela.
 *
 * A escuridão é uma camada por cima do mundo inteiro, e os faróis são o que se apaga
 * dela — não luz somada, mas escuro subtraído. É o que faz o que está fora do facho
 * ficar de fato invisível em vez de só escuro, que é a diferença entre correr de noite e
 * correr com um filtro azul por cima.
 *
 * O que sobra dentro do facho é a Pista imediata. O resto da Etapa o jogador tem de
 * **saber**: de noite o caderno do navegador deixa de ser conforto e vira o instrumento.
 */
function drawNoite(ctx: CanvasRenderingContext2D, game: Game, cam: Vec): void {
  if (!game.stage.biome.noite) return;

  const { width, height } = ctx.canvas;
  noiteCanvas ??= document.createElement('canvas');
  const camada = noiteCanvas;
  if (camada.width !== width || camada.height !== height) {
    camada.width = width;
    camada.height = height;
  }

  const n = camada.getContext('2d');
  if (!n) return;

  n.clearRect(0, 0, width, height);
  n.fillStyle = 'rgba(4, 6, 14, 0.93)';
  n.fillRect(0, 0, width, height);

  const x = game.car.x - cam.x;
  const y = game.car.y - cam.y;

  // Os faróis nascem do capô, não do meio do Carro: um facho que sai de trás do para-brisa
  // ilumina o próprio Carro e entrega que é um truque de tela.
  const capo = TUNING.carScreenSize * 0.34;
  const fx = x + Math.cos(game.car.heading) * capo;
  const fy = y + Math.sin(game.car.heading) * capo;

  n.globalCompositeOperation = 'destination-out';

  for (const lado of [-1, 1]) {
    const angulo = game.car.heading + lado * 0.16;
    const alcance = TUNING.alcanceDoFarol;
    const brilho = n.createRadialGradient(fx, fy, capo, fx, fy, alcance);
    brilho.addColorStop(0, 'rgba(0,0,0,1)');
    brilho.addColorStop(0.55, 'rgba(0,0,0,0.85)');
    brilho.addColorStop(1, 'rgba(0,0,0,0)');

    n.fillStyle = brilho;
    n.beginPath();
    n.moveTo(fx, fy);
    n.arc(fx, fy, alcance, angulo - TUNING.aberturaDoFarol / 2, angulo + TUNING.aberturaDoFarol / 2);
    n.closePath();
    n.fill();
  }

  // Uma auréola curta em volta do Carro: sem ela o jogador perde o próprio carro de vista
  // no instante em que ele gira, que é justamente o instante em que precisa vê-lo.
  const perto = n.createRadialGradient(x, y, 0, x, y, TUNING.auroraDoCarro);
  perto.addColorStop(0, 'rgba(0,0,0,0.9)');
  perto.addColorStop(1, 'rgba(0,0,0,0)');
  n.fillStyle = perto;
  n.beginPath();
  n.arc(x, y, TUNING.auroraDoCarro, 0, Math.PI * 2);
  n.fill();

  n.globalCompositeOperation = 'source-over';
  ctx.drawImage(camada, 0, 0);
}

/**
 * O desenho de um chevron, em pixels de arte. Dois de espessura, ponta à direita.
 *
 * É uma tabela e não uma curva porque o resto do jogo é pixel art: uma seta traçada com
 * linha e ponta arredondada seria a única coisa vetorial na tela, e essa é exatamente a
 * mistura que o Estilo existe para não ter.
 */
const CHEVRON = [
  '##...',
  '.##..',
  '..##.',
  '...##',
  '..##.',
  '.##..',
  '##...',
];

/** Tamanho de um pixel de arte da mira, em pixels de tela. */
const PIXEL_DA_MIRA = 2;

/** Distância entre um chevron e o seguinte, em pixels de tela. */
const PASSO_DA_MIRA = 17;

/**
 * O Ponto de Mira desenhado como uma fileira de chevrons.
 *
 * Era uma linha tracejada cuja espessura crescia com o Acelerador — informação verdadeira
 * e ilegível: ninguém compara espessura de linha no meio de uma curva. A fileira diz as
 * mesmas duas coisas de forma direta, e diz uma terceira de graça: **para onde** os
 * chevrons apontam é a direção que o Carro quer, **a cor** é o quanto ele anda, e
 * **quantos** são é o quão longe o cursor está — a fileira cresce junto com o acelerador.
 *
 * Desenhada em coordenadas de tela, e não de mundo, para cada bloco cair inteiro numa
 * casa da grade de pixels. Em coordenadas de mundo a câmera fracionária borraria todos.
 */
function drawMira(ctx: CanvasRenderingContext2D, game: Game, cam: Vec): void {
  if (game.phase !== 'running') return;

  const t = clamp01(throttleOf(game.car, categoryOf(game)));
  const cor = corDoAcelerador(t);
  const carro = { x: game.car.x - cam.x, y: game.car.y - cam.y };
  const mira = { x: game.aim.x - cam.x, y: game.aim.y - cam.y };
  const dx = mira.x - carro.x;
  const dy = mira.y - carro.y;
  const distancia = Math.hypot(dx, dy);

  ctx.save();
  ctx.fillStyle = cor;

  // A zona morta, em blocos: dentro dela a direção deixa de responder, e o anel é a única
  // coisa que diz isso antes de o jogador estranhar o volante. Bloco maior que o do
  // chevron de propósito — sobre o chão texturado, o de dois pixels sumia.
  ctx.globalAlpha = distancia > TUNING.aimDeadzone ? 0.5 : 1;
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const bx = Math.round(carro.x + Math.cos(a) * TUNING.aimDeadzone);
    const by = Math.round(carro.y + Math.sin(a) * TUNING.aimDeadzone);
    ctx.fillRect(bx, by, 3, 3);
  }
  ctx.globalAlpha = 1;

  if (distancia < 1) return ctx.restore();

  const ux = dx / distancia;
  const uy = dy / distancia;

  if (distancia <= TUNING.aimDeadzone) {
    // Dentro da zona morta o Ponto de Mira controla só o Acelerador. Um chevron apontando
    // para algum lado prometeria uma direção que o volante não vai obedecer.
    bloco(ctx, mira.x, mira.y);
    bloco(ctx, mira.x + PIXEL_DA_MIRA, mira.y);
    bloco(ctx, mira.x, mira.y + PIXEL_DA_MIRA);
    bloco(ctx, mira.x + PIXEL_DA_MIRA, mira.y + PIXEL_DA_MIRA);
    return ctx.restore();
  }

  // A fileira anda para a frente enquanto se acelera: é o que separa "estou a fundo" de
  // "estou parado apontando para longe" num relance, sem ler número nenhum.
  const marcha = (performance.now() / 1000) * (18 + t * 46);
  const primeiro = TUNING.aimDeadzone + PASSO_DA_MIRA * 0.6;
  const inicio = primeiro + (marcha % PASSO_DA_MIRA);

  for (let d = inicio; d < distancia - 2; d += PASSO_DA_MIRA) {
    // O último some aos poucos, senão a fileira pisca a cada passo que ela anda.
    const sobra = (distancia - 2 - d) / PASSO_DA_MIRA;
    ctx.globalAlpha = sobra < 1 ? sobra : 1;
    chevron(ctx, carro.x + ux * d, carro.y + uy * d, ux, uy);
  }

  ctx.globalAlpha = 1;
  chevron(ctx, mira.x, mira.y, ux, uy);
  ctx.restore();
}

/** Um bloco de pixel encaixado na grade da tela. */
function bloco(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillRect(Math.round(x), Math.round(y), PIXEL_DA_MIRA, PIXEL_DA_MIRA);
}

/**
 * Um chevron girado. Cada bloco é posicionado e arredondado por conta própria, em vez de
 * girar o canvas: girar o canvas suavizaria as bordas, e bloco de pixel art não tem borda
 * suave — ele cai inteiro numa casa ou na vizinha.
 */
function chevron(ctx: CanvasRenderingContext2D, x: number, y: number, ux: number, uy: number): void {
  const u = PIXEL_DA_MIRA;
  const meioX = (CHEVRON[0].length - 1) / 2;
  const meioY = (CHEVRON.length - 1) / 2;

  for (let linha = 0; linha < CHEVRON.length; linha++) {
    for (let coluna = 0; coluna < CHEVRON[linha].length; coluna++) {
      if (CHEVRON[linha][coluna] !== '#') continue;
      const lx = (coluna - meioX) * u;
      const ly = (linha - meioY) * u;
      bloco(ctx, x + lx * ux - ly * uy, y + lx * uy + ly * ux);
    }
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function drawCar(ctx: CanvasRenderingContext2D, game: Game, color: string): void {
  const r = TUNING.carRadius;
  const { x, y, heading } = game.car;

  drawSkid(ctx, game);

  // A Batida precisa de um sinal que o sprite não dá: um anel no ponto do impacto.
  if (game.phase === 'crashed') {
    ctx.strokeStyle = '#ff4d4d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (drawCarSprite(ctx, game.carColor, x, y, heading)) return;

  // Enquanto o sprite não carrega, o triângulo continua mostrando a direção.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.fillStyle = game.phase === 'crashed' ? '#ff4d4d' : color;
  ctx.beginPath();
  ctx.moveTo(r * 1.8, 0);
  ctx.lineTo(-r, r * 0.9);
  ctx.lineTo(-r, -r * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * O rastro de Derrapagem: o Carro anda numa direção e aponta noutra, e sem o rastro essa
 * diferença some no meio da rotação do sprite. O traço sai por onde ele *veio*.
 */
function drawSkid(ctx: CanvasRenderingContext2D, game: Game): void {
  if (game.phase !== 'running') return;

  const slip = Math.abs(slipOf(game.car));
  if (slip < 0.06) return;

  const length = Math.min(slip, 1) * 90;
  const { x, y, drift } = game.car;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(drift);
  ctx.globalAlpha = Math.min(slip * 1.6, 0.7);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';

  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, side * TUNING.carRadius * 0.6);
    ctx.lineTo(-length, side * TUNING.carRadius * 0.6);
    ctx.stroke();
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Seletor de cor do Carro. Sempre visível: a escolha é anterior à primeira Corrida. */
function drawCarPicker(ctx: CanvasRenderingContext2D, game: Game): void {
  const size = 18;
  const gap = 8;
  const x = ctx.canvas.width - 24 - (size * CAR_COLORS.length + gap * (CAR_COLORS.length - 1));
  const y = ctx.canvas.height - 34;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  CAR_COLORS.forEach((color, i) => {
    const cx = x + i * (size + gap);
    const chosen = color === game.carColor;

    ctx.globalAlpha = chosen ? 1 : 0.4;
    ctx.fillStyle = CAR_SWATCHES[color];
    ctx.fillRect(cx, y, size, size);

    if (chosen) {
      ctx.strokeStyle = game.stage.biome.palette.text;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 2.5, y - 2.5, size + 5, size + 5);
    }

    ctx.fillStyle = game.stage.biome.palette.text;
    ctx.font = '600 11px "Saira Condensed", "Arial Narrow", system-ui, sans-serif';
    ctx.globalAlpha = chosen ? 0.9 : 0.35;
    ctx.fillText(String(i + 1), cx + size / 2 - 3, y + size + 4);
  });

  ctx.globalAlpha = 1;
}

/** Vermelho para curva fechada, âmbar para média, verde para rápida. */
function severityColor(severity: number): string {
  if (severity <= 2) return '#ff5a5a';
  if (severity <= 4) return '#ffc14d';
  return '#7ce38b';
}

/**
 * As placas de curva na beira da estrada: o jogador lê a Pista sem tirar os olhos dela.
 * Ficam no mundo, na entrada da curva, apontando para o lado dela.
 */
function drawNoteMarkers(ctx: CanvasRenderingContext2D, game: Game): void {
  const path = currentPath(game);
  const step = game.stage.track.step;
  const width = game.stage.track.width;

  for (const note of path.notes) {
    const ahead = (note.startIndex - game.route.index) * step;
    if (ahead < -200 || ahead > TUNING.paceNoteLookahead) continue;

    const at = path.center[note.startIndex];
    const prev = path.center[Math.max(0, note.startIndex - 2)];
    const heading = Math.atan2(at.y - prev.y, at.x - prev.x);

    // Fora do Caminho, do lado para onde a curva vai — sem cobrir o traçado.
    const offset = width / 2 + 26;
    const px = at.x - Math.sin(heading) * offset * -note.direction;
    const py = at.y + Math.cos(heading) * offset * -note.direction;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(heading);
    ctx.globalAlpha = ahead > 0 ? 0.45 + 0.55 * (1 - ahead / TUNING.paceNoteLookahead) : 1;
    drawChevrons(ctx, note);
    ctx.restore();
  }

  ctx.globalAlpha = 1;
}

function drawChevrons(ctx: CanvasRenderingContext2D, note: PaceNote): void {
  const count = Math.ceil((7 - note.severity) / 2);
  const size = 11;

  ctx.strokeStyle = severityColor(note.severity);
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * size * 1.1;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.5, -size * 0.7 * note.direction);
    ctx.lineTo(x + size * 0.5, 0);
    ctx.lineTo(x - size * 0.5, size * 0.7 * note.direction);
    ctx.stroke();
  }
}

/** O caderno do navegador: a curva atual e a seguinte, chamadas com antecedência. */
function drawPaceNotes(ctx: CanvasRenderingContext2D, game: Game): void {
  if (game.phase !== 'running') return;

  const path = currentPath(game);
  const upcoming = nextNotes(path.notes, game.route.index, game.stage.track.step);
  const right = ctx.canvas.width - 32;
  let y = 26;

  upcoming.forEach(({ note, distance }, i) => {
    if (distance > TUNING.paceNoteLookahead) return;

    const scale = i === 0 ? 1 : 0.6;
    const color = severityColor(note.severity);
    const inside = distance <= 0;

    ctx.save();
    ctx.translate(right, y);
    ctx.scale(scale, scale);

    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.globalAlpha = i === 0 ? 1 : 0.55;

    ctx.save();
    ctx.translate(-56, 26);
    ctx.rotate(note.direction > 0 ? Math.PI / 2 : -Math.PI / 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 22);
    ctx.lineTo(0, -14);
    ctx.moveTo(-13, -3);
    ctx.lineTo(0, -18);
    ctx.lineTo(13, -3);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = color;
    ctx.font = '46px "Share Tech Mono", ui-monospace, monospace';
    ctx.fillText(String(note.severity), 0, 0);

    ctx.fillStyle = game.stage.biome.palette.text;
    ctx.font = '15px "Share Tech Mono", ui-monospace, monospace';
    ctx.fillText(
      inside
        ? note.long
          ? 'agora · longa'
          : 'agora'
        : `${metresTo(distance)} m${note.long ? ' · longa' : ''}`,
      0,
      50,
    );

    ctx.restore();
    ctx.globalAlpha = 1;
    y += i === 0 ? 92 : 60;
  });
}

/** Arredondado de 10 em 10: o navegador chama distâncias, não mede. */
function metresTo(distance: number): number {
  return Math.round(distance / TUNING.pixelsPerMeter / 10) * 10;
}

/**
 * Sem isto o jogador não descobre que a distância do cursor é o acelerador —
 * a regra central do jogo ficaria invisível.
 */
function drawSpeedometer(ctx: CanvasRenderingContext2D, game: Game): void {
  const throttle = throttleOf(game.car, categoryOf(game));
  const kmh = Math.round((game.car.speed / TUNING.pixelsPerMeter) * 3.6);
  const x = 36;
  const y = 84;
  const w = 178;
  const h = 6;

  ctx.fillStyle = game.stage.biome.palette.text;
  ctx.globalAlpha = 0.16;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;

  // A mesma escala da flecha da mira, e de propósito: dois medidores do mesmo Acelerador
  // com cores opostas — e era isso que acontecia — não informam, confundem.
  ctx.fillStyle = corDoAcelerador(throttle);
  ctx.fillRect(x, y, w * throttle, h);

  ctx.fillStyle = game.stage.biome.palette.text;
  ctx.font = NUMERO(22);
  ctx.fillText(String(kmh), x, y + 12);
  const largura = ctx.measureText(String(kmh)).width;

  ctx.font = PLACA;
  ctx.globalAlpha = 0.6;
  ctx.fillText('KM/H', x + largura + 6, y + 20);
  ctx.globalAlpha = 1;
}


// ------------------------------------------------------------- Engolida

/**
 * O Bioma engolindo o Carro que ficou tempo demais fora da Pista.
 *
 * Cada Bioma tem a sua, e isso não é enfeite: o fora da Pista não é um estacionamento
 * neutro onde dá para esperar — ele pertence ao lugar, e o lugar tem cara. No Deserto
 * quem cobra é o verme; no Gelo, a água por baixo.
 *
 * Tudo aqui é procedural e desenhado no mundo, em cima do Carro, sem sprite nenhum: são
 * seis animações de uma vez, e seis folhas de arte seriam seis dívidas de estilo.
 */
function drawEngolida(ctx: CanvasRenderingContext2D, game: Game): void {
  if (!game.devoured) return;

  const t = clamp01(game.devourTime / TUNING.engolidaTime);
  const { x, y } = game.car;
  const r = TUNING.carRadius;

  ctx.save();
  ctx.translate(x, y);

  switch (game.stage.biome.engolida) {
    case 'verme':
      verme(ctx, t, r);
      break;
    case 'areia':
      areia(ctx, t, r);
      break;
    case 'mata':
      mata(ctx, t, r);
      break;
    case 'abismo':
      abismo(ctx, t, r);
      break;
    case 'lodo':
      lodo(ctx, t, r);
      break;
    case 'gelo':
      geloRacha(ctx, t, r);
      break;
  }

  ctx.restore();
}

/**
 * Shai-Hulud. A areia afunda primeiro — o funil é o aviso —, a boca abre por baixo do
 * Carro com os dentes voltados para dentro, e fecha. O verme não é desenhado inteiro de
 * propósito: o que assusta é a boca, e um verme visto de cima é um tubo.
 */
function verme(ctx: CanvasRenderingContext2D, t: number, r: number): void {
  const funil = r * (2 + 26 * easeIn(t));

  // O funil de areia sendo puxado para baixo.
  const g = ctx.createRadialGradient(0, 0, funil * 0.15, 0, 0, funil);
  g.addColorStop(0, 'rgba(20, 12, 6, 0.95)');
  g.addColorStop(0.55, 'rgba(120, 88, 46, 0.75)');
  g.addColorStop(1, 'rgba(120, 88, 46, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, funil, 0, Math.PI * 2);
  ctx.fill();

  // Anéis de areia girando para dentro: é o que diz que aquilo suga.
  ctx.strokeStyle = 'rgba(232, 176, 75, 0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const raio = funil * (0.35 + i * 0.22);
    ctx.beginPath();
    ctx.arc(0, 0, raio, t * 9 + i, t * 9 + i + 2.4);
    ctx.stroke();
  }

  if (t < 0.25) return;

  // A boca: um círculo preto com dentes, que abre e fecha em cima do Carro.
  const abertura = Math.sin(clamp01((t - 0.25) / 0.75) * Math.PI);
  const boca = r * (1.5 + 9 * abertura);

  ctx.fillStyle = '#0a0705';
  ctx.beginPath();
  ctx.arc(0, 0, boca, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#d9c9a8';
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const ponta = boca * 0.58;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * boca, Math.sin(a) * boca);
    ctx.lineTo(Math.cos(a + 0.16) * boca, Math.sin(a + 0.16) * boca);
    ctx.lineTo(Math.cos(a + 0.08) * ponta, Math.sin(a + 0.08) * ponta);
    ctx.closePath();
    ctx.fill();
  }
}

/** Dunas: a tempestade fecha e soterra. Não há bicho — o que come é o vento. */
function areia(ctx: CanvasRenderingContext2D, t: number, r: number): void {
  const raio = r * (2 + 22 * t);

  ctx.globalAlpha = Math.min(1, t * 1.6);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, raio);
  g.addColorStop(0, 'rgba(214, 184, 128, 0.98)');
  g.addColorStop(1, 'rgba(214, 184, 128, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, raio, 0, Math.PI * 2);
  ctx.fill();

  // Fiapos de areia em espiral: sem eles a tempestade é só uma mancha bege.
  ctx.strokeStyle = 'rgba(240, 220, 180, 0.55)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + t * 7;
    const de = raio * 0.25;
    const ate = raio * (0.6 + 0.35 * ((i % 3) / 3));
    ctx.beginPath();
    ctx.arc(0, 0, de + (ate - de) * 0.5, a, a + 0.6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Floresta: a mata fecha. Os cipós vêm de fora para dentro e tapam o Carro. */
function mata(ctx: CanvasRenderingContext2D, t: number, r: number): void {
  const alcance = r * 16;
  const avanco = easeIn(t);

  ctx.strokeStyle = '#1e5c31';
  ctx.lineCap = 'round';

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + i * 0.7;
    const de = alcance * (1 - avanco * 0.95);
    const ate = alcance * (1 - avanco) + r * 0.4;

    ctx.lineWidth = 3 + (i % 3);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * alcance, Math.sin(a) * alcance);
    // Curva para o cipó não ser um raio reto: mato não cresce em linha.
    ctx.quadraticCurveTo(
      Math.cos(a + 0.5) * de,
      Math.sin(a + 0.5) * de,
      Math.cos(a) * ate,
      Math.sin(a) * ate,
    );
    ctx.stroke();
  }

  // Folhagem fechando por cima no fim, quando os cipós já se encontraram.
  ctx.globalAlpha = clamp01((t - 0.55) / 0.45);
  ctx.fillStyle = '#123d21';
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * r * 1.6, Math.sin(a) * r * 1.6, r * 2.6, r * 1.5, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Montanha: o chão cede. As rachaduras abrem, e o Carro despenca no escuro. */
function abismo(ctx: CanvasRenderingContext2D, t: number, r: number): void {
  const buraco = r * (1.2 + 7 * easeIn(t));

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + i;
    ctx.lineWidth = 3 - (i % 2);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * buraco * 0.8, Math.sin(a) * buraco * 0.8);
    ctx.lineTo(Math.cos(a + 0.25) * buraco * 2.4, Math.sin(a + 0.25) * buraco * 2.4);
    ctx.stroke();
  }

  ctx.fillStyle = '#05070a';
  ctx.beginPath();
  ctx.arc(0, 0, buraco, 0, Math.PI * 2);
  ctx.fill();

  // Poeira da borda desabando para dentro.
  ctx.strokeStyle = 'rgba(160, 160, 170, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, buraco * 1.08, 0, Math.PI * 2);
  ctx.stroke();
}

/** Lamaçal: o lodo traga. Devagar, com bolhas — é o único que não tem susto. */
function lodo(ctx: CanvasRenderingContext2D, t: number, r: number): void {
  const poca = r * (2 + 9 * t);

  ctx.fillStyle = '#241a10';
  ctx.beginPath();
  ctx.ellipse(0, 0, poca, poca * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(60, 44, 26, 0.9)';
  for (let i = 0; i < 10; i++) {
    // Cada bolha nasce e estoura no seu tempo, escalonadas ao longo da animação.
    const fase = (t * 2.2 + i * 0.37) % 1;
    const a = i * 2.1;
    const d = poca * 0.55 * ((i % 4) / 4 + 0.25);
    ctx.globalAlpha = 1 - fase;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.35 * (0.4 + fase), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Gelo: a placa racha e a água leva. O que mata aqui é o que está por baixo. */
function geloRacha(ctx: CanvasRenderingContext2D, t: number, r: number): void {
  const alcance = r * (3 + 12 * t);

  ctx.strokeStyle = 'rgba(120, 170, 200, 0.9)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + i * 0.9;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    // Quebrada no meio: rachadura reta não se lê como rachadura.
    ctx.lineTo(Math.cos(a) * alcance * 0.5, Math.sin(a) * alcance * 0.5);
    ctx.lineTo(Math.cos(a + 0.3) * alcance, Math.sin(a + 0.3) * alcance);
    ctx.stroke();
  }

  ctx.globalAlpha = clamp01((t - 0.35) / 0.65);
  ctx.fillStyle = '#06222e';
  ctx.beginPath();
  ctx.arc(0, 0, r * (1.5 + 5 * t), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Devagar no começo, rápido no fim. É o que faz a coisa parecer que puxa. */
function easeIn(t: number): number {
  return t * t;
}

function drawOffRouteWarning(ctx: CanvasRenderingContext2D, game: Game): void {
  if (game.phase !== 'running') return;

  // A Escapada vem primeiro: estar fora da Pista é mais urgente que estar na Rota errada,
  // e os dois avisos no mesmo lugar ao mesmo tempo não se leem.
  if (game.offTrack) {
    // A contagem é mostrada porque um prazo que o jogador não vê não é um prazo, é uma
    // armadilha. Os três últimos segundos vão em números inteiros grandes, no meio.
    const resta = runoffLeft(game);
    aviso(ctx, game, `FORA DA PISTA · ${Math.ceil(resta)}`);
    if (resta <= 3) contagem(ctx, resta);
    return;
  }

  if (!isOffRoute(game.stage.track, game.route, TUNING.routeRevealAt)) return;

  const pulse = 0.55 + 0.45 * Math.sin(game.elapsed * 8);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ff6b6b';
  ctx.globalAlpha = pulse;
  ctx.font = '700 32px "Saira Condensed", "Arial Narrow", system-ui, sans-serif';
  ctx.fillText('FORA DA ROTA', ctx.canvas.width / 2, 28);
  ctx.globalAlpha = 1;
}

/** Os últimos segundos da Escapada, grandes o bastante para serem vistos pelo canto do olho. */
function contagem(ctx: CanvasRenderingContext2D, resta: number): void {
  const fracao = resta - Math.floor(resta);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ff4d4d';
  // Cada segundo entra grande e encolhe: o pulso vem do próprio relógio, não de um seno.
  ctx.globalAlpha = 0.25 + 0.5 * fracao;
  ctx.font = `700 ${Math.round(90 + 60 * fracao)}px "Saira Condensed", "Arial Narrow", system-ui, sans-serif`;
  ctx.fillText(String(Math.ceil(resta)), ctx.canvas.width / 2, ctx.canvas.height / 2);
  ctx.globalAlpha = 1;
}

/**
 * Como a Corrida acabou, na palavra do lugar. A Engolida tem título próprio por Bioma
 * porque foi o Bioma que cobrou — dizer "BATIDA" ali seria descrever a coisa errada.
 */
function tituloDoFim(game: Game): string {
  if (!game.devoured) return game.hitBarrier ? 'SEM SAÍDA' : 'BATIDA';

  switch (game.stage.biome.engolida) {
    case 'verme':
      return 'SHAI-HULUD';
    case 'areia':
      return 'SOTERRADO';
    case 'mata':
      return 'A MATA FECHOU';
    case 'abismo':
      return 'O CHÃO CEDEU';
    case 'lodo':
      return 'ATOLADO';
    case 'gelo':
      return 'O GELO RACHOU';
  }
}

/** O aviso pulsante do topo. Mesma forma para os dois estados que custam tempo. */
function aviso(ctx: CanvasRenderingContext2D, game: Game, texto: string): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ff6b6b';
  ctx.globalAlpha = 0.55 + 0.45 * Math.sin(game.elapsed * 8);
  ctx.font = '700 32px "Saira Condensed", "Arial Narrow", system-ui, sans-serif';
  ctx.fillText(texto, ctx.canvas.width / 2, 28);
  ctx.globalAlpha = 1;
}

/**
 * O HUD, no vocabulário do rali: o cronômetro do carnê de tempos e a placa da prova.
 *
 * A hierarquia é a de quem está correndo — o tempo é a única coisa que importa e é a
 * única grande; o resto é ficha, e ficha se lê em caixa alta condensada, pequena.
 */
function drawHud(ctx: CanvasRenderingContext2D, game: Game): void {
  const palette = game.stage.biome.palette;
  const best = game.bestTime === null ? '—' : formatTime(game.bestTime);
  const x = 24;

  // Uma sombra atrás de tudo o que é HUD. O chão deixou de ser uma cor tingida e virou
  // arte: na neve ele é quase branco, e texto claro sobre ele sumia por completo. A
  // sombra resolve para qualquer chão, presente ou futuro, sem escurecer a arte.
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 7;
  ctx.shadowOffsetY = 1;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // A régua âmbar à esquerda do cronômetro: é a marca do carnê, e é o que separa o tempo
  // do mundo desenhado atrás dele.
  ctx.fillStyle = palette.edge;
  ctx.fillRect(x, 22, 3, 32);

  ctx.fillStyle = palette.text;
  ctx.font = NUMERO(38);
  ctx.fillText(formatTime(game.elapsed), x + 12, 18);

  ctx.font = PLACA;
  ctx.globalAlpha = 0.78;
  ctx.fillText(
    `PE ${game.stage.lap + 1} · ${game.stage.biome.name.toUpperCase()} · CAT. ${game.category} · MELHOR ${best} · TENTATIVA ${game.attempts}`,
    x + 12,
    60,
  );
  ctx.globalAlpha = 1;

  drawSpeedometer(ctx, game);
  drawCarPicker(ctx, game);
  drawOffRouteWarning(ctx, game);

  const done = progress(game);
  ctx.fillStyle = palette.edge;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(0, ctx.canvas.height - 5, ctx.canvas.width * done, 5);
  ctx.globalAlpha = 1;

  ctx.restore();

  // O Grid e a Conclusão são telas de DOM (`ui.ts`): têm lista de Ranking e campo de
  // texto, que canvas não desenha bem. Aqui fica só a Batida, que precisa ser instantânea.
  if (game.phase !== 'crashed') return;
  // Durante a Engolida a tela fica limpa: ela é a explicação do fim, e um painel por
  // cima dela tapa exatamente a única coisa que o jogador precisa ver.
  if (engolindo(game)) return;

  const crashed = true;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.textAlign = 'center';
  ctx.fillStyle = crashed ? '#ff6b6b' : palette.edge;
  ctx.font = '700 60px "Saira Condensed", "Arial Narrow", system-ui, sans-serif';
  ctx.fillText(
    crashed ? tituloDoFim(game) : 'CHEGADA',
    ctx.canvas.width / 2,
    ctx.canvas.height / 2 - 90,
  );

  ctx.fillStyle = palette.text;
  ctx.font = '20px "Share Tech Mono", ui-monospace, monospace';
  const line = crashed
    ? `sem tempo  ·  ${Math.round(done * 100)}% da pista  ·  tentativa ${game.attempts}`
    : `${formatTime(game.elapsed)}${game.newRecord ? '  ·  NOVO RECORDE' : `  ·  melhor ${best}`}`;
  ctx.fillText(line, ctx.canvas.width / 2, ctx.canvas.height / 2 - 10);

  ctx.globalAlpha = 0.6;
  ctx.font = '600 16px "Saira Condensed", "Arial Narrow", system-ui, sans-serif';
  ctx.fillText(
    'clique ou R para tentar de novo',
    ctx.canvas.width / 2,
    ctx.canvas.height / 2 + 40,
  );

  ctx.font = '600 13px "Saira Condensed", "Arial Narrow", system-ui, sans-serif';
  ctx.globalAlpha = 0.3;
  ctx.fillText(
    'G volta ao grid (trocar de categoria)  ·  Esc reinicia a progressão',
    ctx.canvas.width / 2,
    ctx.canvas.height / 2 + 78,
  );
  ctx.globalAlpha = 1;
}
