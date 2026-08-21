"""
Tira o xadrez de fundo de uma folha gerada e devolve alfa de verdade.

O gerador de imagens *desenha* o xadrez em vez de deixar o fundo transparente, e ainda
entrega em JPEG, que borra as duas coisas uma na outra. Aqui o xadrez é reconhecido pela
cor — cinza-azulado de baixa saturação, que nenhuma das três animações usa — e o alfa sai
da distância a ele, o que dá borda macia em vez de recorte serrilhado.

Também saem as etiquetas numeradas e as linhas que separam os três biomas: são anotação
da folha, não arte.

    python3 tools/limpar-xadrez.py assets/dust/<folha>.jpeg assets/dust

Uso: um passo manual, rodado uma vez por folha nova. Nada disto entra no jogo.
"""
import sys
from PIL import Image
import numpy as np

SRC = sys.argv[1]
OUT = sys.argv[2].rstrip('/') + '/'

a = np.array(Image.open(SRC).convert('RGB')).astype(float)
h, w, _ = a.shape
R, G, B = a[..., 0], a[..., 1], a[..., 2]
lum = a.mean(2)
spread = a.max(2) - a.min(2)

# O xadrez é cinza-azulado e de baixa saturação; a arte é laranja, marrom ou azul claro.
bg_like = (B >= R - 6) & (spread <= 26) & (lum > 62) & (lum < 182)

light = a[bg_like & (lum >= 122)].mean(0)
dark = a[bg_like & (lum < 122)].mean(0)
print('claro', light.round(1), 'escuro', dark.round(1))

# Distância à cor de xadrez mais próxima: é ela que diz quanto de arte há no pixel.
d_light = np.linalg.norm(a - light, axis=2)
d_dark = np.linalg.norm(a - dark, axis=2)
near = np.where(d_light < d_dark, 0, 1)
dist = np.minimum(d_light, d_dark)
bg_color = np.where(near[..., None] == 0, light, dark)

T0, T1 = 44.0, 88.0
alpha = np.clip((dist - T0) / (T1 - T0), 0, 1)

# Sobra do JPEG: o borrão na quina de dois quadrados fica a meio caminho das duas cores
# do xadrez e escapa do corte. Se ainda parece xadrez, é xadrez.
alpha[(alpha < 0.4) & bg_like] = 0

# Desmistura a franja: o pixel de borda é arte por cima de xadrez, e o JPEG borrou os dois.
safe = np.maximum(alpha, 0.35)[..., None]
art = np.clip((a - (1 - safe) * bg_color) / safe, 0, 255)

# Na franja o alfa é pequeno e a desmistura amplia o ruído do JPEG em pontinhos escuros.
# A cor de lá vem então do miolo: média da vizinhança pesada pelo alfa, que é onde a cor
# é confiável. O alfa não se mexe — quem define a silhueta é ele, não a cor.
weight = (alpha ** 2)[..., None]
num = np.zeros_like(art)
den = np.zeros_like(weight)
for dy in range(-2, 3):
    for dx in range(-2, 3):
        num += np.roll(np.roll(art * weight, dy, 0), dx, 1)
        den += np.roll(np.roll(weight, dy, 0), dx, 1)
blended = num / np.maximum(den, 1e-6)
fringe = (alpha < 0.9)[..., None]
art = np.where(fringe, blended, art)


def components(mask):
    """Componentes conexos da máscara, por varredura em pilha. Só percorre o que é máscara."""
    seen = np.zeros(mask.shape, bool)
    out = []
    ys, xs = np.where(mask)
    for sy, sx in zip(ys, xs):
        if seen[sy, sx]:
            continue
        stack = [(sy, sx)]
        seen[sy, sx] = True
        pixels = []
        while stack:
            y, x = stack.pop()
            pixels.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        out.append(np.array(pixels))
    return out


# As etiquetas numeradas: um retângulo escuro de ~20px, cheio, com um dígito claro dentro.
# São anotação da folha, não arte — e é o dígito que as separa de um contorno escuro do barro.
dark_neutral = (lum < 78) & (spread <= 34)
bright = lum > 185

label = np.zeros((h, w), bool)
found = 0
for pixels in components(dark_neutral):
    y0, x0 = pixels.min(0)
    y1, x1 = pixels.max(0)
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    if not (12 <= bw <= 40 and 12 <= bh <= 26):
        continue
    if len(pixels) / (bw * bh) < 0.5:
        continue
    if bright[y0:y1 + 1, x0:x1 + 1].sum() < 6:
        continue
    label[max(0, y0 - 2):y1 + 3, max(0, x0 - 2):x1 + 3] = True
    found += 1
print('etiquetas encontradas', found, '- cobrem', round(label.mean() * 100, 2), '% da folha')

# As duas linhas que separam os três biomas: colunas inteiras de não-fundo.
column = (alpha > 0.5).sum(0)
separator = column > 600
separator = np.convolve(separator, np.ones(5), 'same') > 0
print('colunas de separação', np.where(separator)[0])

alpha[label] = 0
alpha[:, separator] = 0

# Cisco: o que sobra do JPEG são pontos de um ou dois pixels soltos. As partículas de
# verdade — a poeira que se desprende da nuvem — são maiores que isso e vêm em grupo.
speck = 0
for pixels in components(alpha > 0.35):
    if len(pixels) <= 3:
        alpha[pixels[:, 0], pixels[:, 1]] = 0
        speck += 1
print('ciscos removidos', speck)

out = np.dstack([art, alpha * 255]).astype('uint8')
Image.fromarray(out, 'RGBA').save(OUT + 'folha.png')

# Um recorte por bioma, cortado nas linhas de separação.
cuts = np.where(separator)[0]
edges = [0, cuts[len(cuts) // 2 - 3], cuts[-3], w]
for name, x0, x1 in [('deserto', edges[0], edges[1]), ('floresta', edges[1], edges[2]), ('gelo', edges[2], edges[3])]:
    Image.fromarray(out[:, x0:x1], 'RGBA').save(OUT + name + '.png')
    print(name, x0, x1)
