import type { Stage } from './stage';

/**
 * O Clima: o que cai ou voa entre a câmera e o mundo.
 *
 * É a terceira forma de um Bioma ter identidade sem arte própria — depois da **Noite**,
 * que tira o que se vê, e do **Relevo**, que dá forma ao chão. Aqui o que muda é o ar.
 *
 * Clima é desenho, e só. Ele **não** mexe na Aderência: o Lamaçal escorrega porque a
 * Aderência dele é baixa, não porque chove. Se as duas coisas fossem a mesma, não daria
 * para ter chuva num chão firme, e a primeira Etapa que pedisse isso quebraria as duas.
 */
export interface Clima {
  /** Cor dos riscos. */
  cor: string;
  /** Quantos riscos por mil pixels de tela. */
  densidade: number;
  /** Direção da queda, em radianos de tela. */
  angulo: number;
  /** Velocidade da queda, em px/s. */
  velocidade: number;
  /** Comprimento de um risco, em px. */
  risco: number;
  /** Véu por cima do mundo — a chuva embranquece o ar, a areia o deixa ocre. */
  veu?: string;
}

/**
 * Um risco é calculado, não guardado: a posição sai de um embaralhamento do índice mais o
 * tempo. Sem lista, sem alocação e sem estado para reiniciar quando a Corrida reinicia —
 * o que importa aqui é o movimento, e movimento não precisa de memória.
 */
function embaralhar(n: number): number {
  let x = Math.imul(n ^ 0x9e37, 0x85eb);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

export function drawClima(ctx: CanvasRenderingContext2D, stage: Stage, tempo: number): void {
  const clima = stage.biome.clima;
  if (!clima) return;

  const { width, height } = ctx.canvas;

  if (clima.veu) {
    ctx.fillStyle = clima.veu;
    ctx.fillRect(0, 0, width, height);
  }

  const total = Math.round((width * height * clima.densidade) / 1000);
  const dx = Math.cos(clima.angulo);
  const dy = Math.sin(clima.angulo);
  // A diagonal é a maior distância que um risco precisa percorrer para dar a volta.
  const volta = width + height;

  ctx.save();
  ctx.strokeStyle = clima.cor;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();

  for (let i = 0; i < total; i++) {
    // Cada risco tem a sua própria velocidade, senão a cortina inteira cai em bloco e o
    // olho lê uma textura deslizando em vez de gotas.
    const ritmo = 0.7 + embaralhar(i * 3) * 0.6;
    const avanco = (embaralhar(i) * volta + tempo * clima.velocidade * ritmo) % volta;

    const x = (embaralhar(i * 7) * (width + volta) - volta * 0.5 + dx * avanco) % (width + volta);
    const y = (embaralhar(i * 11) * height - volta * 0.5 + dy * avanco) % (height + volta);

    ctx.moveTo(x, y);
    ctx.lineTo(x - dx * clima.risco, y - dy * clima.risco);
  }

  ctx.stroke();
  ctx.restore();
}
