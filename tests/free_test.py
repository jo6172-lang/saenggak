"""자유 캔버스(나로 시작) 시험: 가운데 「나」, 가지 더하기, 끌어 아무 데나 놓기, 빈 곳 두 번 눌러 새 가지, 새로고침 뒤 자리 유지, 휴대폰 터치.
쓰는 법: 앱을 http://127.0.0.1:8765 에 띄운 뒤  python tests/free_test.py <결과폴더>"""
import sys
from playwright.sync_api import sync_playwright

O = sys.argv[1]
URL = "http://127.0.0.1:8765/"
fails = []


def check(name, ok):
    print(("통과" if ok else "실패"), name)
    if not ok:
        fails.append(name)


def box(pg, text):
    return pg.locator("#gN [data-act=node]", has_text=text).first.bounding_box()


def nodes(pg):
    return pg.evaluate("(()=>{const o={};walk(cur.root,n=>{o[n.text]=[n.fx,n.fy]});return o})()")


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_context(viewport={"width": 1280, "height": 800}).new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(800)
    check("시작 틀 첫 칸이 「나로 시작」", pg.locator("#tplRow [data-tpl]").first.get_attribute("data-tpl") == "me")
    pg.click("#tplRow [data-tpl=me]"); pg.wait_for_timeout(700)
    t = pg.eval_on_selector_all("#gN text", "els=>els.map(e=>e.textContent)")
    check("가운데에 「나」 하나만", t == ["나"])
    check("형식이 자유 캔버스", pg.input_value("#selLayout") == "free")

    # 키보드로 가지 셋
    pg.click("#gN [data-act=node] >> nth=0"); pg.keyboard.press("Escape")
    for w in ["꿈", "가족", "공부"]:
        pg.evaluate("selId = cur.root.id; render()")
        pg.click("#tChild"); pg.keyboard.type(w); pg.keyboard.press("Enter"); pg.wait_for_timeout(200)
    pos = nodes(pg)
    check("가지 셋이 서로 다른 자리에 놓임", len({tuple(pos[w]) for w in ["꿈", "가족", "공부"]}) == 3)
    pg.screenshot(path=O + "/free_1.png")

    # 「꿈」을 왼쪽 아래 빈 곳으로 끌기
    a = box(pg, "꿈"); before = pos["꿈"]
    pg.mouse.move(a["x"] + a["width"] / 2, a["y"] + a["height"] / 2); pg.mouse.down()
    pg.mouse.move(a["x"] + 20, a["y"] + 20, steps=4); pg.mouse.move(200, 650, steps=12); pg.mouse.up(); pg.wait_for_timeout(500)
    after = nodes(pg)["꿈"]
    check("끈 가지가 놓은 자리로 옮겨짐", after != before and abs(after[0] - before[0]) > 100)
    a2 = box(pg, "꿈")
    check("화면에서도 그 자리에 보임", abs(a2["x"] + a2["width"] / 2 - 200) < 40 and abs(a2["y"] + a2["height"] / 2 - 650) < 40)

    # 빈 곳 두 번 눌러 새 가지
    pg.mouse.click(1050, 330); pg.wait_for_timeout(100); pg.mouse.click(1050, 330); pg.wait_for_timeout(400)
    pg.keyboard.type("여행"); pg.keyboard.press("Enter"); pg.wait_for_timeout(300)
    a3 = box(pg, "여행")
    check("두 번 누른 자리에 새 가지 「여행」", a3 is not None and abs(a3["x"] + a3["width"] / 2 - 1050) < 40 and abs(a3["y"] + a3["height"] / 2 - 330) < 40)
    print("여행 붙은 곳:", pg.evaluate("(()=>{let p=null;walk(cur.root,(n,par)=>{if(n.text==='여행')p=par&&par.text});return p})()"), "자리:", nodes(pg).get("여행"), a3)
    check("새 가지는 가장 가까운 가지에 이어짐", pg.evaluate("""(()=>{let par=null,me=null;walk(cur.root,(n,p)=>{if(n.text==='여행'){me=n;par=p}});if(!me)return false;
      let best=null,bd=1e9;walk(cur.root,n=>{if(n===me||!n._vis)return;const d=Math.hypot(n.fx-me.fx,n.fy-me.fy);if(d<bd){bd=d;best=n}});return best===par})()"""))

    # 「공부」를 「꿈」 위에 놓으면 「꿈」 아래로
    a = box(pg, "공부"); t2 = box(pg, "꿈")
    pg.mouse.move(a["x"] + a["width"] / 2, a["y"] + a["height"] / 2); pg.mouse.down()
    pg.mouse.move(a["x"] + 30, a["y"] + 30, steps=4); pg.mouse.move(t2["x"] + t2["width"] / 2, t2["y"] + t2["height"] / 2, steps=12); pg.mouse.up(); pg.wait_for_timeout(500)
    check("가지 위에 놓으면 그 아래로 들어감", pg.evaluate("findNode(cur.root, cur.root.children.find(c=>c.text==='꿈').id).n.children.some(c=>c.text==='공부')"))

    # 되돌리기
    pg.click("#tUndo"); pg.wait_for_timeout(300)
    check("되돌리기로 원래대로", pg.evaluate("cur.root.children.some(c=>c.text==='공부')"))
    pg.screenshot(path=O + "/free_2.png")

    # 새로고침 뒤 자리 유지
    pos1 = nodes(pg); pg.wait_for_timeout(1500)
    pg.reload(); pg.wait_for_timeout(800)
    pg.locator("#mapList .card").first.click(); pg.wait_for_timeout(700)
    check("새로고침 뒤에도 자리 그대로", nodes(pg) == pos1)

    # 다른 형식으로 바꿨다 돌아와도 자리 유지
    pg.select_option("#selLayout", "mind"); pg.wait_for_timeout(300); pg.select_option("#selLayout", "free"); pg.wait_for_timeout(300)
    check("형식을 바꿨다 돌아와도 자리 그대로", nodes(pg) == pos1)

    # 휴대폰 터치로 끌기
    ph = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True).new_page()
    ph.on("pageerror", lambda e: errs.append(str(e)))
    ph.goto(URL); ph.wait_for_timeout(800)
    ph.tap("#tplRow [data-tpl=me]"); ph.wait_for_timeout(700)
    ph.evaluate("selId = cur.root.id; render()"); ph.tap("#tChild"); ph.keyboard.type("휴대폰 생각"); ph.keyboard.press("Enter"); ph.wait_for_timeout(300)
    a = box(ph, "휴대폰 생각"); before = nodes(ph)["휴대폰 생각"]
    cdp = ph.context.new_cdp_session(ph)
    x0, y0 = a["x"] + a["width"] / 2, a["y"] + a["height"] / 2
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x0, "y": y0}]})
    for i in range(1, 13):
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x0 - i * 10, "y": y0 + i * 20}]})
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); ph.wait_for_timeout(500)
    check("휴대폰에서 손가락으로 끌어 옮김", nodes(ph)["휴대폰 생각"] != before)
    ph.screenshot(path=O + "/free_phone.png")
    w = ph.evaluate("document.documentElement.scrollWidth")
    check("휴대폰 가로 넘침 없음", w <= 390)
    check("브라우저 오류 0건", not errs)
    if errs: print(errs)
    b.close()
print("실패", len(fails), "건")
sys.exit(1 if fails else 0)
