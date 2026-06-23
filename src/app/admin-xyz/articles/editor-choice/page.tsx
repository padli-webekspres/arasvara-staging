"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { isSortable } from "@dnd-kit/react/sortable";
import { Article, ArticleStatus, ArticleListResponse } from "@/types/article";
import { Category } from "@/types/category";
import { Media } from "@/types/media";
import { UserProfile } from "@/types/user";
import SelectAndSort from "@/components/admin/articles/SelectAndSort";
import api from "@/lib/axios";
import { SectionArticleItem } from "@/types/articleSection";

interface EditorChoicePageProps {}

const EditorChoicePage = ({}: EditorChoicePageProps) => {
  // State untuk editor choices
  const [editorChoices, setEditorChoices] = useState<SectionArticleItem[]>([]);
  const [loadingEditorChoices, setLoadingEditorChoices] = useState(true);

  // State untuk search dan infinite scroll
  // List artikel yang bisa dipilih (tidak termasuk yang sudah di editorChoices)
  // List artikel yang bisa dipilih (tidak termasuk yang sudah di editorChoices)
  const [availableArticles, setAvailableArticles] = useState<
    ArticleListResponse[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch existing editor choices saat mount
  useEffect(() => {
    const fetchExistingEditorChoices = async () => {
      try {
        setLoadingEditorChoices(true);
        const response = await api.get("/articles/editor-choice");
        const { data } = response.data;
        console.log("Fetched editor choices:", data);
        setEditorChoices(data || []);
        toast.success("Pilihan Editor berhasil dimuat");
      } catch (error) {
        console.error("Error fetching editor choices:", error);
        toast.error("Gagal memuat Pilihan Editor");
      } finally {
        setLoadingEditorChoices(false);
      }
    };

    fetchExistingEditorChoices();
  }, []);

  // Fungsi untuk fetch artikel dari API
  // Fetch artikel dari API, lalu filter agar tidak tampil jika sudah ada di editorChoices
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

        // Filter: hilangkan artikel yang sudah ada di editorChoices
        const filteredArticles = articles.filter(
          (a: ArticleListResponse) =>
            !editorChoices.some((e) => e.article?._id === a._id),
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
    [editorChoices],
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
  // Handler: tambah artikel ke editorChoices, lalu hilangkan dari availableArticles
  const handleAddArticle = (article: ArticleListResponse) => {
    const isAlreadyAdded = editorChoices.some(
      (item) => item.article?._id === article._id,
    );
    if (isAlreadyAdded) return toast.error("Sudah ada di Pilihan Editor!");

    // Buat EditorChoice minimal agar tidak error (order, createdAt, createdBy dummy)
    setEditorChoices((prev) => [
      ...prev,
      {
        _id: article._id || Math.random().toString(),
        article_id: article._id || "", // fallback jika _id undefined
        article,
        order: prev.length,
        createdAt: new Date(),
        createdBy: "local",
      },
    ]);

    // Hilangkan dari availableArticles
    setAvailableArticles((prev) => prev.filter((a) => a._id !== article._id));

    toast.success("Artikel ditambahkan");
  };

  // Handler: hapus artikel dari editorChoices, lalu munculkan lagi di availableArticles
  const handleRemoveArticle = (idToRemove: string) => {
    setEditorChoices((prev) => {
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
        setEditorChoices((items) => {
          const newItems = [...items];
          const [movedItem] = newItems.splice(initialIndex, 1);
          newItems.splice(index, 0, movedItem);
          return newItems;
        });
      }
    }
  };

  const handleSave = async () => {
    if (editorChoices.length === 0) {
      toast.error("Pilih minimal 1 artikel untuk Pilihan Editor");
      return;
    }

    try {
      // Prepare payload dengan article_id dan maintain order dari dnd-kit
      const payload = {
        articles: editorChoices.map((editorChoice) => ({
          article_id: editorChoice.article_id,
        })),
      };

      toast.info("Menyimpan perubahan...");

      // POST ke backend
      const response = await api.post("/articles/editor-choice", payload);

      // Update state dengan response dari server
      setEditorChoices(response.data.data || []);

      toast.success("Pilihan Editor berhasil disimpan!");
      console.log("Editor choices saved:", response.data.data);
    } catch (error) {
      console.error("Error saving editor choices:", error);
      toast.error("Gagal menyimpan Pilihan Editor");
    }
  };

  console.log("Render EditorChoicePage with editorChoices:", editorChoices);

  return (
    <SelectAndSort
      selectedArticles={editorChoices}
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
      loadingSelected={loadingEditorChoices}
      title="Pilihan Editor"
    />
  );
};

export default EditorChoicePage;
