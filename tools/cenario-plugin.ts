import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/**
 * A ponte entre os editores (`tools/sprites.html`, `tools/pista.html`) e os arquivos do
 * jogo.
 *
 * Sem ela os editores só saberiam mostrar e copiar, e cada ajuste de um pixel viraria uma
 * viagem pelo copiar-e-colar — que é exatamente o trabalho que eles existem para acabar.
 *
 * Só existe em desenvolvimento (`apply: 'serve'`), e escreve nos caminhos listados aqui:
 * nada do que chega pela rede escolhe onde gravar.
 */
interface Arquivo {
  caminho: string;
  conferir: (dados: any) => void;
}

const ARQUIVOS: Record<string, Arquivo> = {
  '/__cenario': { caminho: 'src/cenario.json', conferir: conferirCenario },
  '/__etapas': { caminho: 'src/cenario-etapas.json', conferir: conferirEtapas },
};

export function cenarioPlugin(): Plugin {
  const caminhos = new Set(Object.values(ARQUIVOS).map((a) => a.caminho));

  return {
    name: 'rally-cenario',
    apply: 'serve',

    /**
     * Gravar não recarrega ninguém. Sem isto o próprio editor é um cliente do módulo que
     * ele acabou de escrever: salvar derrubaria a página no meio do trabalho, levando
     * junto a câmera, a seleção e o histórico de desfazer. O jogo aberto ao lado pega a
     * mudança no próximo F5.
     */
    handleHotUpdate({ file, server }) {
      const relativo = file.slice(server.config.root.length + 1);
      if (caminhos.has(relativo)) return [];
    },

    configureServer(server) {
      for (const [rota, arquivo] of Object.entries(ARQUIVOS)) {
        const caminho = resolve(server.config.root, arquivo.caminho);

        server.middlewares.use(rota, async (req, res) => {
          res.setHeader('content-type', 'application/json; charset=utf-8');

          if (req.method === 'GET') {
            res.end(await readFile(caminho, 'utf8'));
            return;
          }

          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('{"erro":"método não suportado"}');
            return;
          }

          const corpo: Buffer[] = [];
          for await (const parte of req) corpo.push(parte as Buffer);

          try {
            // Passa pelo JSON.parse e pela conferência antes de gravar: meio arquivo
            // escrito é pior que nenhum, e é isto que o jogo importa ao compilar.
            const dados = JSON.parse(Buffer.concat(corpo).toString('utf8'));
            arquivo.conferir(dados);
            await writeFile(caminho, JSON.stringify(dados, null, 2) + '\n', 'utf8');
            res.end('{"ok":true}');
          } catch (erro) {
            res.statusCode = 400;
            res.end(JSON.stringify({ erro: String(erro instanceof Error ? erro.message : erro) }));
          }
        });
      }
    },
  };
}

/** O mínimo para o jogo não quebrar ao ler os recortes de volta. */
function conferirCenario(dados: any): void {
  if (!dados?.biomas || !dados?.sheets) throw new Error('faltam "sheets" ou "biomas"');

  for (const [id, b] of Object.entries<any>(dados.biomas)) {
    if (!dados.sheets[b.folha]) throw new Error(`${id}: folha desconhecida "${b.folha}"`);
    if (b.beira.length !== b.pesos.length) throw new Error(`${id}: beira e pesos com tamanhos diferentes`);

    const nomes = new Set(Object.keys(b.recortes));
    for (const chave of ['chao', 'leito', 'largada', 'chegada', 'plateia']) {
      if (!nomes.has(b[chave])) throw new Error(`${id}: ${chave} aponta para "${b[chave]}", que não existe`);
    }
    for (const nome of [...b.beira, ...b.publico]) {
      if (!nomes.has(nome)) throw new Error(`${id}: "${nome}" está numa lista mas não é um recorte`);
    }
    for (const [nome, r] of Object.entries<any>(b.recortes)) {
      if (![r.x, r.y, r.w, r.h].every((v) => Number.isInteger(v) && v >= 0)) {
        throw new Error(`${id}/${nome}: recorte com número inválido`);
      }
      if (r.w < 1 || r.h < 1) throw new Error(`${id}/${nome}: recorte sem tamanho`);
    }
  }
}

/** O que foi posto à mão, por Etapa. As coordenadas são do mundo, não da folha. */
function conferirEtapas(dados: any): void {
  if (typeof dados !== 'object' || dados === null || Array.isArray(dados)) {
    throw new Error('o arquivo de etapas é um objeto de etapa para lista');
  }

  for (const [id, etapa] of Object.entries<any>(dados)) {
    if (!Array.isArray(etapa?.postos)) throw new Error(`${id}: falta a lista "postos"`);

    for (const p of etapa.postos) {
      if (typeof p.sprite !== 'string' || p.sprite === '') throw new Error(`${id}: posto sem sprite`);
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error(`${id}: posto sem posição`);
      if (!Number.isFinite(p.escala) || p.escala <= 0) throw new Error(`${id}: escala inválida em "${p.sprite}"`);
      if (typeof p.espelhado !== 'boolean') throw new Error(`${id}: "espelhado" tem de ser verdadeiro ou falso`);
    }
  }
}
