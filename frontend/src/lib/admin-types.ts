// Admin entity types shared by admin screens.
import type { Meta, Timestamps } from "./types";

export type { Meta };
export type TranslatableValue = Record<string, string>;

export interface AdminTag extends Timestamps {
  id: number;
  slug: string;
  name: TranslatableValue | null;
}

export interface DashboardData {
  counts: Record<string, number>;
  views: { articles: number; exhibits: number };
  charts: {
    articles_by_month: { month: string; count: number }[];
    messages_by_month: { month: string; count: number }[];
    top_articles: { id: number; title: TranslatableValue | null; views: number }[];
  };
  recent: {
    articles: { id: number; title: TranslatableValue | null; status: string; created_at: string; category?: { name: TranslatableValue | null } | null }[];
    messages: { id: number; name: string; subject: string; message: string; status: string; created_at: string }[];
    logs: { id: number; action: string; entity: string; entity_id: number; created_at: string; user?: { name: string } | null }[];
  };
}

export type ListParams = {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  [filter: string]: string | number | boolean | undefined | null;
};
