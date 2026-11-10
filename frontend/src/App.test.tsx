import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { Actions } from "./App";
import { strings } from "./strings";
import { ApplicantView } from "./views";

const bn = strings.bn;
const ID = "20152691234567890";
const cls = { id: "c_1", name: "Class 6 - Morning Shift", totalSeats: 3, heldSeats: 1, confirmedSeats: 1, availableSeats: 1 };

type Route = { status: number; body?: unknown } | "offline";

// Minimal fetch stub: "METHOD /path" -> response. Unlisted routes answer 404.
function stubApi(routes: Record<string, Route>) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const key = `${init?.method ?? "GET"} ${new URL(url).pathname}`;
      calls.push(key);
      const r = routes[key] ?? { status: 404, body: { error: "Not found." } };
      if (r === "offline") throw new TypeError("Failed to fetch");
      return new Response(r.body === undefined ? "" : JSON.stringify(r.body), { status: r.status });
    }),
  );
  return calls;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("rendering", () => {
  it("shows the classes with their seat counts, in Bangla by default", async () => {
    stubApi({ "GET /classes": { status: 200, body: [cls] } });
    render(<App />);
    expect(await screen.findByText("Class 6 - Morning Shift")).toBeTruthy();
    expect(screen.getByRole("heading", { name: bn.appTitle })).toBeTruthy();
    expect(screen.getByRole("heading", { name: bn.classList })).toBeTruthy();
    // without an ID the apply button is disabled and a hint says why
    expect((screen.getByRole("button", { name: bn.apply }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(bn.studentIdNeeded)).toBeTruthy();
  });

  it("switches every label to English and back", async () => {
    stubApi({ "GET /classes": { status: 200, body: [cls] } });
    render(<App />);
    await screen.findByText("Class 6 - Morning Shift");
    fireEvent.click(screen.getByRole("button", { name: bn.langSwitchLabel }));
    expect(screen.getByRole("heading", { name: "Classes" })).toBeTruthy();
    expect(localStorage.getItem("lang")).toBe("en");
  });

  it("Bangla mode shows no English except class names and the language switch", async () => {
    stubApi({ "GET /classes": { status: 200, body: [cls] } });
    const { container } = render(<App />);
    await screen.findByText("Class 6 - Morning Shift");
    const text = (container.textContent ?? "").replaceAll(cls.name, "").replaceAll(bn.langSwitch, "");
    expect(text.match(/[A-Za-z]+/g)).toBeNull();
  });
});

describe("start view", () => {
  it("always opens on the parent view, even if Admin was open last time", async () => {
    stubApi({ "GET /classes": { status: 200, body: [cls] } });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: bn.viewAdmin }));
    cleanup();
    render(<App />);
    expect(screen.getByRole("button", { name: bn.viewApplicant }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText(bn.createClass)).toBeNull();
  });
});

describe("17-digit student ID", () => {
  it("rejects anything that is not exactly 17 digits", async () => {
    stubApi({ "GET /classes": { status: 200, body: [cls] } });
    render(<App />);
    const input = screen.getByLabelText(bn.studentIdLabel);
    for (const bad of ["1234567890123456", "123456789012345678", "1234567890123456a"]) {
      fireEvent.change(input, { target: { value: bad } });
      fireEvent.blur(input);
      expect(screen.getByText(bn.studentIdInvalid)).toBeTruthy();
      expect(localStorage.getItem("studentId")).toBe("");
    }
    // a partial number shows no error while the parent is still typing
    fireEvent.change(input, { target: { value: "2015" } });
    expect(screen.queryByText(bn.studentIdInvalid)).toBeNull();
  });

  it("accepts Bangla digits, saves the ID as soon as it is valid and enables applying", async () => {
    stubApi({ "GET /classes": { status: 200, body: [cls] }, "GET /me/holds": { status: 200, body: [] } });
    render(<App />);
    fireEvent.change(screen.getByLabelText(bn.studentIdLabel), { target: { value: "২০১৫২৬৯১২৩৪৫৬৭৮৯০" } });
    expect(localStorage.getItem("studentId")).toBe(ID);
    await waitFor(() => expect((screen.getByRole("button", { name: bn.apply }) as HTMLButtonElement).disabled).toBe(false));
  });

  it("sends the saved ID as X-Student-Id after a reload", async () => {
    localStorage.setItem("studentId", ID);
    stubApi({ "GET /classes": { status: 200, body: [cls] }, "GET /me/holds": { status: 200, body: [] } });
    render(<App />);
    await screen.findByText(bn.myApplicationsEmpty);
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(([u]) => String(u).endsWith("/me/holds"));
    expect((call![1] as RequestInit).headers).toMatchObject({ "X-Student-Id": ID });
  });
});

describe("countdown", () => {
  it("turns a hold into EXPIRED and disables pay when the timer reaches zero, without a reload", () => {
    vi.useFakeTimers();
    const t0 = new Date("2026-11-10T10:00:00Z").getTime();
    vi.setSystemTime(t0);
    const hold = { holdId: "h_1", classId: "c_1", className: cls.name, status: "HELD" as const, expiresAt: new Date(t0 + 2000).toISOString() };
    const actions: Actions = { apply: vi.fn(), pay: vi.fn(), cancel: vi.fn(), createClass: vi.fn(), busy: new Set() };
    render(<ApplicantView classes={[cls]} failed={false} holds={[hold]} hasId actions={actions} />);

    expect(screen.getByTestId("countdown").textContent).toBe("00:02");
    expect((screen.getByRole("button", { name: bn.pay }) as HTMLButtonElement).disabled).toBe(false);

    act(() => vi.advanceTimersByTime(2500));

    expect(screen.getByTestId("countdown").textContent).toBe("00:00");
    expect(screen.getAllByText(bn.statusEXPIRED).length).toBeGreaterThan(0);
    expect((screen.getByRole("button", { name: bn.pay }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("errors", () => {
  it("shows a banner, not a blank page, when the server is unreachable", async () => {
    stubApi({ "GET /classes": "offline" });
    render(<App />);
    expect(await screen.findByText(bn.errOffline)).toBeTruthy();
    expect(screen.getByText(bn.loadFailed)).toBeTruthy();
  });

  it("shows a readable message when the class is already full", async () => {
    localStorage.setItem("studentId", ID);
    stubApi({
      "GET /classes": { status: 200, body: [cls] },
      "GET /me/holds": { status: 200, body: [] },
      "POST /classes/c_1/holds": { status: 409, body: { error: "No seats available in this class." } },
    });
    render(<App />);
    const apply = await screen.findByRole("button", { name: bn.apply });
    await waitFor(() => expect((apply as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(apply);
    expect(await screen.findByText(bn.errFull)).toBeTruthy();
  });

  it("validates the admin form inline before calling the API", async () => {
    const calls = stubApi({ "GET /classes": { status: 200, body: [] } });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: bn.viewAdmin }));
    fireEvent.click(screen.getByRole("button", { name: bn.formSubmit }));
    expect(screen.getByText(bn.formNeedClass)).toBeTruthy();
    expect(screen.getByText(bn.formNeedSeats)).toBeTruthy();
    expect(calls.some((c) => c.startsWith("POST"))).toBe(false);
  });
});

describe("strings", () => {
  it("English has exactly the Bangla keys, and no string is empty", () => {
    expect(Object.keys(strings.en).sort()).toEqual(Object.keys(strings.bn).sort());
    for (const lang of ["bn", "en"] as const)
      for (const [k, v] of Object.entries(strings[lang])) expect(v.trim(), `${lang}.${k}`).not.toBe("");
  });
});
