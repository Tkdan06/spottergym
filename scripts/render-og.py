#!/usr/bin/env python3
"""Build Open Graph share image with SPOT (white) + TER (lime) wordmark."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont

ROOT = Path(__file__).resolve().parents[1]
WORDMARK = ROOT / 'scripts' / 'assets' / 'spotter-wordmark.png'

W, H = 1200, 630
ACCENT = (200, 245, 66)
WHITE = (255, 255, 255)
TAGLINE = 'Социальная сеть для тех, кто в зале'

FONT_CANDIDATES = [
    '/System/Library/Fonts/Supplemental/Arial Black.ttf',
    '/Library/Fonts/Arial Black.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
]


TAGLINE_FONT_CANDIDATES = [
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/Library/Fonts/Arial.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
]


def find_font(
    size: int, candidates: list[str] | None = None
) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in candidates or FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def render_tracked(text: str, fill: tuple[int, ...], size: int = 150, tracking: int = -4) -> Image.Image:
    font = find_font(size)
    glyphs: list[Image.Image] = []
    probe = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
    for ch in text:
        bbox = probe.textbbox((0, 0), ch, font=font)
        gw = max(bbox[2] - bbox[0], 1)
        gh = max(bbox[3] - bbox[1], 1)
        g = Image.new('RGBA', (gw + 4, gh + 4), (0, 0, 0, 0))
        ImageDraw.Draw(g).text((-bbox[0] + 2, -bbox[1] + 2), ch, font=font, fill=fill)
        glyphs.append(g)
    total_w = sum(g.size[0] for g in glyphs) + tracking * (len(glyphs) - 1)
    max_h = max(g.size[1] for g in glyphs)
    out = Image.new('RGBA', (max(total_w, 1), max_h), (0, 0, 0, 0))
    x = 0
    for g in glyphs:
        out.alpha_composite(g, (x, (max_h - g.size[1]) // 2))
        x += g.size[0] + tracking
    return out


def build_wordmark() -> Image.Image:
    """SPOT white, TER lime — no overlap (overlap made the first T look half-green)."""
    spot = render_tracked('SPOT', (*WHITE, 255))
    ter = render_tracked('TER', (*ACCENT, 255))
    gap = 2
    pad_left = 28
    dot_r = 8
    h = max(spot.size[1], ter.size[1])
    w = pad_left + spot.size[0] + gap + ter.size[0]
    word = Image.new('RGBA', (w, h + 28), (0, 0, 0, 0))
    draw = ImageDraw.Draw(word)
    cy = int(h * 0.72)
    draw.ellipse([4, cy - dot_r, 4 + 2 * dot_r, cy + dot_r], fill=(*ACCENT, 255))
    word.alpha_composite(spot, (pad_left, (h - spot.size[1]) // 2))
    word.alpha_composite(ter, (pad_left + spot.size[0] + gap, (h - ter.size[1]) // 2))
    uy = h + 12
    draw.line([(pad_left, uy), (w - 4, uy)], fill=(*ACCENT, 255), width=4)
    draw.ellipse([pad_left - 4, uy - 4, pad_left + 4, uy + 4], fill=(*ACCENT, 255))
    draw.ellipse([w - 8, uy - 4, w, uy + 4], fill=(*ACCENT, 255))
    return word


def cover_crop(img: Image.Image, width: int, height: int) -> Image.Image:
    bw, bh = img.size
    scale = max(width / bw, height / bh)
    nw, nh = int(bw * scale), int(bh * scale)
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - width) // 2
    top = (nh - height) // 2
    return resized.crop((left, top, left + width, top + height))


def main() -> None:
    wordmark = build_wordmark()
    WORDMARK.parent.mkdir(parents=True, exist_ok=True)
    wordmark.save(WORDMARK)

    bg = cover_crop(Image.open(ROOT / 'public/images/welcome-gym.jpg').convert('RGB'), W, H)
    bg = ImageEnhance.Brightness(bg).enhance(0.42)
    bg = ImageEnhance.Contrast(bg).enhance(1.1)
    bg = Image.blend(bg, Image.new('RGB', (W, H), (8, 12, 10)), 0.35)

    logo = wordmark
    target_w = 720
    scale = target_w / logo.size[0]
    logo = logo.resize((target_w, int(logo.size[1] * scale)), Image.Resampling.LANCZOS)

    canvas = bg.convert('RGBA')
    lx = (W - logo.size[0]) // 2
    ly = 168
    canvas.alpha_composite(logo, (lx, ly))

    draw = ImageDraw.Draw(canvas)
    text_y = ly + logo.size[1] + 18
    font = find_font(34, TAGLINE_FONT_CANDIDATES)
    bbox = draw.textbbox((0, 0), TAGLINE, font=font)
    tw = bbox[2] - bbox[0]
    tx = (W - tw) // 2
    draw.text((tx + 1, text_y + 1), TAGLINE, font=font, fill=(0, 0, 0, 160))
    draw.text((tx, text_y), TAGLINE, font=font, fill=(242, 245, 243, 255))

    final = canvas.convert('RGB')
    share = ROOT / 'public' / 'og-share.png'
    legacy = ROOT / 'public' / 'og-image.png'
    final.save(share, 'PNG', optimize=True)
    final.save(legacy, 'PNG', optimize=True)
    print(f'wrote {share.name} and {legacy.name} ({final.size[0]}x{final.size[1]})')


if __name__ == '__main__':
    main()
