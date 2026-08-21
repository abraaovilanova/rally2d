"""
Reduz os PNGs gerados à paleta-mestra.

A ficha do Estilo pede uma paleta única, mas nenhuma ferramenta do PixelLab aceita paleta
fixa no pedido — só referência de estilo por imagem. Então a paleta deixa de ser algo que
se pede e vira algo que se aplica: cada pixel vai para a cor mais próxima das 32.

É o que faz um cacto e um espectador parecerem do mesmo jogo, mesmo tendo saído de duas
gerações que não se conhecem.

    python3 tools/aplicar-paleta.py assets/gerados/deserto            # no lugar
    python3 tools/aplicar-paleta.py assets/gerados/deserto --para saida/

A distância é medida em Oklab, não em RGB: em RGB o "mais próximo" segue a aritmética dos
canais e não o olho, e um marrom escuro cai num azul escuro sem que a conta reclame.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
PALETA = RAIZ / 'tools' / 'paleta.json'

# Abaixo disto o pixel é borda macia demais para ter cor própria; vira transparente.
ALFA_MINIMO = 24


def carregar_paleta() -> np.ndarray:
    cores = [c for rampa in json.loads(PALETA.read_text('utf8')).values() for c in rampa]
    return np.array([[int(c[i:i + 2], 16) for i in (1, 3, 5)] for c in cores], dtype=float)


def para_oklab(rgb: np.ndarray) -> np.ndarray:
    """sRGB 0-255 → Oklab. Onde "parecido" quer dizer parecido para o olho."""
    c = rgb / 255.0
    linear = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    r, g, b = linear[..., 0], linear[..., 1], linear[..., 2]

    l = np.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    m = np.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    s = np.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

    return np.stack([
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    ], axis=-1)


def aplicar(caminho: Path, paleta: np.ndarray, paleta_lab: np.ndarray, destino: Path) -> tuple[int, int]:
    img = np.array(Image.open(caminho).convert('RGBA'))
    alfa = img[..., 3]
    visivel = alfa >= ALFA_MINIMO

    if visivel.any():
        lab = para_oklab(img[..., :3][visivel].astype(float))
        # Distância de cada pixel a cada cor da paleta; fica com a menor.
        d = ((lab[:, None, :] - paleta_lab[None, :, :]) ** 2).sum(2)
        img[..., :3][visivel] = paleta[d.argmin(1)]

    antes = len(np.unique(img[..., :3][visivel].reshape(-1, 3), axis=0)) if visivel.any() else 0
    img[..., 3] = np.where(visivel, 255, 0)

    destino.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(img, 'RGBA').save(destino)
    return antes, int(visivel.sum())


def main() -> int:
    pasta = Path(sys.argv[1])
    para = Path(sys.argv[sys.argv.index('--para') + 1]) if '--para' in sys.argv else pasta

    paleta = carregar_paleta()
    paleta_lab = para_oklab(paleta)

    total = 0
    for arquivo in sorted(pasta.glob('*.png')):
        antes = len(np.unique(np.array(Image.open(arquivo).convert('RGB')).reshape(-1, 3), axis=0))
        _, pixels = aplicar(arquivo, paleta, paleta_lab, para / arquivo.name)
        depois = len(np.unique(np.array(Image.open(para / arquivo.name).convert('RGB')).reshape(-1, 3), axis=0))
        print(f'{arquivo.name}: {antes} → {depois} cores, {pixels} pixels')
        total += 1

    print(f'{total} arquivos na paleta de {len(paleta)} cores')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
