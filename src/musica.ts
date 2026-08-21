import trilha1 from '../assets/musica/trilha1.mp3';
import trilha2 from '../assets/musica/trilha2.mp3';
import trilha3 from '../assets/musica/trilha3.mp3';
import trilha4 from '../assets/musica/trilha4.mp3';
import trilha5 from '../assets/musica/trilha5.mp3';
import trilha6 from '../assets/musica/trilha6.mp3';

/**
 * A Trilha: a música de um Bioma.
 *
 * É do Bioma e não da Corrida — a mesma prova soa igual em toda tentativa, e trocar de
 * prova troca de música. Uma Batida não interrompe a Trilha: interromper seria pontuar o
 * erro, e o jogo já devolve o jogador à largada sem cerimônia.
 *
 * Nada aqui entra no modelo. Se o som estiver mudo, ou se o navegador recusar tocar, o
 * jogo é exatamente o mesmo — o que não pode acontecer é uma falha de áudio derrubar um
 * quadro.
 */
const TRILHAS: Record<string, string> = {
  deserto: trilha1,
  floresta: trilha2,
  montanha: trilha3,
  gelo: trilha4,
  lamacal: trilha5,
  dunas: trilha6,
};

const CHAVE = 'rally2d.som';

/** Volume de trabalho. Música de fundo alta demais some com o resto do jogo. */
const VOLUME = 0.42;

/** Segundos de esmaecimento ao trocar de Trilha. */
const ESMAECER = 0.9;

let tocando: HTMLAudioElement | null = null;
let biomaAtual = '';
let ligado = ler();
/** O navegador só deixa tocar depois de um gesto do jogador. Este é o gesto. */
let liberado = false;

function ler(): boolean {
  return localStorage.getItem(CHAVE) !== 'mudo';
}

export function somLigado(): boolean {
  return ligado;
}

/**
 * O primeiro gesto do jogador libera o áudio. Chamado de qualquer clique ou tecla: sem
 * ele o navegador recusa tocar, e a recusa é silenciosa — o jogo pareceria sem música.
 */
export function liberarSom(): void {
  if (liberado) return;
  liberado = true;
  if (biomaAtual) tocarTrilha(biomaAtual, true);
}

export function alternarSom(): boolean {
  ligado = !ligado;
  localStorage.setItem(CHAVE, ligado ? 'ligado' : 'mudo');

  if (!ligado) {
    parar();
  } else if (biomaAtual) {
    tocarTrilha(biomaAtual, true);
  }
  return ligado;
}

/** A Trilha do Bioma. Repetir o mesmo Bioma não recomeça a música. */
export function tocarTrilha(biomaId: string, forcar = false): void {
  const fonte = TRILHAS[biomaId];
  if (fonte === undefined) return;

  const mesma = biomaId === biomaAtual;
  biomaAtual = biomaId;
  if (!ligado || !liberado) return;
  if (mesma && !forcar && tocando && !tocando.paused) return;

  const anterior = tocando;
  const nova = new Audio(fonte);
  nova.loop = true;
  nova.volume = 0;
  tocando = nova;

  // Um `play()` recusado é normal — política de autoplay, aba em segundo plano. Ele não
  // pode virar exceção não tratada no meio do laço de quadro.
  nova.play().catch(() => undefined);

  esmaecer(nova, VOLUME);
  if (anterior && anterior !== nova) esmaecer(anterior, 0, () => anterior.pause());
}

function parar(): void {
  const atual = tocando;
  tocando = null;
  if (atual) esmaecer(atual, 0, () => atual.pause());
}

/** Sobe ou desce o volume aos poucos. Corte seco de música se lê como falha do jogo. */
function esmaecer(audio: HTMLAudioElement, alvo: number, aoFim?: () => void): void {
  const passo = 1 / 30;
  const delta = ((alvo - audio.volume) * passo) / ESMAECER;

  const timer = setInterval(() => {
    const proximo = audio.volume + delta;
    const chegou = delta > 0 ? proximo >= alvo : proximo <= alvo;

    audio.volume = chegou ? alvo : Math.max(0, Math.min(1, proximo));
    if (!chegou) return;

    clearInterval(timer);
    aoFim?.();
  }, passo * 1000);
}
