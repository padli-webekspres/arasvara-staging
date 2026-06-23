"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { isSortable } from "@dnd-kit/react/sortable";
import { ArticleListResponse } from "@/types/article";
import SelectAndSort from "@/components/admin/articles/SelectAndSort";
import api from "@/lib/axios";
import { SectionArticleItem } from "@/types/articleSection";

/**
 * Halaman untuk memilih dan mengelola artikel terkait (related articles)
 * untuk ditampilkan di halaman single artikel
 */
const RelatedArticlesPage = () => {
  const params = useParams() as { idOrSlug: string };
  const { idOrSlug } = params;

  // --- State untuk Related Articles Terpilih ---
  const [relatedArticles, setRelatedArticles] = useState<SectionArticleItem[]>(
    [],
  );
  const [loadingRelated, setLoadingRelated] = useState(true);

  // --- State untuk Search dan Infinite Scroll ---
  const [availableArticles, setAvailableArticles] = useState<
    ArticleListResponse[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Fetch Existing Related Articles ---
  /**
   * Fetch artikel terkait yang sudah ada untuk artikel spesifik
   */
  useEffect(() => {
    const fetchExistingRelated = async () => {
      if (!idOrSlug) return;
      try {
        setLoadingRelated(true);
        const response = await api.get(
          `/articles/${encodeURIComponent(idOrSlug)}/related`,
        );
        const data = response.data?.data || [];
        setRelatedArticles(data);
        toast.success("Artikel Terkait berhasil dimuat");
      } catch (error) {
        console.error("Error fetching related articles:", error);
        toast.error("Gagal memuat Artikel Terkait");
        setRelatedArticles([]);
      } finally {
        setLoadingRelated(false);
      }
    };

    fetchExistingRelated();
  }, [idOrSlug]);

  // --- Fetch Artikel yang Tersedia ---
  /**
   * Fetch artikel dari API dengan search, lalu filter agar tidak tampil
   * jika sudah ada di relatedArticles
   */
  const fetchAvailableArticles = useCallback(
    async (searchTerm: string, paginationCursor?: string | null) => {
      try {
        setLoading(true);

        // Build query parameters
        const queryParams: Record<string, any> = {
          limit: 7,
          status: "PUBLISHED",
        };

        // Tambah search term jika ada
        if (searchTerm.trim()) {
          queryParams.search = searchTerm.trim();
        }

        // Tambah cursor untuk pagination
        if (paginationCursor) {
          queryParams.cursor = paginationCursor;
        }

        // Fetch dari API
        const response = await api.get("/articles", { params: queryParams });
        const { articles, nextCursor } = response.data;

        // Filter: hilangkan artikel yang sudah ada di relatedArticles
        const filteredArticles = articles.filter(
          (article: ArticleListResponse) =>
            !relatedArticles.some(
              (relatedItem) => relatedItem.article?._id === article._id,
            ),
        );

        // Update available articles (append jika pagination, replace jika search baru)
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
    [relatedArticles],
  );

  // --- Debounce Search Query ---
  /**
   * Debounce search selama 500ms untuk mengurangi fetch ke API
   */
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

  // --- Fetch Artikel saat Search Berubah ---
  useEffect(() => {
    fetchAvailableArticles(debouncedSearch, null);
  }, [debouncedSearch, fetchAvailableArticles]);

  // --- Infinite Scroll Handler ---
  /**
   * Load lebih banyak artikel saat user scroll ke bawah
   */
  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore && cursor) {
      fetchAvailableArticles(debouncedSearch, cursor);
    }
  }, [loading, hasMore, cursor, debouncedSearch, fetchAvailableArticles]);

  // --- Add Article Handler ---
  /**
   * Tambah artikel ke relatedArticles dan hilangkan dari availableArticles
   */
  const handleAddArticle = (article: ArticleListResponse) => {
    const isAlreadyAdded = relatedArticles.some(
      (item) => item.article?._id === article._id,
    );
    if (isAlreadyAdded) {
      return toast.error("Sudah ada di Artikel Terkait!");
    }

    // Buat SectionArticleItem dengan dummy values (akan di-override di backend)
    const newRelatedItem: SectionArticleItem = {
      _id: article._id || Math.random().toString(),
      article_id: article._id || "",
      article,
      order: relatedArticles.length,
      createdAt: new Date(),
      createdBy: "local",
    };

    setRelatedArticles((prev) => [...prev, newRelatedItem]);

    // Hilangkan dari availableArticles
    setAvailableArticles((prev) => prev.filter((a) => a._id !== article._id));

    toast.success("Artikel ditambahkan");
  };

  // --- Remove Article Handler ---
  /**
   * Hapus artikel dari relatedArticles dan munculkan kembali di availableArticles
   */
  const handleRemoveArticle = (idToRemove: string) => {
    setRelatedArticles((prev) => {
      const removedItem = prev.find((item) => item._id === idToRemove);
      if (removedItem && removedItem.article) {
        // Gabungkan artikel yang dihapus ke awal availableArticles (tetap unik)
        setAvailableArticles((prevArticles) => {
          const combined = [
            removedItem.article as ArticleListResponse,
            ...prevArticles,
          ];
          const seen = new Set<string | undefined>();
          return combined.filter((article) => {
            if (!article._id) return false;
            if (seen.has(article._id)) return false;
            seen.add(article._id);
            return true;
          });
        });
      }
      return prev.filter((item) => item._id !== idToRemove);
    });
  };

  // --- Drag and Drop Handler ---
  /**
   * Handle reordering artikel terkait menggunakan dnd-kit
   */
  const handleDragEnd = (event: any) => {
    if (event.canceled) return;
    const { source } = event.operation;
    if (isSortable(source)) {
      const { initialIndex, index } = source.sortable;
      if (initialIndex !== index) {
        setRelatedArticles((items) => {
          const newItems = [...items];
          const [movedItem] = newItems.splice(initialIndex, 1);
          newItems.splice(index, 0, movedItem);
          return newItems;
        });
      }
    }
  };

  // --- Save Handler ---
  /**
   * POST artikel terkait ke backend dengan endpoint spesifik artikel
   */
  const handleSave = async () => {
    if (!idOrSlug) {
      toast.error("ID artikel tidak ditemukan");
      return;
    }

    if (relatedArticles.length === 0) {
      toast.error("Pilih minimal 1 artikel untuk Artikel Terkait");
      return;
    }

    try {
      // Prepare payload sesuai backend: { related: RelatedArticle[] }
      const payload = {
        related: relatedArticles.map((item, idx) => ({
          article_id: item.article_id,
          order: idx,
          createdBy: item.createdBy || "local",
        })),
      };

      toast.info("Menyimpan perubahan...");

      // PATCH ke endpoint articles/{idOrSlug}/related
      const response = await api.patch(
        `/articles/${encodeURIComponent(idOrSlug)}/related`,
        payload,
      );

      // Update state dengan response dari server (array SectionArticleItem)
      setRelatedArticles(response.data?.data || []);

      toast.success("Artikel Terkait berhasil disimpan!");
    } catch (error) {
      console.error("Error saving related articles:", error);
      toast.error("Gagal menyimpan Artikel Terkait");
    }
  };

  return (
    <SelectAndSort
      selectedArticles={relatedArticles}
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
      loadingSelected={loadingRelated}
      title="Artikel Terkait"
    />
  );
};

export default RelatedArticlesPage;
