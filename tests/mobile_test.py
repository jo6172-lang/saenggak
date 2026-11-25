import sys
from playwright.sync_api import sync_playwright
O=sys.argv[1]
with sync_playwright() as p:
    b=p.chromium.launch()
    for W,H,tag in [(390,844,'m'),(768,1024,'t')]:
        ctx=b.new_context(viewport={"width":W,"height":H}, has_touch=True, is_mobile=(W<500), device_scale_factor=2); pg=ctx.new_page()
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://127.0.0.1:8765/"); pg.wait_for_timeout(900); pg.screenshot(path=f"{O}/{tag}_home.png")
        pg.tap("#tplRow [data-tpl=study]"); pg.wait_for_timeout(800); pg.screenshot(path=f"{O}/{tag}_editor.png")
        pg.tap("#gN [data-act=node] >> nth=0"); pg.wait_for_timeout(300)
        pg.keyboard.press("Control+A"); pg.keyboard.type("광합성"); pg.wait_for_timeout(200); pg.screenshot(path=f"{O}/{tag}_editing.png")
        pg.tap("#tChild"); pg.wait_for_timeout(200); pg.keyboard.type("빛 에너지"); pg.keyboard.press("Enter")
        pg.tap("#tPanel"); pg.wait_for_timeout(300); pg.screenshot(path=f"{O}/{tag}_panel.png")
        sw = pg.evaluate("[document.documentElement.scrollWidth, innerWidth]")
        print(tag, "overflow", sw, "errors", errs, "has text", "빛 에너지" in pg.text_content("#gN"))
        ctx.close()
    b.close()
