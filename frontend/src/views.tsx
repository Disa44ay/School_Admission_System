import { useEffect, useState, type ReactNode } from "react";
import { useNow, useT, type Actions } from "./App";
import { isStudentId, normaliseStudentId, type ClassSeats, type HoldStatus, type MyHold } from "./api";
import type { Lang, StringKey } from "./strings";

const btn =
  "inline-flex min-h-11 items-center justify-center rounded-md px-4 font-semibold transition-colors duration-[var(--dur-micro)] disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${btn} bg-accent text-surface hover:bg-accent-strong active:bg-accent-strong`;
const secondary = `${btn} border border-line bg-surface text-ink hover:bg-page active:bg-line`;
const field = "min-h-11 w-full rounded-md border border-line bg-surface px-3 text-ink";

// ---------- top bar ----------

export function IdBar(props: {
  studentId: string;
  onStudentId: (id: string) => void;
  view: "applicant" | "admin";
  onView: (v: "applicant" | "admin") => void;
  lang: Lang;
  onLang: () => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(props.studentId);
  const [blurred, setBlurred] = useState(false);
  const typed = normaliseStudentId(draft);
  // Wrong characters or too many digits show at once; "too short" waits until the field loses focus.
  const invalid = typed !== "" && (!/^[0-9]*$/.test(typed) || typed.length > 17 || (blurred && typed.length !== 17));

  const tab = (v: "applicant" | "admin", key: StringKey) => (
    <button
      type="button"
      aria-pressed={props.view === v}
      onClick={() => props.onView(v)}
      className={`min-h-11 px-4 font-semibold ${props.view === v ? "bg-accent text-surface" : "bg-surface text-ink hover:bg-page"}`}
    >
      {t(key)}
    </button>
  );

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-end gap-3 px-4 py-3">
        <h1 className="mr-auto text-xl font-semibold">{t("appTitle")}</h1>
        <div className="flex overflow-hidden rounded-md border border-line">
          {tab("applicant", "viewApplicant")}
          {tab("admin", "viewAdmin")}
        </div>
        <button type="button" className={secondary} onClick={props.onLang} aria-label={t("langSwitchLabel")}>
          {t("langSwitch")}
        </button>
      </div>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 pb-3">
        <label className="text-sm text-muted" htmlFor="student-id">
          {t("studentIdLabel")}
        </label>
        <input
          id="student-id"
          inputMode="numeric"
          autoComplete="off"
          className={`${field} num max-w-md ${invalid ? "border-error" : ""}`}
          value={draft}
          aria-invalid={invalid}
          aria-describedby={invalid ? "student-id-error" : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            setBlurred(false);
            const id = normaliseStudentId(e.target.value);
            // A valid number is active at once; anything else clears the active ID.
            props.onStudentId(isStudentId(id) ? id : "");
          }}
          onBlur={() => setBlurred(true)}
        />
        {invalid && (
          <p id="student-id-error" className="text-sm text-error">
            {t("studentIdInvalid")}
          </p>
        )}
      </div>
    </header>
  );
}

// ---------- toasts ----------

export type Toast = { id: number; key: StringKey; kind: "ok" | "error" };

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  const t = useT();
  return (
    <div aria-live="polite" className="fixed inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-md flex-col gap-2 p-4">
      {toasts.map((x) => (
        <div
          key={x.id}
          role={x.kind === "error" ? "alert" : "status"}
          className={`fade-in flex items-start gap-3 rounded-md border px-4 py-3 shadow-sm ${
            x.kind === "error" ? "border-error bg-error-tint text-error" : "border-accent bg-accent-tint text-accent-strong"
          }`}
        >
          <p className="mr-auto">{t(x.key)}</p>
          <button type="button" className="min-h-6 whitespace-nowrap underline" onClick={() => onDismiss(x.id)}>
            {t("dismiss")}
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------- shared pieces ----------

const statusStyle: Record<HoldStatus, string> = {
  HELD: "bg-held-tint text-held",
  CONFIRMED: "bg-accent-tint text-accent-strong",
  EXPIRED: "bg-ended-tint text-ended",
  CANCELLED: "bg-ended-tint text-ended",
};

function Badge({ status }: { status: HoldStatus }) {
  const t = useT();
  return <span className={`rounded px-2 py-0.5 text-sm font-semibold ${statusStyle[status]}`}>{t(`status${status}`)}</span>;
}

export function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// The server is the authority; this only stops showing a HELD hold as live once its time is up.
export function effectiveStatus(h: MyHold, now: number): HoldStatus {
  return h.status === "HELD" && Date.parse(h.expiresAt) <= now ? "EXPIRED" : h.status;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Notice({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "error" }) {
  return (
    <p
      className={`rounded-md border px-4 py-3 ${tone === "error" ? "border-error bg-error-tint text-error" : "border-line bg-surface text-muted"}`}
    >
      {children}
    </p>
  );
}

// ---------- applicant view ----------

export function ApplicantView(props: {
  classes: ClassSeats[] | null;
  failed: boolean;
  holds: MyHold[] | null;
  hasId: boolean;
  actions: Actions;
}) {
  const t = useT();
  const now = useNow(250);
  return (
    <>
      {props.hasId && (
        <Section title={t("myApplications")}>
          <MyApplications holds={props.holds} now={now} actions={props.actions} />
        </Section>
      )}
      <Section title={t("classList")}>
        {!props.hasId && <p className="mb-3 text-held">{t("studentIdNeeded")}</p>}
        <ClassList {...props} now={now} mode="applicant" />
      </Section>
    </>
  );
}

function MyApplications({ holds, now, actions }: { holds: MyHold[] | null; now: number; actions: Actions }) {
  const t = useT();
  if (holds === null) return <Skeleton rows={1} />;
  if (holds.length === 0) return <Notice>{t("myApplicationsEmpty")}</Notice>;
  // A hold stays a slip until the server says EXPIRED, so at 0 the slip itself greys out and disables pay (rule 9).
  const live = holds.filter((h) => h.status === "HELD");
  const rest = holds.filter((h) => h.status !== "HELD");
  return (
    <div className="flex flex-col gap-3">
      {live.map((h) => (
        <Slip key={h.holdId} hold={h} now={now} actions={actions} />
      ))}
      {rest.length > 0 && (
        <ul className="divide-y divide-line rounded-md border border-line bg-surface">
          {rest.map((h) => (
            <li key={h.holdId} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="mr-auto">{h.className}</span>
              <Badge status={effectiveStatus(h, now)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The admission slip: the one live hold, its countdown and its two actions.
export function Slip({ hold, now, actions }: { hold: MyHold; now: number; actions: Actions }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const id = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(id);
  }, [confirming]);

  const status = effectiveStatus(hold, now);
  const live = status === "HELD";
  const remaining = Date.parse(hold.expiresAt) - now;
  const busy = actions.busy.has(`pay:${hold.holdId}`) || actions.busy.has(`cancel:${hold.holdId}`);

  return (
    <article
      aria-label={hold.className}
      className={`fade-in rounded-md border-2 bg-surface p-4 ${live ? "border-held" : "border-line"}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="mr-auto text-lg font-semibold">{hold.className}</h3>
        <Badge status={status} />
      </div>
      <p className="mt-2 text-sm text-muted">{t("timeLeft")}</p>
      <p className="num text-4xl font-semibold" aria-live="off" data-testid="countdown">
        {formatRemaining(remaining)}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={primary} disabled={!live || busy} onClick={() => actions.pay(hold.holdId)}>
          {t("pay")}
        </button>
        {confirming ? (
          <span className="flex items-center gap-2">
            <span>{t("cancelSure")}</span>
            <button
              type="button"
              className={`${btn} border border-error text-error hover:bg-error-tint`}
              disabled={!live || busy}
              onClick={() => {
                setConfirming(false);
                actions.cancel(hold.holdId);
              }}
            >
              {t("yes")}
            </button>
            <button type="button" className={secondary} onClick={() => setConfirming(false)}>
              {t("no")}
            </button>
          </span>
        ) : (
          <button type="button" className={secondary} disabled={!live || busy} onClick={() => setConfirming(true)}>
            {t("cancel")}
          </button>
        )}
      </div>
    </article>
  );
}

// ---------- class list (both views) ----------

function Skeleton({ rows }: { rows: number }) {
  return (
    <div aria-busy="true" className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-14 rounded-md bg-line opacity-60" />
      ))}
    </div>
  );
}

function ClassList(props: {
  classes: ClassSeats[] | null;
  failed: boolean;
  holds?: MyHold[] | null;
  hasId?: boolean;
  actions: Actions;
  now: number;
  mode: "applicant" | "admin";
}) {
  const t = useT();
  if (props.classes === null) return props.failed ? <Notice tone="error">{t("loadFailed")}</Notice> : <Skeleton rows={3} />;
  if (props.classes.length === 0)
    return <Notice>{t(props.mode === "admin" ? "classListEmptyAdmin" : "classListEmpty")}</Notice>;

  const cols = props.mode === "applicant" ? "md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_minmax(0,1.4fr)]" : "md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]";
  return (
    <div className="rounded-md border border-line bg-surface">
      <div className={`hidden gap-3 border-b border-line px-4 py-2 text-sm text-muted md:grid ${cols}`}>
        <span>{t("colClass")}</span>
        <span>{t("colTotal")}</span>
        <span>{t("colHeld")}</span>
        <span>{t("colConfirmed")}</span>
        <span>{t("colAvailable")}</span>
        {props.mode === "applicant" && <span />}
      </div>
      <ul className="divide-y divide-line">
        {props.classes.map((c) => (
          <ClassRow key={c.id} c={c} cols={cols} {...props} />
        ))}
      </ul>
    </div>
  );
}

function ClassRow({
  c,
  cols,
  holds,
  hasId,
  actions,
  now,
  mode,
}: {
  c: ClassSeats;
  cols: string;
  holds?: MyHold[] | null;
  hasId?: boolean;
  actions: Actions;
  now: number;
  mode: "applicant" | "admin";
}) {
  const t = useT();
  const mine = holds?.find((h) => h.classId === c.id && ["HELD", "CONFIRMED"].includes(effectiveStatus(h, now)));
  const num = (label: StringKey, value: number) => (
    <span className="flex items-baseline justify-between gap-2 md:block">
      <span className="text-sm text-muted md:hidden">{t(label)}</span>
      <span className="num font-semibold">{value}</span>
    </span>
  );

  let action: ReactNode = null;
  if (mode === "applicant") {
    if (mine && effectiveStatus(mine, now) === "HELD")
      action = (
        <span className="num font-semibold text-held">
          {t("timeLeft")} {formatRemaining(Date.parse(mine.expiresAt) - now)}
        </span>
      );
    else if (mine) action = <Badge status="CONFIRMED" />;
    else if (c.availableSeats <= 0) action = <span className="font-semibold text-error">{t("full")}</span>;
    else
      action = (
        <button
          type="button"
          className={`${primary} w-full md:w-auto`}
          disabled={!hasId || actions.busy.has(`apply:${c.id}`)}
          onClick={() => actions.apply(c.id)}
        >
          {t("apply")}
        </button>
      );
  }

  return (
    <li className="px-4 py-3">
      <div className={`grid grid-cols-1 items-center gap-2 md:gap-3 ${cols}`}>
        <span className="font-semibold">{c.name}</span>
        {num("colTotal", c.totalSeats)}
        {num("colHeld", c.heldSeats)}
        {num("colConfirmed", c.confirmedSeats)}
        {num("colAvailable", c.availableSeats)}
        {action}
      </div>
      <SeatBar c={c} />
      <details className="mt-1">
        <summary className="cursor-pointer text-sm text-muted">{t("seatMap")}</summary>
        <SeatMap c={c} />
      </details>
    </li>
  );
}

function SeatBar({ c }: { c: ClassSeats }) {
  const pct = (n: number) => `${(n / c.totalSeats) * 100}%`;
  return (
    <div aria-hidden="true" className="mt-2 flex h-2 overflow-hidden rounded-full bg-line">
      <div className="bg-accent" style={{ width: pct(c.confirmedSeats) }} />
      <div className="bg-held" style={{ width: pct(c.heldSeats) }} />
    </div>
  );
}

// shortcut: no map above 300 seats (a wall of boxes helps nobody); page through it if bigger classes appear.
function SeatMap({ c }: { c: ClassSeats }) {
  const t = useT();
  if (c.totalSeats > 300) return <p className="mt-2 text-sm text-muted">{t("seatMapTooLarge")}</p>;
  return (
    <div className="mt-2 flex flex-wrap gap-1" aria-label={t("seatMap")}>
      {Array.from({ length: c.totalSeats }, (_, i) => {
        const kind = i < c.confirmedSeats ? "bg-accent" : i < c.confirmedSeats + c.heldSeats ? "bg-held" : "border border-line bg-surface";
        return <span key={i} className={`size-4 rounded-sm ${kind}`} />;
      })}
    </div>
  );
}

// ---------- admin view ----------

export function AdminView({ classes, failed, actions }: { classes: ClassSeats[] | null; failed: boolean; actions: Actions }) {
  const t = useT();
  const now = useNow(1000);
  return (
    <>
      <Section title={t("createClass")}>
        <CreateClassForm actions={actions} />
      </Section>
      <Section title={t("classList")}>
        <ClassList classes={classes} failed={failed} actions={actions} now={now} mode="admin" />
      </Section>
    </>
  );
}

export function CreateClassForm({ actions }: { actions: Actions }) {
  const t = useT();
  const [classNo, setClassNo] = useState("");
  const [shift, setShift] = useState("");
  const [seats, setSeats] = useState("");
  const [errors, setErrors] = useState<StringKey[]>([]);

  const submit = async () => {
    const n = Number(seats);
    const errs: StringKey[] = [];
    if (!classNo) errs.push("formNeedClass");
    if (!shift) errs.push("formNeedShift");
    if (!Number.isInteger(n) || n < 1) errs.push("formNeedSeats");
    setErrors(errs);
    if (errs.length) return;
    if (await actions.createClass(`Class ${classNo} - ${shift} Shift`, n)) {
      setClassNo("");
      setShift("");
      setSeats("");
    }
  };

  const err = (key: StringKey) =>
    errors.includes(key) && <p className="text-sm text-error">{t(key)}</p>;

  return (
    <form
      className="grid grid-cols-1 gap-4 rounded-md border border-line bg-surface p-4 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-start"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      noValidate
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="f-class" className="text-sm text-muted">{t("formClass")}</label>
        <select id="f-class" className={field} value={classNo} onChange={(e) => setClassNo(e.target.value)} aria-invalid={errors.includes("formNeedClass")}>
          <option value="">{t("formClassPick")}</option>
          {Array.from({ length: 10 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {t("formClassNumber", { n: i + 1 })}
            </option>
          ))}
        </select>
        {err("formNeedClass")}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="f-shift" className="text-sm text-muted">{t("formShift")}</label>
        <select id="f-shift" className={field} value={shift} onChange={(e) => setShift(e.target.value)} aria-invalid={errors.includes("formNeedShift")}>
          <option value="">{t("formClassPick")}</option>
          <option value="Morning">{t("formShiftMorning")}</option>
          <option value="Day">{t("formShiftDay")}</option>
        </select>
        {err("formNeedShift")}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="f-seats" className="text-sm text-muted">{t("formSeats")}</label>
        <input
          id="f-seats"
          className={`${field} num`}
          inputMode="numeric"
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
          aria-invalid={errors.includes("formNeedSeats")}
        />
        {err("formNeedSeats")}
      </div>
      <button type="submit" className={`${primary} sm:mt-6`} disabled={actions.busy.has("create")}>
        {t("formSubmit")}
      </button>
    </form>
  );
}
