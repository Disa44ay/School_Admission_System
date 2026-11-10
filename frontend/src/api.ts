import type { StringKey } from "./strings";

export const API_URL =
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "http://localhost:8080";

export type HoldStatus = "HELD" | "CONFIRMED" | "EXPIRED" | "CANCELLED";

export interface ClassSeats {
  id: string;
  name: string;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
}

export interface MyHold {
  holdId: string;
  classId: string;
  className: string;
  status: HoldStatus;
  expiresAt: string;
}

// status 0 = the server could not be reached at all.
export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: string };

export async function api<T>(
  method: string,
  path: string,
  opts: { studentId?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (opts.studentId) headers["X-Student-Id"] = opts.studentId;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    return { ok: false, status: 0, error: "" };
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON body (e.g. a proxy error page); the status code still tells us what happened
  }
  if (res.ok) return { ok: true, status: res.status, data: json as T };
  const error = (json as { error?: string; title?: string } | null)?.error ?? "";
  return { ok: false, status: res.status, error };
}

// The API's English messages, mapped to UI strings. Anything unknown falls back by status code.
export function errorKey(status: number, error: string): StringKey {
  if (status === 0) return "errOffline";
  if (status === 503) return "errBusy";
  if (status === 403) return "errNotYours";
  if (status === 404) return "errNotFound";
  if (status === 400) return error.startsWith("X-Student-Id") ? "studentIdInvalid" : "errInvalid";
  if (status === 409) {
    if (error.startsWith("No seats")) return "errFull";
    if (error.startsWith("A class with this name")) return "errDuplicateClass";
    if (error.startsWith("You already have")) return "errDuplicate";
    if (error.includes("expired")) return "errExpired";
    return "errNotActive";
  }
  return "errUnknown";
}

// Accepts Bangla digits too and strips spaces, so a parent can type the number either way.
export function normaliseStudentId(raw: string): string {
  return raw.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6)).replace(/\s/g, "");
}

export const isStudentId = (s: string) => /^[0-9]{17}$/.test(s);
