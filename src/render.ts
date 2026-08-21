import { slipOf, throttleOf } from './car';
import { CAR_COLORS, CAR_SWATCHES, drawCarSprite } from './carSprite';
import { categoryOf, currentPath, progress, type Game } from './game';
import { nextNotes, type PaceNote } from './pacenotes';
import type { Path, Vec } from './path';
import { formatTime } from './records';
import { sopros } from './poeira';
import { isOffRoute } from './route';
import { bedCount, drawGates, drawGround, drawPoeira, drawProps, drawTerreno, hasScenery, sceneryOf, trackFill, type Prop } from './scenery';
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
  drawAimLine(ctx, game);
  drawCar(ctx, game, palette.car);

  ctx.restore();

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

/**
 * O Ponto de Mira desenhado como uma flecha.
 *
 * Era uma linha tracejada cuja espessura crescia com o Acelerador — informação verdadeira
 * e ilegível: ninguém compara espessura de linha no meio de uma curva. A flecha diz as
 * mesmas duas coisas de forma direta: **para onde** ela aponta é a direção que o Carro
 * quer, e **a cor** é o quanto ele está andando — vermelho colado, verde esticado.
 *
 * A ponta fica no cursor, e é ela que substitui a seta do sistema: o jogo esconde o
 * cursor enquanto corre, porque duas setas na tela seriam uma a mais.
 */
function drawAimLine(ctx: CanvasRenderingContext2D, game: Game): void {
  if (game.phase !== 'running') return;

  const t = clamp01(throttleOf(game.car, categoryOf(game)));
  const cor = corDoAcelerador(t);
  const dx = game.aim.x - game.car.x;
  const dy = game.aim.y - game.car.y;
  const distancia = Math.hypot(dx, dy);

  // A zona morta precisa ser visível: dentro dela a direção deixa de responder, e o anel
  // é a única coisa que diz isso antes de o jogador estranhar o volante.
  ctx.strokeStyle = cor;
  ctx.globalAlpha = distancia > TUNING.aimDeadzone ? 0.28 : 0.85;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(game.car.x, game.car.y, TUNING.aimDeadzone, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (distancia < 1) return;

  const ux = dx / distancia;
  const uy = dy / distancia;
  // Começa na beira da zona morta: dentro dela a haste não significaria direção nenhuma.
  const de = Math.min(TUNING.aimDeadzone, distancia);
  const ponta = 9 + t * 9;
  const ate = Math.max(de, distancia - ponta * 0.7);

  ctx.strokeStyle = cor;
  ctx.lineWidth = 2 + t * 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(game.car.x + ux * de, game.car.y + uy * de);
  ctx.lineTo(game.car.x + ux * ate, game.car.y + uy * ate);
  ctx.stroke();

  ctx.save();
  ctx.translate(game.aim.x, game.aim.y);
  ctx.fillStyle = cor;

  if (distancia <= TUNING.aimDeadzone) {
    // Dentro da zona morta o Ponto de Mira controla só o Acelerador. Uma ponta apontando
    // para algum lado prometeria uma direção que o volante não vai obedecer.
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.rotate(Math.atan2(uy, ux));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-ponta, ponta * 0.5);
    ctx.lineTo(-ponta * 0.62, 0);
    ctx.lineTo(-ponta, -ponta * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
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

function drawOffRouteWarning(ctx: CanvasRenderingContext2D, game: Game): void {
  if (game.phase !== 'running') return;
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

  const crashed = true;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.textAlign = 'center';
  ctx.fillStyle = crashed ? '#ff6b6b' : palette.edge;
  ctx.font = '700 60px "Saira Condensed", "Arial Narrow", system-ui, sans-serif';
  ctx.fillText(
    crashed ? (game.hitBarrier ? 'SEM SAÍDA' : 'BATIDA') : 'CHEGADA',
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
