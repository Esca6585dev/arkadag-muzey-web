"use client";
// react-query hooks for admin CRUD resources (`/admin/<resource>`).
// Backend: GET list {data,meta}, GET /:id, POST, PUT /:id, DELETE /:id, POST /bulk-delete {ids}.
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { api, ApiRequestError } from "@/lib/api";
import type { ListParams } from "@/lib/admin-types";

export const resourceKeys = {
  all: (r: string) => ["admin", r] as const,
  list: (r: string, p?: ListParams) => ["admin", r, "list", p ?? {}] as const,
  item: (r: string, id: string | number) => ["admin", r, "item", String(id)] as const,
};

export function useResourceList<T>(resource: string, params: ListParams = {}) {
  return useQuery({
    queryKey: resourceKeys.list(resource, params),
    queryFn: () => api.list<T>(`/admin/${resource}`, { params }),
    placeholderData: keepPreviousData,
  });
}

export function useResourceItem<T>(resource: string, id?: string | number | null) {
  return useQuery({
    queryKey: resourceKeys.item(resource, id ?? "new"),
    queryFn: () => api.get<T>(`/admin/${resource}/${id}`),
    enabled: id !== undefined && id !== null && id !== "" && id !== "new",
  });
}

export interface SaveResult<T> {
  ok: boolean;
  data?: T;
  /** Field -> message map from a 422 validation error (use with react-hook-form setError). */
  fields?: Record<string, string>;
  error?: string;
}

/** `save({id?, values})` -> POST /admin/<r> or PUT /admin/<r>/<id>. Never throws: inspect `.ok`/`.fields`. */
export function useSaveResource<T = unknown>(resource: string) {
  const qc = useQueryClient();
  const t = useTranslations("admin.form");
  const m = useMutation({
    mutationFn: ({ id, values }: { id?: string | number | null; values: unknown }) =>
      id ? api.put<T>(`/admin/${resource}/${id}`, values) : api.post<T>(`/admin/${resource}`, values),
    onSuccess: (_d, v) => {
      toast.success(v.id ? t("saved") : t("created"));
      qc.invalidateQueries({ queryKey: resourceKeys.all(resource) });
    },
  });
  const save = async (input: { id?: string | number | null; values: unknown }): Promise<SaveResult<T>> => {
    try {
      const data = await m.mutateAsync(input);
      return { ok: true, data };
    } catch (e) {
      const err = e instanceof ApiRequestError ? e : null;
      if (err?.fields && Object.keys(err.fields).length) {
        toast.error(t("validationError"));
        return { ok: false, fields: err.fields, error: err.message };
      }
      const msg = err?.message || (e as Error).message;
      toast.error(msg);
      return { ok: false, error: msg };
    }
  };
  return { save, isSaving: m.isPending };
}

export function useDeleteResource(resource: string) {
  const qc = useQueryClient();
  const t = useTranslations("admin.form");
  return useMutation({
    mutationFn: (id: string | number) => api.del(`/admin/${resource}/${id}`),
    onSuccess: () => {
      toast.success(t("deleted"));
      qc.invalidateQueries({ queryKey: resourceKeys.all(resource) });
    },
    onError: (e) => toast.error((e as Error).message),
  });
}

/** POST /admin/<r>/bulk-delete {ids} -> {deleted}. */
export function useBulkDeleteResource(resource: string) {
  const qc = useQueryClient();
  const t = useTranslations("admin.form");
  return useMutation({
    mutationFn: (ids: (string | number)[]) => api.post<{ deleted: number }>(`/admin/${resource}/bulk-delete`, { ids }),
    onSuccess: () => {
      toast.success(t("deleted"));
      qc.invalidateQueries({ queryKey: resourceKeys.all(resource) });
    },
    onError: (e) => toast.error((e as Error).message),
  });
}
