"""
Dispara e colhe a fila de geração de um Bioma no PixelLab.

Retomável de propósito: o que decide se um item já foi feito é **o arquivo em disco**, não
um campo no manifesto. Com quarenta trabalhos numa fila que leva horas e esbarra em limite
de taxa, a interrupção é o caso normal, não a exceção.

    python3 tools/gerar-fila.py disparar deserto
    python3 tools/gerar-fila.py colher deserto

Precisa do MCP do PixelLab configurado neste projeto. É um passo manual, fora do jogo.
"""
import base64, json, re, subprocess, sys, time
from pathlib import Path
import mcp

RAIZ = Path('/home/abe/abraaovilanova/rally2D')
BIOMA = sys.argv[2] if len(sys.argv) > 2 else 'deserto'
MANIFESTO = RAIZ / 'tools' / f'manifesto-{BIOMA}.json'
DESTINO = RAIZ / 'assets' / 'gerados' / BIOMA
IDS = Path(f'fila-ids-{BIOMA}.json')

ESTILO = ("top-down 3/4 pixel art, single light from upper-left, short own-shadow to lower-right, "
          "no cast shadow on the ground, no ground plane, transparent background")
COMUM = dict(view='high top-down', outline='selective outline', shading='medium shading', detail='medium detail')

# Tamanho do quadro por ocupação. Múltiplos de 2 para a metade ser exata na tela.
QUADRO = {'quarto': 64, 'metade': 96, 'dois-tercos': 128, 'quadro': 160}

def alvos(manifesto):
    """O que ainda não existe em disco. O arquivo é a verdade; um campo "feito" no
    manifesto seria uma segunda verdade, e as duas discordariam na primeira interrupção."""
    for item in manifesto['itens']:
        if item['papel'] in ('tileset', 'carro', 'poeira', 'leito', 'terreno'):
            continue
        n = item.get('quadros', 1)
        nomes = [item['nome']] if n == 1 else [f"{item['nome']}-{q}" for q in range(n)]
        if all((DESTINO / f'{nome}.png').exists() for nome in nomes):
            continue
        yield item

def disparar():
    m = json.loads(MANIFESTO.read_text('utf8'))
    ids = json.loads(IDS.read_text('utf8')) if IDS.exists() else {}

    for item in alvos(m):
        n = item.get('quadros', 1)
        for q in range(n):
            nome = item['nome'] if n == 1 else f"{item['nome']}-{q}"
            if nome in ids:
                continue
            desc = item['descricao']
            if n > 1:
                # "arms down / arm raised cheering" — um quadro de cada lado da barra.
                partes = [p.strip() for p in desc.split('/')]
                desc = partes[min(q, len(partes) - 1)]
            if item['papel'] == 'publico':
                desc += ', facing the viewer'
            lado = QUADRO[item['ocupacao']]
            # O servidor limita quantos trabalhos ficam em voo; insistir devagar é o
            # que faz a fila de quarenta atravessar sem perder item.
            for tentativa in range(12):
                r = mcp.ferramenta('create_map_object', dict(
                    description=f'{desc}. {ESTILO}', width=lado, height=lado, **COMUM), timeout=180)
                txt = r.get('result', {}).get('content', [{}])[0].get('text', '')
                achado = re.search(r'id:\s*([0-9a-f-]{36})', txt)
                if achado:
                    break
                if 'rate limit' not in txt:
                    break
                time.sleep(25)
            if not achado:
                print('FALHOU', nome, txt[:120].replace(chr(10), ' ')); continue
            ids[nome] = achado.group(1)
            print('disparado', nome, lado)
            IDS.write_text(json.dumps(ids, indent=2))
    return ids

def colher():
    ids = json.loads(IDS.read_text('utf8'))
    DESTINO.mkdir(parents=True, exist_ok=True)
    pendentes = {n: i for n, i in ids.items() if not (DESTINO / f'{n}.png').exists()}

    for volta in range(60):
        if not pendentes: break
        for nome, oid in list(pendentes.items()):
            r = mcp.ferramenta('get_map_object', {'object_id': oid}, timeout=120)
            c = r.get('result', {}).get('content', [])
            ims = [x for x in c if x.get('type') == 'image']
            if ims:
                (DESTINO / f'{nome}.png').write_bytes(base64.b64decode(ims[0]['data']))
                print('colhido', nome)
                pendentes.pop(nome)
        if pendentes:
            print('faltam', len(pendentes)); time.sleep(25)
    return pendentes

if __name__ == '__main__':
    if 'colher' in sys.argv:
        f = colher(); print('nao colhidos:', list(f))
    else:
        disparar()
