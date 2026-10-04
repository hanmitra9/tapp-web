# Render blog cover scenes (tools/blog_art/scenes.html) to assets/blog/<id>.webp. Needs Playwright + Chromium.
import asyncio, io, pathlib, sys
from PIL import Image
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / 'tools' / 'blog_art' / 'scenes.html'
OUT = ROOT / 'assets' / 'blog'
EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

async def main():
    OUT.mkdir(exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=EXE if pathlib.Path(EXE).exists() else None, args=['--no-sandbox'])
        pg = await (await b.new_context(viewport={'width': 1600, 'height': 900})).new_page()
        await pg.goto(SRC.as_uri()); await pg.wait_for_timeout(1200)
        for el in await pg.query_selector_all('.stage'):
            sid = await el.get_attribute('id')
            if len(sys.argv) > 1 and sid not in sys.argv[1:]: continue
            png = await el.screenshot()
            Image.open(io.BytesIO(png)).convert('RGB').save(OUT / f'{sid}.webp', 'WEBP', quality=84, method=6)
            print(sid, (OUT / f'{sid}.webp').stat().st_size // 1024, 'KB')
        await b.close()
asyncio.run(main())
