import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/**
 * A ponte entre o editor de recortes (`tools/sprites.html`) e o arquivo do jogo.
 *
 * Sem ela o editor só saberia mostrar e copiar, e cada ajuste de um pixel viraria uma
 * viagem pelo copiar-e-colar — que é exatamente o trabalho que ele existe para acabar.
 *
 * Só existe em desenvolvimento (`apply: 'serve'`), e escreve num caminho só: nada do que
 * chega pela rede escolhe onde gravar.
 */
const ARQUIVO = 'src/cenario.json';
const ROTA = '/__cenario';

export function cenarioPlugin(): Plugin {
  return {
    name: 'rally-cenario',
    apply: 'serve',
    configureServer(server) {
      const caminho = resolve(server.config.root, ARQUIVO);

      server.middlewares.use(ROTA, async (req, res) => {
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
          // Passa pelo JSON.parse antes de gravar: meio arquivo escrito é pior que
          // nenhum, e é o `cenario.json` que o jogo importa na hora de compilar.
          const dados = JSON.parse(Buffer.concat(corpo).toString('utf8'));
          conferir(dados);
          await writeFile(caminho, JSON.stringify(dados, null, 2) + '\n', 'utf8');
          res.end('{"ok":true}');
        } catch (erro) {
          res.statusCode = 400;
          res.end(JSON.stringify({ erro: String(erro instanceof Error ? erro.message : erro) }));
        }
      });
    },
  };
}

/** O mínimo para o jogo não quebrar ao ler o arquivo de volta. */
function conferir(dados: any): void {
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
