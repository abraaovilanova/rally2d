"""
Empacota os PNGs gerados de um Bioma numa folha e escreve os recortes no `cenario.json`.

Cada objeto nasce em arquivo próprio — é assim que o PixelLab devolve. O jogo, porém, quer
uma folha e recortes dentro dela: uma requisição por Bioma, e um `drawImage` por objeto.
Este script faz a ponte, e ao fazê-la mata a medição de recorte à mão: quem colou o objeto
na folha sabe exatamente onde ele ficou.

    python3 tools/montar-folha.py tools/manifesto-deserto.json gerados/deserto

Roda quantas vezes quiser. O que ainda não foi gerado é relatado e ignorado, não quebra:
com uma fila de quarenta e dois trabalhos, o script tem de servir no meio dela.
"""

import json
import sys
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
CENARIO = RAIZ / 'src' / 'cenario.json'

# Quanto de folga fica entre um recorte e o seguinte. Sem ela, o filtro de vizinho mais
# próximo pode puxar uma linha do vizinho para dentro do sprite ao desenhar.
FOLGA = 2

# As chaves que este script é dono e reescreve por inteiro. Todo o resto do Bioma passa.
PAPEIS_DE_OBJETO = {
    'folha', 'escala', 'chao', 'leito', 'largada', 'chegada',
    'beira', 'pesos', 'publico', 'rasteiros', 'plateia', 'recortes', 'leitos', 'efeitos', 'espelhar',
}


def cortar(img: Image.Image) -> Image.Image:
    """Ao que não é transparente. É o "ajustar ao conteúdo" do editor, feito na origem."""
    caixa = img.getbbox()
    return img.crop(caixa) if caixa else img


def quadros(pasta: Path, item: dict) -> list[tuple[str, Image.Image]]:
    """Os arquivos de um item: um só, ou um por quadro/direção, na ordem."""
    n = item.get('quadros') or item.get('direcoes')
    nomes = [item['nome']] if n is None else [f"{item['nome']}-{i}" for i in range(n)]

    achados = []
    for nome in nomes:
        caminho = pasta / f'{nome}.png'
        if caminho.exists():
            achados.append((nome, cortar(Image.open(caminho).convert('RGBA'))))
    return achados


def empacotar(pecas: list[tuple[str, Image.Image]], largura=1408):
    """
    Prateleiras: as peças mais altas primeiro, quebrando a linha quando não cabe. Simples
    de propósito — a folha é lida por recorte, não por posição, então nada aqui precisa
    ser ótimo. Precisa ser previsível.
    """
    pecas = sorted(pecas, key=lambda p: -p[1].height)
    recortes, linha, x, y, altura_linha = {}, [], FOLGA, FOLGA, 0

    for nome, img in pecas:
        if x + img.width + FOLGA > largura and linha:
            y += altura_linha + FOLGA
            x, altura_linha, linha = FOLGA, 0, []
        recortes[nome] = {'x': x, 'y': y, 'w': img.width, 'h': img.height, '_img': img}
        linha.append(nome)
        x += img.width + FOLGA
        altura_linha = max(altura_linha, img.height)

    altura = y + altura_linha + FOLGA
    folha = Image.new('RGBA', (largura, altura), (0, 0, 0, 0))
    for nome, r in recortes.items():
        folha.alpha_composite(r.pop('_img'), (r['x'], r['y']))
    return folha, recortes


def costura(img: Image.Image) -> tuple[float, float]:
    """
    Quanto a borda de um ladrilho destoa da borda oposta, contra a variação interna dele.

    Um ladrilho que fecha consigo mesmo tem costura da ordem do próprio grão. Quando a
    costura é muito maior, ela vira uma grade visível no chão — e foi assim que a areia
    soprada entrou no jogo com linhas retas atravessando a Pista.
    """
    import numpy as np

    a = np.asarray(img.convert('RGB'), dtype=float)
    horizontal = float(np.abs(a[:, -1] - a[:, 0]).mean())
    vertical = float(np.abs(a[-1, :] - a[0, :]).mean())
    interna = float(np.abs(a[:, 1:] - a[:, :-1]).mean()) + 1e-6
    return max(horizontal, vertical), interna


def main() -> int:
    manifesto = json.loads(Path(sys.argv[1]).read_text('utf8'))
    pasta = Path(sys.argv[2])
    bioma = manifesto['bioma']

    pecas, faltando, papeis, rasteiros = [], [], {}, []
    for item in manifesto['itens']:
        # O tileset Wang e a poeira não são objetos de cenário: têm desenho próprio no
        # jogo e folha própria. Entram no manifesto para a fila não os esquecer.
        if item['papel'] in ('tileset', 'carro'):
            continue

        achados = quadros(pasta, item)
        if not achados:
            faltando.append(item['nome'])
            continue

        if item['papel'] in ('leito', 'terreno'):
            pior, interna = costura(achados[0][1])
            # O piso absoluto evita alarme num ladrilho liso, onde qualquer costura é
            # muitas vezes um grão que é praticamente zero — e invisível de qualquer jeito.
            if pior > 3 and pior > interna * 2.5:
                print(f"  aviso: {item['nome']} tem costura {pior:.1f} contra grão {interna:.1f} "
                      f'— vai aparecer como linha reta no chão')

        pecas.extend(achados)
        # Quem tem mais de um quadro entra nas listas pelo **nome base**: é ele que o jogo
        # resolve para o quadro da vez. Registrar `torcedor1-0` congelaria o sujeito no
        # primeiro quadro, que é como o público deixou de acenar da primeira vez.
        registrado = item['nome'] if len(achados) > 1 else achados[0][0]
        papeis.setdefault(item['papel'], []).append((registrado, item.get('peso', 3)))
        if item.get('rasteiro'):
            rasteiros.append(item['nome'])

    if not pecas:
        print('nada gerado ainda em', pasta)
        return 1

    folha, recortes = empacotar(pecas)
    destino = RAIZ / manifesto['folha']
    destino.parent.mkdir(parents=True, exist_ok=True)
    folha.save(destino)

    cenario = json.loads(CENARIO.read_text('utf8'))
    nome_folha = destino.stem
    cenario['sheets'][nome_folha] = str(destino.relative_to(RAIZ))

    def um(papel, padrao):
        achado = papeis.get(papel)
        return achado[0][0] if achado else padrao

    antigo = cenario['biomas'].get(bioma, {})
    beira = papeis.get('beira', [])
    # O que não é papel de objeto — o tileset do Terreno, por exemplo — sobrevive: quem
    # escreveu aquilo foi outro script, e este aqui não sabe nada sobre ele.
    cenario['biomas'][bioma] = {
        **{k: v for k, v in antigo.items() if k not in PAPEIS_DE_OBJETO},
        'folha': nome_folha,
        'escala': manifesto['escala'],
        # Os ladrilhos gerados já fecham consigo mesmos: espelhar só produziria losango.
        'espelhar': False,
        # O leito e o terreno viram um recorte só cada; a variação entre eles é do jogo.
        'chao': um('terreno', antigo.get('chao', '')),
        'leito': um('leito', antigo.get('leito', '')),
        # Todas as variantes do leito: é o jogo que escolhe qual vai em cada trecho.
        'leitos': [n for n, _ in papeis.get('leito', [])],
        'largada': um('largada', antigo.get('largada', '')),
        'chegada': um('chegada', antigo.get('chegada', '')),
        'beira': [n for n, _ in beira],
        'pesos': [p for _, p in beira],
        'publico': [n for n, _ in papeis.get('publico', [])],
        # Quem fica deitado no chão não ganha sombra de contato: não há o que projetar.
        'rasteiros': rasteiros,
        'plateia': um('plateia', antigo.get('plateia', '')),
        # Efeitos entram na folha mas em lista nenhuma: quem os desenha é o jogo, na hora.
        'efeitos': [n for n, _ in papeis.get('efeito', [])],
        'recortes': recortes,
    }

    CENARIO.write_text(json.dumps(cenario, indent=2, ensure_ascii=False) + '\n', 'utf8')

    print(f'{destino.relative_to(RAIZ)}: {folha.width}×{folha.height}, {len(recortes)} recortes')
    if faltando:
        print(f'ainda por gerar ({len(faltando)}): ' + ', '.join(faltando))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
