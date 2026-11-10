# UI/UX decisions

The plan for the web UI. Nothing is built until this file is agreed.

## 1. What the brief requires (requirement.md §3 and the UI rules)

- Everything works from the UI, with no Postman or database access (rule 8).
- An ID bar at the top for the 17-digit birth registration number. It is saved in `localStorage` and survives a reload or browser restart (rule 11).
- Four screens or sections:
  - **Class তৈরি:** a form with name and total seats.
  - **Class তালিকা:** each class shows Total, Held, Confirmed and Available, plus an **"আবেদন করুন"** button.
  - **আবেদন:** the status, a live countdown, **"ভর্তি ফি দিন"** and **"বাতিল"**.
  - **আমার আবেদন:** every hold from `GET /me/holds`, with status, class name, and the actions and timer while `HELD`.
- "ভর্তি ফি দিন" simulates payment and calls confirm immediately.
- When the timer reaches 0, the UI shows `EXPIRED` and disables pay, with no reload (rule 9).
- Seat counts refresh every 2–3 s without a reload (rule 10). We use 3 s.
- Every error shows a human-readable message. A blank screen or a console-only error is not allowed (rule 12).
- Frontend tests (Vitest + RTL), Bonus 2:
  - rendering
  - 17-digit ID handling
  - countdown expiry
  - error display.

Already decided in ASSUMPTIONS.md:
- Applicant and Admin views, switched in the UI.
- A seat map drawn from the counts.
- A countdown on the pending application's button.
- Toasts for errors.
- Buttons disabled while their request is in flight.
- Bangla by default.

## 2. Research: how admission portals are built

**From sources**, search results on Bangladesh's government school admission portal (gsa.teletalk.com.bd):
- The portal is Bangla-first. Its page titles are in Bangla, for example "সরকারি বিদ্যালয়ে লটারির ফলাফল".
- The flow is: apply online before a fixed deadline, then check the result by user ID. Results come as separate lists (1st result, waiting lists). They are also available by SMS.
- Applicants look results up by an ID rather than by logging in.

I could not open the portal itself. Its TLS certificate failed, and I did not bypass the check.

**Inference from common admission and booking portals (general knowledge, not checked against a source):**
- One task per screen, with one obvious main action.
- Status shown as a coloured badge plus a word, never colour alone.
- A deadline or timer shown next to the action it limits.
- Mobile-first layout, because many parents apply from phones.
- Numbers and dates in the reader's language.
- Error text that tells the user what to do next, not just what failed.

## 3. Decisions

Filled in one question at a time.

| # | Topic | Decision | Why |
|---|---|---|---|
| 1 | Layout | One page with two views and no routing. **Top bar:** ID input, Applicant/Admin switch, বাংলা/EN switch. **Applicant view:** আমার আবেদন (active hold and timer) first, then Class তালিকা. **Admin view:** the Class তৈরি form, then the class table with counts. Responsive from phone to desktop. Every state change (hold, confirm, cancel, expiry, live counts) shows at once, without a reload. | Fewest moving parts, and it matches the brief's four sections. A parent sees their own application before the list. |
| 2 | Language | Bangla by default, with a বাংলা/EN switch. In Bangla mode every word is Bangla: labels, buttons, statuses, errors and toasts. Digits stay 0–9 in both languages, including seat counts, the timer and IDs. Class names show exactly as the admin typed them. | Numbers match what the API and the ID card use, so nothing has to be converted. |
| 3 | Strings | All text lives in one file, `strings.ts`, shaped as `{ bn, en }`. Three layers, and none of them can break the running UI. **(a) Build time:** TypeScript requires `en` to have exactly the keys `bn` has, so a missing key fails the build before it ships. **(b) Runtime:** `t(key)` uses the current language and falls back to Bangla, then to the key itself, so a gap shows a word instead of crashing or going blank. **(c) Test:** a Vitest test renders every view in Bangla mode and lists any stray English text, allowing class names, IDs, digits and the "EN" switch label. It fails only in CI, never for users. The language choice is saved in `localStorage`. No i18n library. | Catches stale text before it ships, while a user never sees a crash or blank screen from a missing string. |
| 4 | Applicant flow | Without a valid ID, the class list is visible but "আবেদন করুন" is disabled, and a hint asks for the 17-digit number. After applying, a hold card appears at the top of আমার আবেদন with a large countdown and "ভর্তি ফি দিন" / "বাতিল". That class's apply button shows the running timer. Cancel asks for a one-tap confirmation. Pay doesn't, because the payment is simulated. | Nobody can act without an ID. Every action stays on the page, and the timer is always visible next to the button it limits. |
| 5 | Seats | *(Changed by the Hallmark review: one list of rows, not cards, and the map opens as an inline disclosure.)* Each class is a row with four numbers (মোট, সংরক্ষিত, নিশ্চিত, খালি) and one stacked bar: confirmed, then held, then free. Tapping the card opens the seat-box map. A class with nothing available shows a "full" label and a disabled button. | The counts are readable at a glance on a phone. The map is there for anyone who wants it, without 120 boxes on every card. |
| 6 | Feedback | **Action results:** a short toast (hold placed, class full, expired, and so on). **Field errors:** inline under the field (a bad ID, invalid class input). **Server unreachable:** a sticky banner at the top that stays until a poll succeeds. The page keeps showing the last known data, never a blank screen. **Status:** a badge with a colour and a word. All of it is hand-built, with no toast library. | Each message appears where it belongs. A server outage can't vanish with a timed toast. Colour is never the only signal. |
| 7 | Look | Calm and civic. White background with one accent, deep green `#006A4E`, the Bangladesh flag green, used for primary actions. Status colours: amber for held, green for confirmed, grey for expired or cancelled, red only for errors. Bangla text uses Hind Siliguri, loaded from Google Fonts, falling back to Noto Sans Bengali, Nirmala UI, then sans-serif. English uses the system font. Large tap targets, plain cards, no gradients or illustrations. Light mode only. | Readable for every parent on any phone. One accent keeps the main action obvious. If the font can't load offline, Bangla still renders in a system font. |
| 8 | Admin form | Three fields: a class dropdown (1–10), a shift dropdown (Morning, Day) and total seats (1 or more, validated inline). The UI builds the name as `Class {n} - {Morning\|Day} Shift`, the brief's own format, and sends only `{ name, totalSeats }`, so the API contract doesn't change. The name is stored in English and shown as stored in both languages. The API's 400 text is shown as a fallback. | Stops typos and keeps every class name consistent. The request body stays exactly as the contract defines it. |

## 4. Hallmark review (app-screen scope)

Hallmark treats this as an **app screen**, a tool someone works in. Its marketing rules don't apply here: no hero, fold, word budget or stock photos. The Floor and the app rules do apply. Here is how each decision fared:

| Check | Verdict | Change to the plan |
|---|---|---|
| Tables before cards; never a card inside a card | **Decision 5 was a reflex.** It had floating cards with a seat map inside each one. | The class list becomes **rows in one list**: a table on desktop that stacks on a phone. The seat map opens as an inline disclosure under its row (`<details>`), not a card or a modal. Admin uses the same table. |
| A modal is the last answer | Passes | Cancel confirms inline: the button turns into "নিশ্চিত? হ্যাঁ / না" for 4 s. |
| Every data region has four states | **Missing** from the plan | Added as decision 9 below. |
| Figures are the product's own, in tabular numerals | Passes once specified | Counts and the timer use `font-variant-numeric: tabular-nums`, so the countdown doesn't jitter. No icons, no trend arrows. |
| Colour is restrained: the accent marks action, selection and state only | Passes | `#006A4E` is used for the primary button, the selected view tab and "confirmed". Amber means held. Grey means expired or cancelled. Red means error. Nothing else is coloured. |
| Every colour and font goes through a `:root` token (Floor 1) | Specified for the build | Tailwind v4 `@theme` tokens only. No `bg-[#hex]` or other one-off values in the markup. |
| No tracked capitals, no eyebrow labels (Floor 9) | Passes | Table heads and labels are body text, one step smaller, in sentence case. Bangla has no case. |
| No decorative status dots or middle-dot meta strings (Floor 10) | Specified | A status badge is a word on a tint, with no dot. |
| Focus is visible at once (Floor 6), and every animation respects reduced motion (Floor 7) | Specified for the build | `:focus-visible` rings come from a token. Toasts and the bar animate only `opacity` and `transform`, with a `prefers-reduced-motion` fallback. |
| `overflow-x: clip` on `html` and `body` (Floor 4) | Specified | Set in the base CSS. |
| At most two type families | Passes | Hind Siliguri plus the system sans. |
| State lives in the URL | **Waived** | The view switch stays in `localStorage`. The user asked for it to persist that way (ASSUMPTIONS.md), and it's a two-view tool, not a filtered list. |
| Signature: the one object the tool is known by | **Named** | **The admission slip.** It's the hold card at the top of আমার আবেদন: the class, a large countdown and the two actions. A parent should remember the page by it. |

After the build, `sloplint --scope app` runs on the frontend files with the dev server up. Every FAIL gets fixed; every REFLEX gets fixed or waived on the record.

## 5. Decisions added by the review

| # | Topic | Decision |
|---|---|---|
| 9 | Data states | The class list and আমার আবেদন each have four states. **Loading:** skeleton rows in the shape of the real rows. **Empty:** for applicants, "কোনো শ্রেণি এখনো খোলা হয়নি", which means no class has opened yet; for admins, the same message plus a pointer to the form. **Error:** the banner from decision 6 while the last data stays visible, or, if nothing has loaded yet, one line saying what broke and that it retries every 3 s. **Full:** the normal list. |
| 10 | Numbers and motion | Tabular numerals for every count and the timer. The countdown updates every 250 ms from `expiresAt`, and at 0 the slip turns grey, says মেয়াদ উত্তীর্ণ ("expired") and disables pay. Only state changes animate. |
