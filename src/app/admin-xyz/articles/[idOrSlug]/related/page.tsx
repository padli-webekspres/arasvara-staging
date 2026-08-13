"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { isSortable } from "@dnd-kit/react/sortable";
import { ArticleListResponse } from "@/types/article";
import SelectAndSort from "@/components/admin/articles/SelectAndSort";
import api from "@/lib/axios";
import { SectionArticleItem } from "@/types/articleSection";
import { useSectionArticleSearch } from "@/hooks/useSectionArticleSearch";

const RelatedArticlesPage = () => {
  const params = useParams() as { idOrSlug: string };
  const { idOrSlug } = params;

  const [relatedArticles, setRelatedArticles] = useState<SectionArticleItem[]>(
    [],
  );
  const [loadingRelated, setLoadingRelated] = useState(true);

  const {
    availableArticles,
    searchQuery,
    setSearchQuery,
    loading,
    hasMore,
    handleLoadMore,
    excludeFromAvailable,
    prependToAvailable,
  } = useSectionArticleSearch(relatedArticles, {
    enabled: !loadingRelated,
    resetKey: idOrSlug,
  });

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

  const handleAddArticle = (article: ArticleListResponse) => {
    const isAlreadyAdded = relatedArticles.some(
      (item) => item.article?._id === article._id,
    );
    if (isAlreadyAdded) {
      return toast.error("Sudah ada di Artikel Terkait!");
    }

    setRelatedArticles((prev) => [
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
    setRelatedArticles((prev) => {
      const removedItem = prev.find((item) => item._id === idToRemove);
      if (removedItem?.article) {
        prependToAvailable(removedItem.article as ArticleListResponse);
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
        setRelatedArticles((items) => {
          const newItems = [...items];
          const [movedItem] = newItems.splice(initialIndex, 1);
          newItems.splice(index, 0, movedItem);
          return newItems;
        });
      }
    }
  };

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
      const payload = {
        related: relatedArticles.map((item, idx) => ({
          article_id: item.article_id,
          order: idx,
          createdBy: item.createdBy || "local",
        })),
      };

      toast.info("Menyimpan perubahan...");

      const response = await api.patch(
        `/articles/${encodeURIComponent(idOrSlug)}/related`,
        payload,
      );

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
