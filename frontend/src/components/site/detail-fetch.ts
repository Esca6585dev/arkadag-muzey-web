import { notFound } from "next/navigation";
import { api, ApiRequestError } from "@/lib/api";

/** Fetch a detail resource; a 404 from the API becomes Next's notFound(). */
export async function getOr404<T>(path: string, locale: string): Promise<T> {
  try {
    return await api.get<T>(path, { revalidate: 60, locale });
  } catch (e) {
    if (e instanceof ApiRequestError && e.status === 404) notFound();
    throw e;
  }
}

/** Same but returns null on any error (for generateMetadata). */
export async function getOrNull<T>(path: string, locale: string): Promise<T | null> {
  try {
    return await api.get<T>(path, { revalidate: 60, locale });
  } catch {
    return null;
  }
}
