"""두 기기 공유 시험: 서로 다른 브라우저 둘(컴퓨터·휴대폰)이 시험 서버를 거쳐 같은 마인드맵을 보는지.
쓰는 법: python tests/fake_server.py . 8766 을 띄운 뒤  python tests/sync_test.py <결과폴더>"""
import sys
from playwright.sync_api import sync_playwright

O = sys.argv[1]
URL = "http://127.0.0.1:8766/?fakesync=tester"
fails = []


def check(name, ok):
    print(("통과" if ok else "실패"), name)
    if not ok:
        fails.append(name)


def texts(pg):
    return pg.eval_on_selector_all("#gN text", "els=>els.map(e=>e.textContent)")


with sync_playwright() as p:
    b = p.chromium.launch()
    pc = b.new_context(viewport={"width": 1280, "height": 800}).new_page()
    ph = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True).new_page()
    errs = []
    for pg in (pc, ph):
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("dialog", lambda d: d.accept())
        pg.goto(URL); pg.wait_for_timeout(800)

    check("로그인 전 공유 단추 보임", pc.is_visible("#hSync") and "켜기" in pc.inner_text("#hSync"))
    # 휴대폰에 로그인 전에 만든 마인드맵 (로그인하면 올라가야 함)
    ph.click("#tplRow [data-tpl=checklist]"); ph.wait_for_timeout(600); ph.click("#bBack"); ph.wait_for_timeout(400)
    for pg in (pc, ph):
        pg.click("#hSync"); pg.wait_for_timeout(300)
    check("로그인 뒤 공유 중 표시", "공유 중" in pc.inner_text("#hSync"))
    pc.wait_for_timeout(2500)
    check("휴대폰에서 로그인 전에 만든 것이 컴퓨터에 뜸", "해야 할 일" in pc.inner_text("#mapList"))

    # 컴퓨터에서 새로 만들고 적기
    pc.click("#tplRow [data-tpl=blank]"); pc.wait_for_timeout(600)
    pc.click("#gN [data-act=node] >> nth=0"); pc.keyboard.press("Control+A"); pc.keyboard.type("공유 시험"); pc.keyboard.press("Enter")
    pc.keyboard.press("Tab"); pc.keyboard.type("컴퓨터에서 적음"); pc.keyboard.press("Enter")
    pc.wait_for_timeout(2500)
    check("컴퓨터에서 만든 마인드맵이 휴대폰 목록에 뜸", "공유 시험" in ph.inner_text("#mapList"))
    ph.locator("#mapList .card", has_text="공유 시험").first.click(); ph.wait_for_timeout(700)
    check("휴대폰에서 열면 컴퓨터에서 적은 가지가 있음", "컴퓨터에서 적음" in texts(ph))

    # 둘 다 연 채로 휴대폰에서 고치기 → 컴퓨터 화면이 바뀌는지
    ph.click("#tChild"); ph.keyboard.type("휴대폰에서 더함"); ph.keyboard.press("Enter")
    ph.wait_for_timeout(3000)
    check("휴대폰에서 더한 가지가 열린 컴퓨터 화면에 바로 뜸", "휴대폰에서 더함" in texts(pc))
    pc.screenshot(path=O + "/sync_pc.png"); ph.screenshot(path=O + "/sync_phone.png")

    # 컴퓨터에서 다시 고치기 → 휴대폰
    pc.evaluate("selId = cur.root.id; render()"); pc.click("#tChild"); pc.keyboard.type("다시 컴퓨터"); pc.keyboard.press("Enter")
    pc.wait_for_timeout(3000)
    check("컴퓨터에서 또 고친 것이 휴대폰에 뜸", "다시 컴퓨터" in texts(ph))

    # 지우기가 다른 기기에도
    ph.click("#bBack"); ph.wait_for_timeout(400)
    pc.click("#bBack"); pc.wait_for_timeout(400)
    card = pc.locator("#mapList .card", has_text="해야 할 일").first
    card.locator("[data-del]").click(); pc.wait_for_timeout(2500)
    check("컴퓨터에서 지운 것이 휴대폰에서도 사라짐", "해야 할 일" not in ph.inner_text("#mapList"))

    # 다시 열어도(새로고침) 남는지
    ph.reload(); ph.wait_for_timeout(2000)
    check("휴대폰 새로고침 뒤에도 공유된 것이 남음", "공유 시험" in ph.inner_text("#mapList") and "해야 할 일" not in ph.inner_text("#mapList"))
    check("브라우저 오류 0건", not errs)
    if errs: print(errs)
    b.close()
print("실패", len(fails), "건")
sys.exit(1 if fails else 0)
