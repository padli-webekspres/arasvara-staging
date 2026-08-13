"use client";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { isSortable } from "@dnd-kit/react/sortable";
import { ArticleListResponse } from "@/types/article";
import SelectAndSort from "@/components/admin/articles/SelectAndSort";
import api from "@/lib/axios";
import { SectionArticleItem } from "@/types/articleSection";
import { useSectionArticleSearch } from "@/hooks/useSectionArticleSearch";

const EditorChoicePage = () => {
  const [editorChoices, setEditorChoices] = useState<SectionArticleItem[]>([]);
  const [loadingEditorChoices, setLoadingEditorChoices] = useState(true);

  const {
    availableArticles,
    searchQuery,
    setSearchQuery,
    loading,
    hasMore,
    handleLoadMore,
    excludeFromAvailable,
    prependToAvailable,
  } = useSectionArticleSearch(editorChoices, {
    enabled: !loadingEditorChoices,
  });

  useEffect(() => {
    const fetchExistingEditorChoices = async () => {
      try {
        setLoadingEditorChoices(true);
        const response = await api.get("/articles/editor-choice");
        const { data } = response.data;
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

  const handleAddArticle = (article: ArticleListResponse) => {
    const isAlreadyAdded = editorChoices.some(
      (item) => item.article?._id === article._id,
    );
    if (isAlreadyAdded) return toast.error("Sudah ada di Pilihan Editor!");

    setEditorChoices((prev) => [
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

    excludeFromAvailable(article._id!);
    toast.success("Artikel ditambahkan");
  };

  const handleRemoveArticle = (idToRemove: string) => {
    setEditorChoices((prev) => {
      const removed = prev.find((item) => item._id === idToRemove);
      if (removed?.article) {
        prependToAvailable(removed.article as ArticleListResponse);
      }
      return prev.filter((item) => item._id !== idToRemove);
    });
  };

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
      const payload = {
        articles: editorChoices.map((editorChoice) => ({
          article_id: editorChoice.article_id,
        })),
      };

      toast.info("Menyimpan perubahan...");

      const response = await api.post("/articles/editor-choice", payload);
      setEditorChoices(response.data.data || []);

      toast.success("Pilihan Editor berhasil disimpan!");
    } catch (error) {
      console.error("Error saving editor choices:", error);
      toast.error("Gagal menyimpan Pilihan Editor");
    }
  };

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
