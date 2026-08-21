import { slipOf, throttleOf } from './car';
import { categoryOf, type Game } from './game';
import { somLigado } from './musica';

import freioUrl from '../assets/sfx/freio.wav';
import motor0 from '../assets/sfx/motor0.wav';
import motor1 from '../assets/sfx/motor1.wav';
import motor2 from '../assets/sfx/motor2.wav';
import motor3 from '../assets/sfx/motor3.wav';
import motor4 from '../assets/sfx/motor4.wav';
import motor5 from '../assets/sfx/motor5.wav';
import rabiadaUrl from '../assets/sfx/rabiada.wav';

/**
 * O som do Carro.
 *
 * Os três sons são os três verbos que o jogo já tem: o **Acelerador**, que é contínuo e
 * por isso é uma escada de seis gravações em laço; o **Freio**, que é um instante; e a
 * **Derrapagem** — a rabiada —, que é outro. Nada aqui inventa um estado novo: tudo é
 * leitura do que o modelo já diz a cada quadro.
 *
 * Feito em Web Audio e não em `<audio>` porque o laço do motor precisa ser **sem emenda**:
 * um elemento de áudio deixa um silêncio de alguns milissegundos a cada volta, e um motor
 * que engasga uma vez por segundo se lê como o jogo travando.
 */
const ESCADA = [motor0, motor1, motor2, motor3, motor4, motor5];

/**
 * Onde uma marcha vira a seguinte, em fração do Acelerador. A folga evita que o motor
 * fique trocando de gravação de ida e volta quando o cursor para em cima de um limite.
 */
const DEGRAUS = [0.16, 0.34, 0.52, 0.7, 0.88];
const FOLGA = 0.05;

const VOLUME_MOTOR = 0.4;
const VOLUME_GOLPE = 0.55;

/**
 * Acima deste ângulo de Derrapagem, em radianos, a rabiada canta.
 *
 * Medido, não escolhido: o Gelo chega a 0,29 rad numa curva forte e o Lamaçal a 0,16. Em
 * chão seco a Derrapagem é zero por construção, então a rabiada nunca soa lá — que é o
 * certo, já que no seco o Carro não perde a traseira.
 */
const RABIADA_A_PARTIR_DE = 0.13;

/** Queda do Acelerador, por segundo, que conta como frear e não como aliviar. */
const FREIO_A_PARTIR_DE = 1.6;

/** Nenhum golpe se repete antes disto, em segundos. Senão vira metralhadora. */
const ESPERA = 0.55;

let ctx: AudioContext | null = null;
let mestre: GainNode | null = null;
const buffers = new Map<string, AudioBuffer>();

let marcha = -1;
let fonte: AudioBufferSourceNode | null = null;
let ganho: GainNode | null = null;

let aceleradorAntes = 0;
let ultimoFreio = -9;
let ultimaRabiada = -9;

/** Só existe depois do primeiro gesto do jogador — antes disso o navegador não deixa. */
export function ligarMotor(): void {
  if (ctx) return;

  const Contexto = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Contexto) return;

  ctx = new Contexto();
  mestre = ctx.createGain();
  mestre.gain.value = 1;
  mestre.connect(ctx.destination);

  for (const url of [...ESCADA, freioUrl, rabiadaUrl]) carregar(url);
}

async function carregar(url: string): Promise<AudioBuffer | null> {
  const pronto = buffers.get(url);
  if (pronto) return pronto;
  if (!ctx) return null;

  try {
    const resposta = await fetch(url);
    const bruto = await resposta.arrayBuffer();
    const buffer = await ctx.decodeAudioData(bruto);
    buffers.set(url, buffer);
    return buffer;
  } catch {
    // Som é decoração: uma falha aqui não pode derrubar o quadro.
    return null;
  }
}

/**
 * Lê o Carro e ajusta o som. Chamado uma vez por quadro, e barato de propósito: o que ele
 * faz na maioria dos quadros é comparar dois números e não fazer nada.
 */
export function atualizarMotor(game: Game, dt: number): void {
  if (!ctx || !mestre) return;

  mestre.gain.value = somLigado() ? 1 : 0;
  if (!somLigado()) return;

  // Fora da Corrida o motor cala: no Grid o Carro está parado, e um motor roncando sob
  // uma tela de menu é ruído, não ambiente.
  if (game.phase !== 'running') {
    trocarMarcha(-1);
    aceleradorAntes = 0;
    return;
  }

  const acelerador = throttleOf(game.car, categoryOf(game));
  trocarMarcha(marchaDe(acelerador));

  const agora = ctx.currentTime;

  // Freio: o Acelerador caindo depressa. Não é "está devagar" — é "acabou de tirar o pé".
  const queda = (aceleradorAntes - acelerador) / Math.max(dt, 1 / 240);
  if (queda > FREIO_A_PARTIR_DE && agora - ultimoFreio > ESPERA) {
    ultimoFreio = agora;
    golpe(freioUrl, VOLUME_GOLPE);
  }
  aceleradorAntes = acelerador;

  // Rabiada: a Derrapagem passando do ângulo em que ela deixa de ser um ajuste de linha.
  if (Math.abs(slipOf(game.car)) > RABIADA_A_PARTIR_DE && agora - ultimaRabiada > ESPERA) {
    ultimaRabiada = agora;
    golpe(rabiadaUrl, VOLUME_GOLPE * 0.9);
  }
}

/** A marcha de um Acelerador, com folga para não oscilar em cima de um degrau. */
function marchaDe(acelerador: number): number {
  let nova = 0;
  for (const degrau of DEGRAUS) {
    // O limite se move contra a marcha atual: subir exige um pouco mais que descer.
    const limite = degrau + (marcha > nova ? -FOLGA : FOLGA);
    if (acelerador >= limite) nova++;
  }
  return nova;
}

function trocarMarcha(nova: number): void {
  if (nova === marcha || !ctx || !mestre) return;
  marcha = nova;

  const anterior = { fonte, ganho };
  fonte = null;
  ganho = null;

  if (anterior.fonte && anterior.ganho) {
    const g = anterior.ganho.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(g.value, ctx.currentTime);
    g.linearRampToValueAtTime(0, ctx.currentTime + 0.14);
    anterior.fonte.stop(ctx.currentTime + 0.16);
  }

  if (nova < 0) return;

  const buffer = buffers.get(ESCADA[nova]);
  if (!buffer || !ctx) return;

  const g = ctx.createGain();
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(VOLUME_MOTOR, ctx.currentTime + 0.14);
  g.connect(mestre);

  const f = ctx.createBufferSource();
  f.buffer = buffer;
  f.loop = true;
  f.connect(g);
  f.start();

  fonte = f;
  ganho = g;
}

function golpe(url: string, volume: number): void {
  const buffer = buffers.get(url);
  if (!buffer || !ctx || !mestre) return;

  const g = ctx.createGain();
  g.gain.value = volume;
  g.connect(mestre);

  const f = ctx.createBufferSource();
  f.buffer = buffer;
  f.connect(g);
  f.start();
}
