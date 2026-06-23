"use client";

import { useEffect, useState } from "react";
import { fetcher } from "@/lib/fetcher";
import NewsCard from "@/components/news/NewsCard";
import type { Article } from "@/types/article";
import { PopulatedTopic } from "@/types/general";
import SecondaryNewsCard from "@/components/news/SecondaryNewsCard";

interface Props {
  topics: PopulatedTopic[];
}

const ArticlesBySelectedTopicsPanel = ({ topics }: Props) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch articles when topics change
  useEffect(() => {
    if (!topics.length) {
      setArticles([]);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    const slugs = topics
      .filter((t) => t.category?.slug)
      .map((t) => t.category.slug)
      .join(",");
    fetcher<{ success: boolean; data: Article[] }>(
      `/articles/selected-topics?topics=${slugs}`,
    )
      .then((res) => {
        setArticles(res.data || []);
      })
      .catch((err) => {
        setError("Gagal mengambil artikel terkait");
      })
      .finally(() => setLoading(false));
  }, [topics]);

  return (
    <div className="bg-card rounded-lg border border-border p-4 md:col-span-2">
      <h3 className="text-lg font-semibold mb-2">Mungkin anda suka</h3>
      {topics.length === 0 ? (
        <div className="text-muted-foreground text-sm">pilih topik dulu</div>
      ) : loading ? (
        <div className="text-muted-foreground text-sm">Loading...</div>
      ) : error ? (
        <div className="text-destructive text-sm">{error}</div>
      ) : articles.length === 0 ? (
        <div className="text-muted-foreground text-sm">
          Tidak ada artikel terkait
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {articles.map((article) => (
            <SecondaryNewsCard key={article._id} article={article} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ArticlesBySelectedTopicsPanel;
