# Íconos de Finanzas Pro: moneda dorada (anillo grueso + anillo interior fino) con una "F" de puntas redondeadas, sobre negro.
# Genera los PNG de app.json y las vistas previas en design/icono/. No toca assets/images/ (se copian a mano tras aprobarlos).
# Uso (PowerShell, en la carpeta del proyecto):  python scripts/generate-icons.py
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / 'design' / 'icono'
BG = (13, 13, 15)  # #0D0D0F (background oscuro de src/constants/colors.ts)
GOLD = (212, 175, 97)  # #D4AF61 (primary oscuro)
SS = 4  # supersampling: se dibuja 4 veces más grande y se reduce para bordes suaves

# Ícono adaptativo de Android: lienzo de 108 dp; la zona segura es el círculo central de 66 dp.
SAFE = 66 / 108
# La moneda ocupa el 90 % de la zona segura (con su borde incluido): margen para cualquier recorte.
COIN_ADAPTIVE = SAFE * 0.90


def coin_mask(size: int, diameter: float) -> Image.Image:
    """Silueta de la moneda (anillos + F) centrada; `diameter` = fracción del lado."""
    n = size * SS
    m = Image.new('L', (n, n), 0)
    d = ImageDraw.Draw(m)
    c = n / 2
    r = n * diameter / 2

    def ring(radius: float, width: float) -> None:
        d.ellipse([c - radius, c - radius, c + radius, c + radius], outline=255, width=round(width))

    ring(r, r * 0.11)  # anillo exterior grueso
    ring(r * 0.80, r * 0.035)  # anillo interior fino

    # "F": trazos gruesos con puntas y esquina redondeadas (línea + círculo en cada extremo).
    t = r * 0.15
    stem_x = c - r * 0.25
    top_y, bottom_y, mid_y = c - r * 0.40, c + r * 0.42, c + r * 0.01
    strokes = [
        ((stem_x, top_y), (stem_x, bottom_y)),
        ((stem_x, top_y), (c + r * 0.27, top_y)),
        ((stem_x, mid_y), (c + r * 0.15, mid_y)),
    ]
    for a, b in strokes:
        d.line([a, b], fill=255, width=round(t))
        for x, y in (a, b):
            d.ellipse([x - t / 2, y - t / 2, x + t / 2, y + t / 2], fill=255)
    return m.resize((size, size), Image.LANCZOS)


def coin(size: int, diameter: float, color=GOLD) -> Image.Image:
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(Image.new('RGBA', (size, size), color + (255,)), (0, 0), coin_mask(size, diameter))
    return out


def on_black(size: int, diameter: float) -> Image.Image:
    img = Image.new('RGBA', (size, size), BG + (255,))
    img.alpha_composite(coin(size, diameter))
    return img


def crop(img: Image.Image, shape: str) -> Image.Image:
    """Recorte de un lanzador: círculo, 'squircle' aproximado o cuadrado redondeado."""
    s = img.size[0]
    m = Image.new('L', (s * SS, s * SS), 0)
    d = ImageDraw.Draw(m)
    box = [0, 0, s * SS - 1, s * SS - 1]
    if shape == 'circle':
        d.ellipse(box, fill=255)
    else:
        d.rounded_rectangle(box, radius=s * SS * (0.38 if shape == 'squircle' else 0.18), fill=255)
    out = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    out.paste(img, (0, 0), m.resize((s, s), Image.LANCZOS))
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    # Archivos con los mismos nombres que usa app.json (assets/images/).
    on_black(1024, 0.80).convert('RGB').save(OUT / 'icon.png')
    coin(512, COIN_ADAPTIVE).save(OUT / 'android-icon-foreground.png')
    Image.new('RGB', (512, 512), BG).save(OUT / 'android-icon-background.png')
    coin(512, COIN_ADAPTIVE, (255, 255, 255)).save(OUT / 'android-icon-monochrome.png')
    # Splash: la moneda sola; app.json la muestra a 76 dp de ancho (más pequeña que en el ícono).
    coin(512, 0.96).save(OUT / 'splash-icon.png')
    on_black(48, 0.86).save(OUT / 'favicon.png')

    # Vista previa: ícono, recortes del lanzador, zona segura, monocromático y splash.
    adaptive = Image.new('RGBA', (512, 512), BG + (255,))
    adaptive.alpha_composite(Image.open(OUT / 'android-icon-foreground.png'))
    guide = adaptive.copy()
    g = ImageDraw.Draw(guide)
    rs = 512 * SAFE / 2
    g.ellipse([256 - rs, 256 - rs, 256 + rs, 256 + rs], outline=(255, 80, 80, 255), width=3)
    mono = Image.new('RGBA', (512, 512), (90, 90, 96, 255))
    mono.alpha_composite(Image.open(OUT / 'android-icon-monochrome.png'))
    splash = Image.new('RGBA', (512, 512), BG + (255,))
    splash.alpha_composite(Image.open(OUT / 'splash-icon.png').resize((120, 120), Image.LANCZOS), (196, 196))

    tiles = [
        ('Ícono (icon.png)', Image.open(OUT / 'icon.png').convert('RGBA').resize((512, 512), Image.LANCZOS)),
        ('Adaptativo: círculo', crop(adaptive, 'circle')),
        ('Adaptativo: squircle', crop(adaptive, 'squircle')),
        ('Adaptativo: redondeado', crop(adaptive, 'rounded')),
        ('Zona segura 66/108 dp (rojo)', guide),
        ('Monocromático', crop(mono, 'circle')),
        ('Splash (moneda a escala)', splash),
    ]
    cell, pad, label_h = 300, 24, 36
    sheet = Image.new('RGBA', (4 * (cell + pad) + pad, 2 * (cell + label_h + pad) + pad), (238, 238, 240, 255))
    d = ImageDraw.Draw(sheet)
    # Inter (ya instalada para la app) tiene tildes; la fuente por defecto de Pillow no.
    inter = OUT.parent.parent / 'node_modules' / '@expo-google-fonts' / 'inter' / '500Medium' / 'Inter_500Medium.ttf'
    font = ImageFont.truetype(str(inter), 18) if inter.exists() else ImageFont.load_default(size=18)
    for i, (label, tile) in enumerate(tiles):
        x = pad + (i % 4) * (cell + pad)
        y = pad + (i // 4) * (cell + label_h + pad)
        sheet.alpha_composite(tile.resize((cell, cell), Image.LANCZOS), (x, y))
        d.text((x, y + cell + 8), label, fill=(30, 30, 30, 255), font=font)
    sheet.save(OUT / 'vista-previa.png')
    # Tamaño real en el cajón de apps (~48 dp): para juzgar la legibilidad de la F.
    small = Image.new('RGBA', (3 * 64 + 4 * 16, 96), (238, 238, 240, 255))
    for i, (_, tile) in enumerate(tiles[1:4]):
        small.alpha_composite(tile.resize((64, 64), Image.LANCZOS), (16 + i * 80, 16))
    small.save(OUT / 'vista-previa-pequena.png')
    print('Generado en', OUT)


if __name__ == '__main__':
    main()
