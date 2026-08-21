import { CAR_COLORS, preloadCars } from './carSprite';
import { CATEGORY_IDS, type CategoryId } from './category';
import { categoryOf, createGame, openGrid, restartProgression, retry, setCarColor, setCategory, startRace, updateGame, type Game } from './game';
import { readMode, saveMode } from './player';
import { cameraAt, render } from './render';
import { preloadScenery } from './scenery';
import { askMode, syncUI } from './ui';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d')!;

preloadCars();
preloadScenery();

const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

// Um pixel de canvas é um pixel de CSS de propósito: com devicePixelRatio no meio,
// a quantidade de Pista visível — e portanto a dificuldade — mudaria conforme a tela.
function resize(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

resize();
window.addEventListener('resize', resize);

window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

boot();

/** O Modo é escolhido uma vez e lembrado; o Grid deixa trocar depois. */
async function boot(): Promise<void> {
  const saved = readMode();
  const mode = saved ?? (await askMode());
  if (saved === null) saveMode(mode);

  const game = createGame(mode);
  listen(game);
  loop(game);
}

function listen(game: Game): void {
  // Grid e Conclusão são botões de DOM; aqui só a Batida, que precisa de um gesto rápido.
  window.addEventListener('mousedown', () => {
    if (game.phase === 'crashed') retry(game);
  });

  window.addEventListener('keydown', (e) => {
    const key = e.key.toUpperCase();

    if (key === 'R' && game.phase === 'crashed') retry(game);
    if (key === 'G') openGrid(game);
    if (e.key === ' ' && game.phase === 'grid') startRace(game);
    if (e.key === 'Escape') restartProgression(game);

    // A, B e C trocam de Categoria a qualquer momento. No meio de uma Corrida isso a
    // recomeça: um Tempo pertence à Categoria com que foi feito, do começo ao fim.
    if ((CATEGORY_IDS as readonly string[]).includes(key)) setCategory(game, key as CategoryId);

    // 1, 2, 3 trocam a cor do Carro a qualquer momento — a escolha fica salva.
    const pick = Number(e.key);
    if (Number.isInteger(pick) && pick >= 1 && pick <= CAR_COLORS.length) {
      setCarColor(game, CAR_COLORS[pick - 1]);
    }
  });
}

function loop(game: Game): void {
  let last = performance.now();

  function frame(now: number): void {
    // Um dt gigante (aba em segundo plano) atravessaria a Borda da Pista sem detectar a Batida.
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;

    // Enquanto corre, a seta do sistema some: a mira já é uma seta, e duas na tela
    // seriam uma a mais. Fora da Corrida ela volta, porque o Grid é feito de botões.
    canvas.style.cursor = game.phase === 'running' ? 'none' : 'crosshair';

    const cam = cameraAt(game, canvas);
    updateGame(game, { x: mouse.x + cam.x, y: mouse.y + cam.y }, dt);
    render(ctx, game);
    syncUI(game);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

// `categoryOf` fica exportado para o console: conferir os números do carro atual sem
// abrir o código é o tipo de coisa que se faz no meio de um tuning.
Object.assign(window, { categoryOf });
