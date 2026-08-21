import { CATEGORIES, CATEGORY_IDS, minTurnRadius, type CategoryId } from './category';
import { advance, openGrid, selectStage, setCategory, setMode, startRace, type Game } from './game';
import { readBoard, submitTime, type Board } from './leaderboard';
import { alternarSom, somLigado } from './musica';
import { readName, saveName, type Mode } from './player';
import { formatTime } from './records';
import { BIOMES, SELECTABLE_LAPS } from './stage';
import { TUNING } from './tuning';

const root = document.querySelector<HTMLDivElement>('#ui')!;

/**
 * O menu de abertura. Offline é o jogo inteiro; Online é o mesmo jogo mais o Ranking
 * Mundial. Um Tempo feito Offline nunca sobe depois — o jogador precisa saber disso
 * aqui, senão corre bem sem conexão e descobre no fim.
 */
export function askMode(): Promise<Mode> {
  return new Promise((resolve) => {
    show(`
      <div class="panel">
        <div class="cabecalho">
          <span class="eyebrow">Campeonato mundial de rali</span>
          <span class="eyebrow">Inscrição</span>
        </div>
        <h1>Rally 2D</h1>
        <p class="lede">Mesma pista, mesmo carro, o tempo é o que varia.</p>
        <div class="modes">
          <button data-mode="online">
            <strong>Jogar online</strong>
            <span>Seus tempos entram no ranking mundial de cada etapa.</span>
          </button>
          <button data-mode="offline">
            <strong>Jogar offline</strong>
            <span>Tudo funciona, mas nada sobe: tempos feitos offline não contam.</span>
          </button>
        </div>
      </div>
    `);

    root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
      button.onclick = () => resolve(button.dataset.mode as Mode);
    });
  });
}

/**
 * Redesenha só quando a tela de fato muda. Chamado a cada quadro, mas o DOM só é
 * reconstruído na transição — reconstruir a 60fps mataria o campo de texto do Nome no
 * meio da digitação.
 */
let painted = '';
let board: Board | null = null;
let boardKey = '';

export function syncUI(game: Game): void {
  const key = screenKey(game);
  if (key === painted) return;
  painted = key;

  if (game.phase === 'grid') drawGrid(game);
  else if (game.phase === 'finished') drawFinish(game);
  else hide();
}

function screenKey(game: Game): string {
  return [game.phase, game.stage.id, game.category, game.mode, game.attempts].join('|');
}

// ---------------------------------------------------------------- Grid

function drawGrid(game: Game): void {
  const stage = game.stage;
  const best = game.bestTime === null ? '—' : formatTime(game.bestTime);

  // "PE" é como o rali chama uma prova especial. O Grid é o controle de largada dela.
  show(`
    <div class="panel">
      <div class="cabecalho">
        <span class="eyebrow">PE ${stage.lap + 1} · ${stage.biome.name}${surfaceHint(game)}</span>
        <span class="eyebrow">Controle de largada</span>
      </div>

      <h1>Grid</h1>
      <p class="lede">Escolha a prova e o carro. Seu melhor aqui na categoria ${game.category}: <b>${best}</b></p>

      <p class="eyebrow">Prova especial</p>
      <div class="stages">${stagePicker(game)}</div>

      <p class="eyebrow">Categoria</p>
      <div class="cards">${CATEGORY_IDS.map((id) => card(id, game.category)).join('')}</div>

      ${
        game.mode === 'online'
          ? `<p class="eyebrow board-title">Resultados · ${stage.biome.name} PE ${stage.lap + 1} · categoria ${game.category}</p>`
          : ''
      }
      <div class="board" data-board>${game.mode === 'online' ? 'carregando ranking…' : ''}</div>

      <button class="go" data-go>Largar</button>
      <div class="rodape">
        <p class="foot">
          <span data-toggle-mode class="link">${
            game.mode === 'online' ? 'jogando online — mudar para offline' : 'jogando offline — mudar para online'
          }</span>
          <span class="separador">·</span>
          <span data-som class="link">som ${somLigado() ? 'ligado' : 'mudo'} (M)</span>
        </p>
      </div>
    </div>
  `);

  root.querySelectorAll<HTMLElement>('[data-stage]').forEach((el) => {
    el.onclick = () => selectStage(game, Number(el.dataset.biome), Number(el.dataset.lap));
  });
  root.querySelectorAll<HTMLElement>('[data-cat]').forEach((el) => {
    el.onclick = () => setCategory(game, el.dataset.cat as CategoryId);
  });
  root.querySelector<HTMLElement>('[data-go]')!.onclick = () => startRace(game);
  root.querySelector<HTMLElement>('[data-toggle-mode]')!.onclick = () => {
    setMode(game, game.mode === 'online' ? 'offline' : 'online');
    painted = '';
  };
  root.querySelector<HTMLElement>('[data-som]')!.onclick = (e) => {
    alternarSom();
    (e.target as HTMLElement).textContent = `som ${somLigado() ? 'ligado' : 'mudo'} (M)`;
  };

  if (game.mode === 'online') loadBoard(game);
}

/**
 * O chão que escorrega tem de ser sabido antes da largada. Descobrir no meio da primeira
 * curva não é dificuldade, é pegadinha — e o Tempo já foi.
 */
function surfaceHint(game: Game): string {
  const biome = game.stage.biome;
  const avisos: string[] = [];

  // A noite vem primeiro: escorregar é uma dificuldade, não enxergar é outra ordem de
  // problema — é a única em que o jogador precisa mudar de instrumento.
  if (biome.noite) avisos.push('de noite · só o farol');
  if (biome.grip < 1) avisos.push('pista escorregadia');
  if (biome.puddles) avisos.push('poças na pista');

  return avisos.length ? ' · ' + avisos.join(' · ') : '';
}

/**
 * Cada Etapa é uma Pista diferente e um Ranking diferente — por isso a escolha é
 * Bioma × Volta, e não só Bioma: "Deserto" não é uma Etapa, "Deserto na volta 2" é.
 */
function stagePicker(game: Game): string {
  return BIOMES.map((biome, biomeIndex) => {
    const laps = Array.from({ length: SELECTABLE_LAPS }, (_, lap) => {
      const chosen = game.progression.biomeIndex === biomeIndex && game.progression.lap === lap;
      return `<span class="lap ${chosen ? 'chosen' : ''}" data-stage data-biome="${biomeIndex}" data-lap="${lap}">${lap + 1}</span>`;
    }).join('');

    return `<div class="stage"><span style="color:${biome.palette.edge}">${biome.name}</span><span class="laps">${laps}</span></div>`;
  }).join('');
}

/**
 * Os números ficam visíveis de propósito: sem eles "Categoria A" é uma letra, e escolher
 * vira sorteio. O raio mínimo é o que liga a escolha à pista — abaixo do raio das curvas
 * fechadas, aquela curva **obriga** a frear.
 */
function card(id: CategoryId, chosen: CategoryId): string {
  const c = CATEGORIES[id];
  const kmh = (px: number) => Math.round((px / TUNING.pixelsPerMeter) * 3.6);
  const radius = Math.round(minTurnRadius(c));
  const tight = TUNING.tightCurveRadius[0];

  return `
    <div class="card ${id === chosen ? 'chosen' : ''}" data-cat="${id}">
      <h2>${id}</h2>
      <dl>
        <div><dt>máxima</dt><dd>${kmh(c.speedMax)} km/h</dd></div>
        <div><dt>mínima</dt><dd>${kmh(c.speedMin)} km/h</dd></div>
        <div><dt>giro</dt><dd>${c.turnRate}°/s</dd></div>
        <div><dt>raio a fundo</dt><dd>${radius} px${radius > tight ? ' · freia' : ''}</dd></div>
      </dl>
      <p>${c.blurb}</p>
    </div>
  `;
}

async function loadBoard(game: Game): Promise<void> {
  const key = `${game.stage.id}|${game.category}`;
  const slot = () => root.querySelector<HTMLElement>('[data-board]');

  if (boardKey !== key) {
    boardKey = key;
    board = null;
    board = await readBoard(game.stage.id, game.category);
  }

  const el = slot();
  if (el) el.innerHTML = renderBoard(board, game.category);
}

// ------------------------------------------------------------ Conclusão

function drawFinish(game: Game): void {
  const time = formatTime(game.elapsed);
  const record = game.newRecord ? '<span class="record">NOVO RECORDE</span>' : '';
  const name = readName();

  show(`
    <div class="panel">
      <div class="cabecalho">
        <span class="eyebrow">PE ${game.stage.lap + 1} · ${game.stage.biome.name} · categoria ${game.category}</span>
        <span class="eyebrow">Chegada</span>
      </div>

      <p class="eyebrow" style="margin-top:22px">Tempo da prova</p>
      <h1 class="finish">${time}</h1>
      <p class="lede">${record}</p>
      <div class="board" data-board>${game.mode === 'offline' ? 'offline: este tempo não sobe para o ranking.' : 'enviando…'}</div>
      <div data-name></div>
      <button class="go" data-next>Seguir para a próxima prova</button>
      <div class="rodape">
        <p class="foot"><span class="link" data-grid>voltar ao grid</span></p>
      </div>
    </div>
  `);

  root.querySelector<HTMLElement>('[data-next]')!.onclick = () => advance(game);
  root.querySelector<HTMLElement>('[data-grid]')!.onclick = () => openGrid(game);

  if (game.mode !== 'online') return;
  if (name === null) askName(game);
  else send(game, name);
}

/** O Nome é pedido na primeira Conclusão online, e lembrado depois. */
function askName(game: Game): void {
  const slot = root.querySelector<HTMLElement>('[data-name]')!;
  slot.innerHTML = `
    <div class="naming">
      <input data-input maxlength="16" placeholder="seu nome no ranking" autofocus />
      <button data-send>Entrar no ranking</button>
    </div>
  `;
  const boardSlot = root.querySelector<HTMLElement>('[data-board]');
  if (boardSlot) boardSlot.textContent = '';

  const input = slot.querySelector<HTMLInputElement>('[data-input]')!;
  const confirm = () => {
    if (input.value.trim() === '') return;
    saveName(input.value);
    slot.innerHTML = '';
    send(game, readName()!);
  };

  slot.querySelector<HTMLButtonElement>('[data-send]')!.onclick = confirm;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') confirm();
    e.stopPropagation();
  };
  input.focus();
}

/** Envio automático: a Conclusão é o gesto, não existe botão de enviar. */
async function send(game: Game, name: string): Promise<void> {
  const result = await submitTime(game.stage.id, game.category, name, game.elapsed);
  const el = root.querySelector<HTMLElement>('[data-board]');
  if (!el) return;

  // Rede caída não pode matar a Conclusão: avisa e o jogo segue.
  el.innerHTML =
    result === null
      ? '<p class="warn">sem conexão — este tempo não entrou no ranking.</p>'
      : renderBoard(result, game.category);

  boardKey = '';
}

// ---------------------------------------------------------------- comum

function renderBoard(board: Board | null, category: CategoryId): string {
  if (board === null) return '<p class="warn">ranking indisponível — sem conexão.</p>';
  if (board.top.length === 0) return `<p class="empty">ninguém correu esta etapa na categoria ${category} ainda.</p>`;

  const rows = [...board.top, ...(board.self ? [board.self] : [])]
    .map(
      (e) => `
      <tr class="${e.mine ? 'mine' : ''}">
        <td>${e.place}</td><td>${escapeHtml(e.name)}</td><td>${formatTime(e.time)}</td>
      </tr>`,
    )
    .join('');

  return `<table><tbody>${rows}</tbody></table>
    <p class="total">${board.total} ${board.total === 1 ? 'passagem registrada' : 'passagens registradas'}</p>`;
}

/** O Nome vem de outro jogador e vai para dentro de HTML. */
function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function show(html: string): void {
  root.innerHTML = html;
  root.hidden = false;
}

function hide(): void {
  root.hidden = true;
  root.innerHTML = '';
}
