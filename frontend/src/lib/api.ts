import type { ApiError, ListResponse, Meta } from "./types";

/**
 * API client used from both server components (absolute API_URL) and the browser
 * (same-origin `/api/v1`, proxied by next.config rewrites so httpOnly cookies work).
 */

const isServer = typeof window === "undefined";

export function apiBase(): string {
  if (isServer) {
    return (process.env.API_URL || "http://localhost:8085").replace(/\/$/, "") + "/api/v1";
  }
  return "/api/v1";
}

export class ApiRequestError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;
  constructor(status: number, err: ApiError) {
    super(err.message || "Request failed");
    this.status = status;
    this.code = err.code || "error";
    this.fields = err.fields;
  }
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  locale?: string;
  /** Next.js fetch cache options (server only). */
  revalidate?: number | false;
  tags?: string[];
  /** Forward cookies on the server (pass the Cookie header string). */
  cookie?: string;
}

function buildQuery(params?: RequestOptions["params"]): string {
  if (!params) return "";
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (isServer) return false;
  if (!refreshing) {
    refreshing = fetch(`${apiBase()}/auth/refresh`, { method: "POST", credentials: "include" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        setTimeout(() => (refreshing = null), 0);
      });
  }
  return refreshing;
}

export async function request<T = unknown>(path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
  const { body, params, locale, revalidate, tags, cookie, headers, ...rest } = opts;
  const url = `${apiBase()}${path.startsWith("/") ? path : `/${path}`}${buildQuery(params)}`;

  const h: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string>),
  };
  if (locale) h["X-Locale"] = locale;
  if (cookie) h["Cookie"] = cookie;

  const init: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } } = {
    ...rest,
    headers: h,
    credentials: "include",
  };

  if (body !== undefined) {
    if (body instanceof FormData) {
      init.body = body;
    } else {
      h["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
  }

  if (isServer) {
    if (revalidate !== undefined || tags) {
      init.next = { revalidate, tags };
    } else {
      init.cache = "no-store";
    }
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw new ApiRequestError(0, { code: "network_error", message: (e as Error).message || "Network error" });
  }

  if (res.status === 401 && !isServer && !retried && !path.startsWith("/auth/login") && !path.startsWith("/auth/refresh")) {
    if (await tryRefresh()) return request<T>(path, opts, true);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const err = (json as { error?: ApiError } | null)?.error || { code: "http_error", message: res.statusText || `HTTP ${res.status}` };
    throw new ApiRequestError(res.status, err);
  }
  return json as T;
}

/* Convenience helpers returning the unwrapped `data`. */

export async function get<T>(path: string, opts?: RequestOptions): Promise<T> {
  const r = await request<{ data: T }>(path, { ...opts, method: "GET" });
  return r.data;
}

export async function list<T>(path: string, opts?: RequestOptions): Promise<{ data: T[]; meta: Meta }> {
  const r = await request<ListResponse<T>>(path, { ...opts, method: "GET" });
  return { data: r.data ?? [], meta: r.meta ?? { page: 1, limit: 20, total: 0, pages: 0 } };
}

export async function post<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
  const r = await request<{ data: T }>(path, { ...opts, method: "POST", body });
  return r?.data;
}

export async function put<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
  const r = await request<{ data: T }>(path, { ...opts, method: "PUT", body });
  return r?.data;
}

export async function del<T = { message: string }>(path: string, opts?: RequestOptions): Promise<T> {
  const r = await request<{ data: T }>(path, { ...opts, method: "DELETE" });
  return r?.data;
}

/** Safe server-side fetch: returns null instead of throwing (for optional sections). */
export async function safeGet<T>(path: string, opts?: RequestOptions): Promise<T | null> {
  try {
    return await get<T>(path, opts);
  } catch {
    return null;
  }
}

export async function safeList<T>(path: string, opts?: RequestOptions): Promise<{ data: T[]; meta: Meta }> {
  try {
    return await list<T>(path, opts);
  } catch {
    return { data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } };
  }
}

export const api = { request, get, list, post, put, del, safeGet, safeList };
export default api;
