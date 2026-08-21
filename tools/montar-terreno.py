"""
Empacota os tilesets Wang de um Bioma numa folha só, na ordem que o jogo indexa.

Cada tileset tem dezesseis peças numeradas pela máscara dos cantos. A folha guarda um
par por linha de quatro, o que dá quatro linhas por tileset — e o jogo acha a peça por
conta, sem precisar de recorte nomeado.

    python3 tools/montar-terreno.py deserto pasta-com-os-pngs/wang-a pasta/wang-b
"""

import json
import re
import sys
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
CENARIO = RAIZ / 'src' / 'cenario.json'


def pecas(pasta: Path) -> list[Image.Image]:
    arqs = sorted(pasta.glob('*.png'), key=lambda p: int(re.search(r'_(\d+)\.png$', p.name).group(1)))
    if len(arqs) != 16:
        raise SystemExit(f'{pasta}: esperava 16 peças, achei {len(arqs)}')
    return [Image.open(a).convert('RGBA') for a in arqs]


def main() -> int:
    bioma = sys.argv[1]
    pares = [pecas(Path(p)) for p in sys.argv[2:]]

    lado = pares[0][0].width
    folha = Image.new('RGBA', (lado * 4, lado * 4 * len(pares)), (0, 0, 0, 0))

    for p, peças in enumerate(pares):
        for i, im in enumerate(peças):
            folha.alpha_composite(im, ((i % 4) * lado, (p * 4 + i // 4) * lado))

    destino = RAIZ / 'assets' / 'world' / f'{bioma}-terreno.png'
    folha.save(destino)

    cenario = json.loads(CENARIO.read_text('utf8'))
    nome = destino.stem
    cenario['sheets'][nome] = str(destino.relative_to(RAIZ))
    cenario['biomas'][bioma]['terreno'] = {'folha': nome, 'tile': lado, 'pares': len(pares)}
    CENARIO.write_text(json.dumps(cenario, indent=2, ensure_ascii=False) + '\n', 'utf8')

    print(f'{destino.relative_to(RAIZ)}: {folha.width}×{folha.height}, {len(pares)} pares de 16')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
