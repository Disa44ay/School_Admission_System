import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, errorKey, isStudentId, type ClassSeats, type MyHold } from "./api";
import { translate, type Lang, type StringKey } from "./strings";
import { AdminView, ApplicantView, IdBar, Toasts, type Toast } from "./views";

type T = (key: StringKey, vars?: Record<string, string | number>) => string;
const TCtx = createContext<T>((key) => translate("bn", key));
export const useT = () => useContext(TCtx);

// localStorage can throw (private mode, blocked storage); the page must still work without it.
function useStored<V extends string>(key: string, initial: V) {
  const [value, setValue] = useState<V>(() => {
    try {
      return (localStorage.getItem(key) as V | null) ?? initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: V) => {
      setValue(v);
      try {
        localStorage.setItem(key, v);
      } catch {
        // keep working in memory
      }
    },
    [key],
  );
  return [value, set] as const;
}

export function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export type Actions = {
  apply: (classId: string) => void;
  pay: (holdId: string) => void;
  cancel: (holdId: string) => void;
  createClass: (name: string, totalSeats: number) => Promise<boolean>;
  busy: Set<string>;
};

export default function App() {
  const [lang, setLang] = useStored<Lang>("lang", "bn");
  // Not persisted: every load opens on the parent view, so parents never land on the admin form.
  const [view, setView] = useState<"applicant" | "admin">("applicant");
  const [studentId, setStudentId] = useStored<string>("studentId", "");
  const [classes, setClasses] = useState<ClassSeats[] | null>(null);
  const [classesFailed, setClassesFailed] = useState(false);
  const [holds, setHolds] = useState<MyHold[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const idRef = useRef(studentId);
  idRef.current = studentId;

  const t: T = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const toast = useCallback((key: StringKey, kind: Toast["kind"]) => {
    const id = Date.now() + Math.random();
    // Only the newest message: stacked toasts cover the list on a phone.
    setToasts([{ id, key, kind }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 5000);
  }, []);

  const refresh = useCallback(async () => {
    const res = await api<ClassSeats[]>("GET", "/classes");
    setOffline(!res.ok && (res.status === 0 || res.status === 503));
    if (res.ok) setClasses(res.data);
    setClassesFailed(!res.ok);

    const id = idRef.current;
    if (!isStudentId(id)) return setHolds(null);
    const mine = await api<MyHold[]>("GET", "/me/holds", { studentId: id });
    // Ignore a late answer for a number the parent has since changed.
    if (mine.ok && idRef.current === id) setHolds(mine.data);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    return () => clearInterval(timer);
  }, [refresh, studentId]);

  const run = useCallback(
    async (busyKey: string, call: () => Promise<{ ok: boolean; status: number; error?: string }>, okKey: StringKey) => {
      setBusy((b) => new Set(b).add(busyKey));
      const res = await call();
      setBusy((b) => {
        const next = new Set(b);
        next.delete(busyKey);
        return next;
      });
      if (res.ok) toast(okKey, "ok");
      else toast(errorKey(res.status, res.error ?? ""), "error");
      await refresh();
      return res.ok;
    },
    [refresh, toast],
  );

  const actions: Actions = {
    busy,
    apply: (classId) => void run(`apply:${classId}`, () => api("POST", `/classes/${classId}/holds`, { studentId }), "okHeld"),
    pay: (holdId) => void run(`pay:${holdId}`, () => api("POST", `/holds/${holdId}/confirm`, { studentId }), "okConfirmed"),
    cancel: (holdId) => void run(`cancel:${holdId}`, () => api("DELETE", `/holds/${holdId}`, { studentId }), "okCancelled"),
    createClass: (name, totalSeats) =>
      run("create", () => api("POST", "/classes", { body: { name, totalSeats } }), "okClassCreated"),
  };

  return (
    <TCtx.Provider value={t}>
      <IdBar
        studentId={studentId}
        onStudentId={(id) => {
          setStudentId(id);
          setHolds(null);
        }}
        view={view}
        onView={(v) => {
          if (v === "admin") {
            setStudentId("");
            setHolds(null);
          }
          setView(v);
        }}
        lang={lang}
        onLang={() => setLang(lang === "bn" ? "en" : "bn")}
      />
      {offline && (
        <div role="alert" className="border-b border-error bg-error-tint px-4 py-2 text-center text-error">
          {t("errOffline")}
        </div>
      )}
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        {view === "admin" ? (
          <AdminView classes={classes} failed={classesFailed} actions={actions} />
        ) : (
          <ApplicantView
            classes={classes}
            failed={classesFailed}
            holds={holds}
            hasId={isStudentId(studentId)}
            actions={actions}
          />
        )}
      </main>
      <Toasts toasts={toasts} onDismiss={(id) => setToasts((ts) => ts.filter((x) => x.id !== id))} />
    </TCtx.Provider>
  );
}
