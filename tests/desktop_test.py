import sys, time
from playwright.sync_api import sync_playwright
O = sys.argv[1]; URL = "http://127.0.0.1:8765/"
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width":1280,"height":800}, accept_downloads=True); pg = ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append("PAGE " + str(e))); pg.on("console", lambda m: m.type=="error" and errs.append("CON " + m.text))
    pg.goto(URL); pg.wait_for_timeout(1200); pg.screenshot(path=O+"/01_home.png")
    pg.click("#tplRow [data-tpl=blank]"); pg.wait_for_timeout(800); pg.screenshot(path=O+"/02_blank.png")
    # 가운데 주제 누르고 바로 적기
    pg.click("#gN [data-act=node] >> nth=0"); pg.wait_for_timeout(300)
    print("editing visible:", pg.is_visible("#edit"))
    pg.keyboard.press("Control+A"); pg.keyboard.type("우리 빵집 새 메뉴"); pg.keyboard.press("Enter"); pg.wait_for_timeout(300)
    pg.keyboard.press("Tab"); pg.keyboard.type("케이크"); pg.keyboard.press("Tab"); pg.keyboard.type("딸기 케이크"); pg.keyboard.press("Enter")
    pg.keyboard.press("Enter"); pg.keyboard.type("초코 케이크"); pg.keyboard.press("Enter"); pg.wait_for_timeout(400)
    texts = pg.eval_on_selector_all("#gN text", "els=>els.map(e=>e.textContent)")
    print("texts:", texts)
    pg.screenshot(path=O+"/03_typed.png")
    # 되돌리기
    pg.click("#tUndo"); pg.wait_for_timeout(200); print("after undo:", pg.eval_on_selector_all("#gN text", "els=>els.map(e=>e.textContent)"))
    pg.click("#tRedo"); pg.wait_for_timeout(200)
    # 형식마다 찍기
    for lay in ["right","org","tree","timeline","bubble","mind"]:
        pg.select_option("#selLayout", lay); pg.wait_for_timeout(700); pg.screenshot(path=O+f"/04_{lay}.png")
    for th in ["pastel","night"]:
        pg.select_option("#selTheme", th); pg.wait_for_timeout(300); pg.screenshot(path=O+f"/05_{th}.png")
    pg.select_option("#selTheme", "bright")
    # 끌어서 옮기기: '초코 케이크' -> '생각 1'
    def box(txt):
        el = pg.locator("#gN [data-act=node]", has_text=txt).first; return el.bounding_box()
    a = box("초코 케이크"); t = box("생각 1")
    pg.mouse.move(a["x"]+a["width"]/2, a["y"]+a["height"]/2); pg.mouse.down()
    pg.mouse.move(a["x"]+30, a["y"]+30, steps=5); pg.mouse.move(t["x"]+t["width"]/2, t["y"]+t["height"]/2, steps=10); pg.mouse.up(); pg.wait_for_timeout(400)
    parent = pg.evaluate("(()=>{const f=findNode(cur.root, [...document.querySelectorAll('#gN [data-act=node]')].find(g=>g.textContent.includes('초코')).dataset.id); return f.p.text})()")
    print("drag parent:", parent)
    pg.screenshot(path=O+"/06_dragged.png")
    # 꾸미기: 색, 아이콘, 메모
    kid = pg.evaluate("(()=>{let r; walk(cur.root,n=>{if(n.text==='케이크')r=n.id}); return r})()")
    pg.click(f"#gN [data-act=node][data-id='{kid}']"); pg.keyboard.press("Enter"); pg.wait_for_timeout(200)
    pg.click("#tPanel"); pg.wait_for_timeout(300)
    pg.click("#pIcons [data-icon='⭐']"); pg.click("#pColors [data-color='#e03131']"); pg.click("#pShapes [data-shape=pill]")
    pg.fill("#pNote", "생크림은 아침에 만들기"); pg.click("#svg", position={"x":20,"y":20}); pg.wait_for_timeout(400)
    pg.screenshot(path=O+"/07_styled.png")
    # 집중
    pg.evaluate(f"selId='{kid}'; render()")
    pg.click("#bFocus"); pg.wait_for_timeout(300); pg.screenshot(path=O+"/08_focus.png"); pg.click("#bFocus")
    # 목록 보기
    pg.click("#vList"); pg.wait_for_timeout(300); pg.screenshot(path=O+"/09_outline.png")
    inp = pg.locator("#outline input").nth(1); inp.click(); pg.keyboard.press("End"); pg.keyboard.press("Enter"); pg.keyboard.type("빵 종류"); pg.wait_for_timeout(200)
    pg.click("#vMap"); pg.wait_for_timeout(300)
    print("has 빵 종류:", "빵 종류" in pg.text_content("#gN"))
    # 발표
    pg.click("#bPresent"); pg.wait_for_timeout(700); pg.screenshot(path=O+"/10_present1.png")
    for _ in range(3): pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(250)
    pg.wait_for_timeout(600); pg.screenshot(path=O+"/11_present4.png"); print("present count:", pg.inner_text("#pCount"))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
    # 내보내기
    for ex in ["png","pdf","md","json"]:
        pg.click("#bExport")
        with pg.expect_download() as d: pg.click(f"[data-ex={ex}]")
        path = O+"/out_"+d.value.suggested_filename; d.value.save_as(path); print("export", ex, d.value.suggested_filename)
    # 다시 열어도 남는지
    pg.wait_for_timeout(500); pg.reload(); pg.wait_for_timeout(1000)
    print("home cards:", pg.locator("#mapList .card").count()); pg.screenshot(path=O+"/12_home_after.png")
    pg.click("#mapList .card >> nth=0"); pg.wait_for_timeout(700)
    print("persisted:", "딸기 케이크" in pg.text_content("#gN"), "⭐" in pg.text_content("#gN"))
    print("ERRORS:", errs)
    b.close()
