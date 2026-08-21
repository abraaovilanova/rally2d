import type { CategoryId } from './category';

/**
 * O Ranking Mundial: os Tempos de todo mundo numa Etapa numa Categoria.
 *
 * É coisa diferente do Melhor Tempo (`records.ts`). O Melhor Tempo é o seu recorde e
 * existe nos dois Modos; o Ranking é o mundo e só existe Online. Um Tempo feito Offline
 * nunca sobe depois — não teria como saber quando nem como foi feito.
 *
 * Cada Conclusão vira uma linha, inclusive as suas repetidas: é um placar de fliperama,
 * uma lista de Corridas, não de pessoas.
 */

export interface Entry {
  name: string;
  time: number;
  /** Posição no Ranking, a partir de 1. */
  place: number;
  /** Esta linha é a Corrida que o jogador acabou de fazer? */
  mine?: boolean;
}

export interface Board {
  top: Entry[];
  /** A linha do jogador, quando ela existe e está fora do topo. */
  self: Entry | null;
  total: number;
}

const TOP = 10;

/**
 * Um documento por Etapa × Categoria, com os Tempos numa subcoleção. Assim a consulta do
 * topo é um `orderBy('time')` simples: um `where` de Etapa mais um de Categoria mais o
 * `orderBy` exigiria índice composto, que quebra em produção no primeiro deploy.
 */
function boardId(stageId: string, category: CategoryId): string {
  return `${stageId}_${category}`;
}

/** Lê o Top 10. Devolve null se a rede falhar — o jogo segue sem o Ranking. */
export async function readBoard(stageId: string, category: CategoryId): Promise<Board | null> {
  try {
    const { collection, getCountFromServer, getDocs, limit, orderBy, query } = await import(
      'firebase/firestore'
    );
    const { firestore } = await import('./firebase');

    const times = collection(firestore(), 'boards', boardId(stageId, category), 'times');
    const [snap, count] = await Promise.all([
      getDocs(query(times, orderBy('time'), limit(TOP))),
      getCountFromServer(times),
    ]);

    const top = snap.docs.map((doc, i) => ({
      name: String(doc.get('name') ?? '—'),
      time: Number(doc.get('time')),
      place: i + 1,
    }));

    return { top, self: null, total: count.data().count };
  } catch {
    return null;
  }
}

/**
 * Envia uma Corrida concluída e devolve o Ranking já com ela dentro. Automático: a
 * Conclusão é o gesto, não existe botão de enviar.
 *
 * A posição vem de contar quantos Tempos são menores que o seu — só assim ela é real
 * quando você está em 4.312º, e um Top 10 sozinho não teria como dizer isso.
 */
export async function submitTime(
  stageId: string,
  category: CategoryId,
  name: string,
  time: number,
): Promise<Board | null> {
  try {
    const { addDoc, collection, getCountFromServer, query, serverTimestamp, where } = await import(
      'firebase/firestore'
    );
    const { firestore } = await import('./firebase');

    const times = collection(firestore(), 'boards', boardId(stageId, category), 'times');
    await addDoc(times, { name, time, stage: stageId, category, at: serverTimestamp() });

    const board = await readBoard(stageId, category);
    if (board === null) return null;

    const faster = await getCountFromServer(query(times, where('time', '<', time)));
    const place = faster.data().count + 1;

    // Dentro do Top 10 a linha já está na lista: marcá-la evita mostrar a mesma Corrida
    // duas vezes, uma no topo e outra no rodapé.
    const inTop = board.top.find((e) => e.place === place && e.time === time);
    if (inTop) {
      inTop.mine = true;
      return board;
    }

    return { ...board, self: { name, time, place, mine: true } };
  } catch {
    return null;
  }
}
