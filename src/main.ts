import { CAR_COLORS, preloadCars } from './carSprite';
import { advance, createGame, restartProgression, retry, setCarColor, updateGame } from './game';
import { cameraAt, render } from './render';
import { preloadScenery } from './scenery';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d')!;

preloadCars();
preloadScenery();

const game = createGame();

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

/** Batida repete a Etapa; Conclusão avança para a próxima. */
function confirmOverlay(): void {
  if (game.phase === 'crashed') retry(game);
  else if (game.phase === 'finished') advance(game);
}

window.addEventListener('mousedown', confirmOverlay);
window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') confirmOverlay();
  if (e.key === 'Escape') restartProgression(game);

  // 1, 2, 3 trocam a cor do Carro a qualquer momento — a escolha fica salva.
  const pick = Number(e.key);
  if (Number.isInteger(pick) && pick >= 1 && pick <= CAR_COLORS.length) {
    setCarColor(game, CAR_COLORS[pick - 1]);
  }
});

let last = performance.now();

function frame(now: number): void {
  // Um dt gigante (aba em segundo plano) atravessaria a Borda da Pista sem detectar a Batida.
  const dt = Math.min((now - last) / 1000, 1 / 30);
  last = now;

  const cam = cameraAt(game, canvas);
  updateGame(game, { x: mouse.x + cam.x, y: mouse.y + cam.y }, dt);
  render(ctx, game);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
