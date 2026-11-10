"""End-to-end UI check against the Docker stack (web :5173, api :8080).

Run:  HOLD_DURATION_SECONDS=15 docker compose up -d --build
      python -X utf8 e2e/ui_e2e.py            (needs: pip install playwright && playwright install chromium)
Screenshots go to e2e/screenshots/ unless a folder is passed as the first argument.
"""
import os, random, sys
from playwright.sync_api import sync_playwright, expect

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")
URL = "http://localhost:5173"
CLASS_NO, SHIFT = "5", "Day"
NAME = f"Class {CLASS_NO} - {SHIFT} Shift"
SID = "2026" + "".join(random.choice("0123456789") for _ in range(13))
results, console_errors = [], []

def check(label, fn):
    try:
        fn(); results.append(("PASS", label))
    except Exception as e:  # keep going so one failure doesn't hide the rest
        results.append(("FAIL", f"{label}: {str(e).splitlines()[0][:160]}"))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.on("console", lambda m: m.type == "error" and console_errors.append(m.text))
    page.goto(URL); page.wait_for_load_state("networkidle")

    check("opens on Parent view, Bangla", lambda: (
        expect(page.get_by_role("button", name="অভিভাবক")).to_have_attribute("aria-pressed", "true"),
        expect(page.get_by_role("heading", name="স্কুল ভর্তি")).to_be_visible(),
        expect(page.get_by_text("শ্রেণি তৈরি")).to_have_count(0)))

    # Admin creates a 2-seat class through the form
    page.get_by_role("button", name="অ্যাডমিন").click()
    page.get_by_label("শ্রেণি", exact=True).select_option(CLASS_NO)
    page.get_by_label("শিফট").select_option(SHIFT)
    page.get_by_label("মোট আসন").fill("2")
    page.get_by_role("button", name="শ্রেণি তৈরি করুন").click()
    check("admin creates class, toast shown", lambda: (
        expect(page.get_by_text("শ্রেণি তৈরি হয়েছে।")).to_be_visible(),
        expect(page.get_by_text(NAME).first).to_be_visible()))
    page.screenshot(path=f"{OUT}/1-admin.png", full_page=True)

    # Parent: ID field is always editable; errors inline
    page.get_by_role("button", name="অভিভাবক").click()
    row = page.locator("li", has=page.locator("details")).filter(has_text=NAME).last
    idbox = page.get_by_label("শিক্ষার্থীর 17 অঙ্কের জন্ম নিবন্ধন নম্বর")
    check("apply disabled without ID", lambda: expect(row.get_by_role("button", name="আবেদন করুন")).to_be_disabled())
    idbox.fill("12345abc")
    check("letters show inline error at once", lambda: expect(page.get_by_text("শুধু 17টি অঙ্ক দিন")).to_be_visible())
    idbox.fill(SID)
    check("valid ID clears error and enables apply", lambda: (
        expect(page.get_by_text("শুধু 17টি অঙ্ক দিন")).to_have_count(0),
        expect(row.get_by_role("button", name="আবেদন করুন")).to_be_enabled()))

    row.get_by_role("button", name="আবেদন করুন").click()
    slip = page.locator("article")
    check("hold creates slip with countdown", lambda: (
        expect(slip).to_be_visible(), expect(page.get_by_test_id("countdown")).to_contain_text("00:1")))
    check("row shows timer and held count", lambda: expect(row).to_contain_text("সময় বাকি"))
    page.screenshot(path=f"{OUT}/2-slip.png", full_page=True)

    page.reload(); page.wait_for_load_state("networkidle")
    check("reload keeps ID and slip, stays on Parent", lambda: (
        expect(idbox).to_have_value(SID), expect(page.locator("article")).to_be_visible(),
        expect(page.get_by_role("button", name="অভিভাবক")).to_have_attribute("aria-pressed", "true")))

    # Expiry without reload
    page.wait_for_timeout(16000)
    check("at 0 the hold shows expired and seat frees, no reload", lambda: (
        expect(page.get_by_text("মেয়াদ উত্তীর্ণ").first).to_be_visible(),
        expect(row.get_by_role("button", name="আবেদন করুন")).to_be_enabled(timeout=5000)))
    page.screenshot(path=f"{OUT}/3-expired.png", full_page=True)

    # Apply again and pay
    row.get_by_role("button", name="আবেদন করুন").click()
    page.locator("article").get_by_role("button", name="ভর্তি ফি দিন").click()
    check("pay confirms the seat", lambda: (
        expect(page.get_by_text("ভর্তি নিশ্চিত হয়েছে।")).to_be_visible(),
        expect(row).to_contain_text("নিশ্চিত")))

    # Second parent fills the last seat, a third gets 'full'
    idbox.fill("2026" + "9" * 13)
    row.get_by_role("button", name="আবেদন করুন").click()
    check("second parent takes last seat, class shows full", lambda: expect(row).to_contain_text("সময় বাকি"))
    idbox.fill("2026" + "8" * 13)
    check("third parent sees 'আসন নেই'", lambda: expect(row).to_contain_text("আসন নেই"))

    page.get_by_role("button", name="Switch to English").click()
    check("English switch", lambda: expect(page.get_by_role("heading", name="Classes")).to_be_visible())
    page.get_by_role("button", name="বাংলায় দেখুন").click()

    page.set_viewport_size({"width": 375, "height": 812})
    check("no horizontal scroll at 375px", lambda: (
        None if page.evaluate("document.documentElement.scrollWidth <= window.innerWidth") else (_ for _ in ()).throw(AssertionError("page scrolls sideways"))))
    page.screenshot(path=f"{OUT}/4-mobile.png", full_page=True)
    browser.close()

for status, label in results: print(f"{status}  {label}")
print(f"console errors: {console_errors or 'none'}")
print(f"{sum(s == 'PASS' for s, _ in results)}/{len(results)} passed")
