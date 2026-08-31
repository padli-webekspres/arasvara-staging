"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";

export type BoostedArticle = {
  id: string;
  articleId: string;
  title: string;
  author: string;
  boostedAt: Date;
  url: string;
  status: "success" | "failed";
};

export type QuotaUsage = {
  date: string;
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
};

export function useBoostedArticles(limit = 3) {
  const [articles, setArticles] = useState<BoostedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/admin/dashboard/boosted-articles?limit=${limit}`);
        setArticles(response.data.articles || []);
        setError(null);
      } catch (err: any) {
        setError(err?.message || "Failed to fetch boosted articles");
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, [limit]);

  return { articles, loading, error };
}

export function useIndexingQuota() {
  const [quota, setQuota] = useState<QuotaUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuota = async () => {
      try {
        setLoading(true);
        const response = await api.get("/admin/dashboard/indexing-quota");
        setQuota(response.data);
        setError(null);
      } catch (err: any) {
        setError(err?.message || "Failed to fetch quota");
      } finally {
        setLoading(false);
      }
    };

    fetchQuota();
  }, []);

  return { quota, loading, error };
}
