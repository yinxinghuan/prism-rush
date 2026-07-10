#!/usr/bin/env python3
"""Generate the Prism Rush poster via the platform gen-image endpoint.

The model generates wordless full-bleed key art only. The title is composited
locally so the poster keeps sharp square edges and avoids AI-baked UI artifacts.
"""
import json
import os
import ssl
import subprocess
import time
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

API_URL = "https://chat.aiwaves.tech/aigram/api/gen-image"
HEADERS = {
    "Content-Type": "application/json",
    "Origin": "https://aigram.app",
    "Referer": "https://aigram.app/",
    "User-Agent": "Mozilla/5.0",
}

HERE = Path(__file__).parent
RAW = HERE / "_poster_raw.png"
OUT_GAME = HERE / "public" / "poster.png"
OUT_LIST = Path("/Users/yin/code/games/games/posters/prism-rush.png")
SIZE = 1024
_SSL = ssl.create_default_context()
_SSL.check_hostname = False
_SSL.verify_mode = ssl.CERT_NONE

PROMPT = (
    "Square 1:1 full-bleed cinematic voxel diorama poster, sharp square image corners. A neon "
    "midnight city block seen from a dramatic isometric three-quarter camera: wet asphalt with "
    "reflections, glowing cyan and magenta storefronts, a dark building facade with clean negative "
    "space in the upper left for a later title overlay, and a heroic blocky runner sprinting through the street. "
    "Around the runner are floating prism shards, bright crystal gates, refractive low-poly "
    "obstacles, and two angular shadow-crystal monsters lunging from the sides. Strong action "
    "composition, warm muzzle-flash-like light versus cold moonlight, neon haze, toy-like voxel "
    "materials, premium animated-film key art, fun, dangerous, colorful, high contrast, complete "
    "world scene. Do not write any text. No letters, no words, no numbers, no readable signs, no "
    "phone, no screen, no device frame, no app icon, no UI, no buttons, no badges, no coins, no "
    "currency, no chat bubbles, no interface panels, no border, no frame, no decorative corners, "
    "no rounded rectangle."
)

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Impact.ttf",
    "/System/Library/Fonts/Supplemental/Avenir Next Condensed.ttc",
    "/System/Library/Fonts/Supplemental/Futura.ttc",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]


def call_gen_image(prompt, timeout=360, retries=3):
    data = json.dumps({"prompt": prompt}).encode()
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(API_URL, data=data, method="POST", headers=HEADERS)
            with urllib.request.urlopen(req, timeout=timeout, context=_SSL) as response:
                body = json.loads(response.read())
            url = body.get("url")
            if not url:
                raise RuntimeError(f"gen-image response has no url: {body}")
            return url
        except Exception as exc:
            last = exc
            print(f"retry {attempt + 1}/{retries}: {exc}", flush=True)
            time.sleep(8 * (attempt + 1))
    raise last


def download_image(url, out):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=90, context=_SSL) as response:
        data = response.read()
    ext = os.path.splitext(url.split("?")[0])[1].lower() or ".png"
    tmp = out.with_suffix(".download" + ext)
    tmp.write_bytes(data)
    subprocess.run(["sips", "-s", "format", "png", str(tmp), "--out", str(out)], check=True, capture_output=True)
    tmp.unlink()


def fit_square(img):
    img = img.convert("RGB")
    w, h = img.size
    side = min(w, h)
    shift_x = int(os.environ.get("PRISM_POSTER_SHIFT_X", "-40"))
    shift_y = int(os.environ.get("PRISM_POSTER_SHIFT_Y", "-150"))
    left = max(0, min(w - side, (w - side) // 2))
    top = max(0, min(h - side, (h - side) // 2))
    img = img.crop((left, top, left + side, top + side))
    inset = int(os.environ.get("PRISM_POSTER_INSET", "150"))
    if inset > 0:
        crop_side = side - inset * 2
        crop_left = max(0, min(side - crop_side, inset + shift_x))
        crop_top = max(0, min(side - crop_side, inset + shift_y))
        img = img.crop((crop_left, crop_top, crop_left + crop_side, crop_top + crop_side))
    return img.resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def find_font(size):
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def fit_font(draw, text, max_width, start_size):
    size = start_size
    while size > 60:
        font = find_font(size)
        bbox = draw.textbbox((0, 0), text, font=font)
        if bbox[2] - bbox[0] <= max_width:
            return font
        size -= 4
    return find_font(size)


def gradient_text(size, text, font, top, bottom, shadow):
    scratch = Image.new("L", size, 0)
    scratch_draw = ImageDraw.Draw(scratch)
    bbox = scratch_draw.textbbox((0, 0), text, font=font)
    x = (size[0] - (bbox[2] - bbox[0])) // 2 - bbox[0]
    y = (size[1] - (bbox[3] - bbox[1])) // 2 - bbox[1]
    scratch_draw.text((x, y), text, font=font, fill=255)

    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    glow_alpha = scratch.filter(ImageFilter.GaussianBlur(12))
    glow.putalpha(glow_alpha)
    glow_px = glow.load()
    for py in range(size[1]):
        for px in range(size[0]):
            alpha = glow_px[px, py][3]
            if alpha:
                glow_px[px, py] = (*shadow, min(210, alpha))

    fill = Image.new("RGBA", size, (0, 0, 0, 0))
    fill_px = fill.load()
    for py in range(size[1]):
        u = py / max(1, size[1] - 1)
        color = tuple(int(top[i] * (1 - u) + bottom[i] * u) for i in range(3))
        for px in range(size[0]):
            alpha = scratch.getpixel((px, py))
            if alpha:
                fill_px[px, py] = (*color, alpha)

    edge = Image.new("RGBA", size, (0, 0, 0, 0))
    edge_alpha = scratch.filter(ImageFilter.MaxFilter(9))
    edge_alpha = Image.eval(edge_alpha, lambda a: 255 if a and a < 255 else 0)
    edge.putalpha(edge_alpha.filter(ImageFilter.GaussianBlur(1)))
    edge_px = edge.load()
    for py in range(size[1]):
        for px in range(size[0]):
            alpha = edge_px[px, py][3]
            if alpha:
                edge_px[px, py] = (255, 255, 255, min(255, alpha))

    out = Image.alpha_composite(glow, edge)
    return Image.alpha_composite(out, fill)


def add_title(img):
    img = img.convert("RGBA")

    scrim = Image.new("RGBA", img.size, (0, 0, 0, 0))
    px = scrim.load()
    for y in range(0, 330):
        alpha = int((1 - y / 330) ** 1.35 * 120)
        for x in range(SIZE):
            left_boost = max(0, 1 - x / 600)
            px[x, y] = (2, 7, 19, min(210, alpha + int(88 * left_boost)))
    img = Image.alpha_composite(img, scrim)

    draw = ImageDraw.Draw(Image.new("RGBA", img.size))
    prism_font = fit_font(draw, "PRISM", 430, 144)
    rush_font = fit_font(draw, "RUSH", 390, 144)
    title = Image.new("RGBA", img.size, (0, 0, 0, 0))
    td = ImageDraw.Draw(title)

    x = 62
    y = 54
    line_gap = 108
    for text, font, yy in [("PRISM", prism_font, y), ("RUSH", rush_font, y + line_gap)]:
        bbox = td.textbbox((0, 0), text, font=font)
        tx = x - bbox[0]
        ty = yy - bbox[1]
        for dx, dy, fill in [
            (10, 10, (8, 8, 14, 220)),
            (-4, 4, (0, 232, 255, 210)),
            (5, -3, (255, 35, 182, 205)),
        ]:
            td.text((tx + dx, ty + dy), text, font=font, fill=fill)
        td.text((tx, ty), text, font=font, fill=(255, 228, 44, 255))

    td.rectangle((62, 304, 478, 313), fill=(0, 236, 255, 225))
    td.rectangle((62, 324, 388, 331), fill=(255, 46, 186, 205))
    return Image.alpha_composite(img, title).convert("RGB")


def compose():
    poster = add_title(fit_square(Image.open(RAW)))
    OUT_GAME.parent.mkdir(parents=True, exist_ok=True)
    OUT_LIST.parent.mkdir(parents=True, exist_ok=True)
    poster.save(OUT_GAME, "PNG", optimize=True)
    poster.save(OUT_LIST, "PNG", optimize=True)
    print(f"wrote {OUT_GAME}")
    print(f"wrote {OUT_LIST}")


def main():
    if os.environ.get("PRISM_POSTER_USE_RAW") == "1" and RAW.exists():
        print(f"using existing raw {RAW}", flush=True)
    else:
        print("generating Prism Rush key art...", flush=True)
        url = call_gen_image(PROMPT)
        print(url, flush=True)
        download_image(url, RAW)
    compose()


if __name__ == "__main__":
    main()
