"use client";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { isSortable } from "@dnd-kit/react/sortable";
import { ArticleListResponse } from "@/types/article";
import SelectAndSort from "@/components/admin/articles/SelectAndSort";
import api from "@/lib/axios";
import { SectionArticleItem } from "@/types/articleSection";
import { useSectionArticleSearch } from "@/hooks/useSectionArticleSearch";

const HeadlinePage = () => {
  const [headlines, setHeadlines] = useState<SectionArticleItem[]>([]);
  const [loadingHeadlines, setLoadingHeadlines] = useState(true);

  const {
    availableArticles,
    searchQuery,
    setSearchQuery,
    loading,
    hasMore,
    handleLoadMore,
    excludeFromAvailable,
    prependToAvailable,
  } = useSectionArticleSearch(headlines, {
    enabled: !loadingHeadlines,
  });

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

    excludeFromAvailable(article._id!);
    toast.success("Artikel ditambahkan ke Headline");
  };

  const handleRemoveArticle = (idToRemove: string) => {
    setHeadlines((prev) => {
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
      const payload = {
        articles: headlines.map((headline) => ({
          article_id: headline.article_id,
        })),
      };

      toast.info("Menyimpan perubahan...");

      const response = await api.post("/articles/headline", payload);
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
