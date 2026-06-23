"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { isSortable } from "@dnd-kit/react/sortable";
import { ArticleListResponse } from "@/types/article";
import SelectAndSort from "@/components/admin/articles/SelectAndSort";
import api from "@/lib/axios";
import { SectionArticleItem } from "@/types/articleSection";

const HeadlinePage = () => {
  // State untuk headline articles
  const [headlines, setHeadlines] = useState<SectionArticleItem[]>([]);
  const [loadingHeadlines, setLoadingHeadlines] = useState(true);

  // State untuk search dan infinite scroll
  // List artikel yang bisa dipilih (tidak termasuk yang sudah ada di headlines)
  const [availableArticles, setAvailableArticles] = useState<
    ArticleListResponse[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch existing headline articles saat mount
  useEffect(() => {
    const fetchExistingHeadlines = async () => {
      try {
        setLoadingHeadlines(true);
        const response = await api.get("/articles/headline");
        const { data } = response.data;
        setHeadlines(data || []);
        toast.success("Headline berhasil dimuat");
      } catch (error) {
        console.error("Error fetching headlines:", error);
        toast.error("Gagal memuat Headline");
      } finally {
        setLoadingHeadlines(false);
      }
    };

    fetchExistingHeadlines();
  }, []);

  // Fetch artikel dari API, lalu filter agar tidak tampil jika sudah ada di headlines
  const fetchArticles = useCallback(
    async (searchTerm: string, paginationCursor?: string | null) => {
      try {
        setLoading(true);

        // Build query params
        const params: Record<string, any> = {
          limit: 7,
          status: "PUBLISHED",
        };

        if (searchTerm.trim()) {
          params.search = searchTerm.trim();
        }

        if (paginationCursor) {
          params.cursor = paginationCursor;
        }

        // Fetch dari API
        const response = await api.get("/articles", { params });
        const { articles, nextCursor } = response.data;

        // Filter: hilangkan artikel yang sudah ada di headlines
        const filteredArticles = articles.filter(
          (a: ArticleListResponse) =>
            !headlines.some((h) => h.article?._id === a._id),
        );

        if (paginationCursor) {
          setAvailableArticles((prev) => [...prev, ...filteredArticles]);
        } else {
          setAvailableArticles(filteredArticles);
        }

        setCursor(nextCursor || null);
        setHasMore(!!nextCursor);

        if (filteredArticles.length === 0 && !paginationCursor) {
          toast.info("Tidak ada artikel yang ditemukan");
        }
      } catch (error) {
        console.error("Error fetching articles:", error);
        toast.error("Gagal memuat artikel");
      } finally {
        setLoading(false);
      }
    },
    [headlines],
  );

  // Debounce search query (500ms)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      // Reset cursor ketika search berubah
      setCursor(null);
      setHasMore(true);
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  // Fetch artikel ketika debouncedSearch berubah
  useEffect(() => {
    fetchArticles(debouncedSearch, null);
  }, [debouncedSearch, fetchArticles]);

  // Handler untuk infinite scroll
  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore && cursor) {
      fetchArticles(debouncedSearch, cursor);
    }
  }, [loading, hasMore, cursor, debouncedSearch, fetchArticles]);

  // Handler: tambah artikel ke headlines, lalu hilangkan dari availableArticles
  const handleAddArticle = (article: ArticleListResponse) => {
    const isAlreadyAdded = headlines.some(
      (item) => item.article?._id === article._id,
    );
    if (isAlreadyAdded) return toast.error("Sudah ada di Headline!");

    setHeadlines((prev) => [
      ...prev,
      {
        _id: article._id || Math.random().toString(),
        article_id: article._id || "",
        article,
        order: prev.length,
        createdAt: new Date(),
        createdBy: "local",
      },
    ]);

    // Hilangkan dari availableArticles
    setAvailableArticles((prev) => prev.filter((a) => a._id !== article._id));

    toast.success("Artikel ditambahkan ke Headline");
  };

  // Handler: hapus artikel dari headlines, lalu munculkan lagi di availableArticles
  const handleRemoveArticle = (idToRemove: string) => {
    setHeadlines((prev) => {
      const removed = prev.find((item) => item._id === idToRemove);
      if (removed && removed.article) {
        setAvailableArticles((prevArticles) => {
          // Gabungkan artikel yang dihapus ke awal, lalu filter agar unik berdasarkan _id
          const combined = [
            removed.article as ArticleListResponse,
            ...prevArticles,
          ];
          const seen = new Set<string | undefined>();
          return combined.filter((a) => {
            if (!a._id) return false;
            if (seen.has(a._id)) return false;
            seen.add(a._id);
            return true;
          });
        });
      }
      return prev.filter((item) => item._id !== idToRemove);
    });
  };

  // Drag and Drop
  const handleDragEnd = (event: any) => {
    if (event.canceled) return;
    const { source } = event.operation;
    if (isSortable(source)) {
      const { initialIndex, index } = source.sortable;
      if (initialIndex !== index) {
        setHeadlines((items) => {
          const newItems = [...items];
          const [movedItem] = newItems.splice(initialIndex, 1);
          newItems.splice(index, 0, movedItem);
          return newItems;
        });
      }
    }
  };

  const handleSave = async () => {
    if (headlines.length === 0) {
      toast.error("Pilih minimal 1 artikel untuk Headline");
      return;
    }

    try {
      // Prepare payload dengan article_id dan maintain order dari dnd-kit
      const payload = {
        articles: headlines.map((headline) => ({
          article_id: headline.article_id,
        })),
      };

      toast.info("Menyimpan perubahan...");

      // POST ke backend
      const response = await api.post("/articles/headline", payload);

      // Update state dengan response dari server
      setHeadlines(response.data.data || []);

      toast.success("Headline berhasil disimpan!");
    } catch (error) {
      console.error("Error saving headlines:", error);
      toast.error("Gagal menyimpan Headline");
    }
  };

  return (
    <SelectAndSort
      selectedArticles={headlines}
      availableArticles={availableArticles}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      onSave={handleSave}
      onSort={handleDragEnd}
      onRemove={handleRemoveArticle}
      onAdd={handleAddArticle}
      loading={loading}
      hasMore={hasMore}
      onLoadMore={handleLoadMore}
      loadingSelected={loadingHeadlines}
      title="Headline"
    />
  );
};

export default HeadlinePage;
