"use client";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { isSortable } from "@dnd-kit/react/sortable";
import { ArticleListResponse } from "@/types/article";
import SelectAndSort from "@/components/admin/articles/SelectAndSort";
import api from "@/lib/axios";
import { SectionArticleItem } from "@/types/articleSection";
import { useSectionArticleSearch } from "@/hooks/useSectionArticleSearch";

const PopularArticlesPage = () => {
  const [popularArticles, setPopularArticles] = useState<SectionArticleItem[]>(
    [],
  );
  const [loadingPopularArticles, setLoadingPopularArticles] = useState(true);

  const {
    availableArticles,
    searchQuery,
    setSearchQuery,
    loading,
    hasMore,
    handleLoadMore,
    excludeFromAvailable,
    prependToAvailable,
  } = useSectionArticleSearch(popularArticles, {
    enabled: !loadingPopularArticles,
  });

  useEffect(() => {
    const fetchExistingPopularArticles = async () => {
      try {
        setLoadingPopularArticles(true);
        const response = await api.get("/articles/popular");
        const { data } = response.data;
        setPopularArticles(data || []);
        toast.success("Artikel Populer berhasil dimuat");
      } catch (error) {
        console.error("Error fetching popular articles:", error);
        toast.error("Gagal memuat Artikel Populer");
      } finally {
        setLoadingPopularArticles(false);
      }
    };
    fetchExistingPopularArticles();
  }, []);

  const handleAddArticle = (article: ArticleListResponse) => {
    const isAlreadyAdded = popularArticles.some(
      (item) => item.article?._id === article._id,
    );
    if (isAlreadyAdded) return toast.error("Sudah ada di Artikel Populer!");

    setPopularArticles((prev) => [
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
    setPopularArticles((prev) => {
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
        setPopularArticles((items) => {
          const newItems = [...items];
          const [movedItem] = newItems.splice(initialIndex, 1);
          newItems.splice(index, 0, movedItem);
          return newItems;
        });
      }
    }
  };

  const handleSave = async () => {
    if (popularArticles.length === 0) {
      toast.error("Pilih minimal 1 artikel untuk Artikel Populer");
      return;
    }

    try {
      const payload = {
        articles: popularArticles.map((item) => ({
          article_id: item.article_id,
        })),
      };

      toast.info("Menyimpan perubahan...");

      const response = await api.post("/articles/popular", payload);
      setPopularArticles(response.data.data || []);

      toast.success("Artikel Populer berhasil disimpan!");
    } catch (error) {
      console.error("Error saving popular articles:", error);
      toast.error("Gagal menyimpan Artikel Populer");
    }
  };

  return (
    <SelectAndSort
      selectedArticles={popularArticles}
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
      loadingSelected={loadingPopularArticles}
      title="Artikel Populer"
    />
  );
};

export default PopularArticlesPage;
