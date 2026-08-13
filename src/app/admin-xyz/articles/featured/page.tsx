"use client";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { isSortable } from "@dnd-kit/react/sortable";
import { ArticleListResponse } from "@/types/article";
import SelectAndSort from "@/components/admin/articles/SelectAndSort";
import api from "@/lib/axios";
import { SectionArticleItem } from "@/types/articleSection";
import { useSectionArticleSearch } from "@/hooks/useSectionArticleSearch";

const GridSectionPage = () => {
  const [gridSection, setGridSection] = useState<SectionArticleItem[]>([]);
  const [loadingGridSection, setLoadingGridSection] = useState(true);

  const {
    availableArticles,
    searchQuery,
    setSearchQuery,
    loading,
    hasMore,
    handleLoadMore,
    excludeFromAvailable,
    prependToAvailable,
  } = useSectionArticleSearch(gridSection, {
    enabled: !loadingGridSection,
  });

  useEffect(() => {
    const fetchExistingGridSection = async () => {
      try {
        setLoadingGridSection(true);
        const response = await api.get("/articles/grid-section");
        const { data } = response.data;
        setGridSection(data || []);
        toast.success("Grid Section berhasil dimuat");
      } catch (error) {
        console.error("Error fetching grid section:", error);
        toast.error("Gagal memuat Grid Section");
      } finally {
        setLoadingGridSection(false);
      }
    };

    fetchExistingGridSection();
  }, []);

  const handleAddArticle = (article: ArticleListResponse) => {
    const isAlreadyAdded = gridSection.some(
      (item) => item.article?._id === article._id,
    );
    if (isAlreadyAdded) return toast.error("Sudah ada di Grid Section!");

    setGridSection((prev) => [
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
    toast.success("Artikel ditambahkan ke Grid Section");
  };

  const handleRemoveArticle = (idToRemove: string) => {
    setGridSection((prev) => {
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
        setGridSection((items) => {
          const newItems = [...items];
          const [movedItem] = newItems.splice(initialIndex, 1);
          newItems.splice(index, 0, movedItem);
          return newItems;
        });
      }
    }
  };

  const handleSave = async () => {
    if (gridSection.length === 0) {
      toast.error("Pilih minimal 1 artikel untuk Grid Section");
      return;
    }

    try {
      const payload = {
        articles: gridSection.map((item) => ({
          article_id: item.article_id,
        })),
      };

      toast.info("Menyimpan perubahan...");

      const response = await api.post("/articles/grid-section", payload);
      setGridSection(response.data.data || []);

      toast.success("Grid Section berhasil disimpan!");
    } catch (error) {
      console.error("Error saving grid section:", error);
      toast.error("Gagal menyimpan Grid Section");
    }
  };

  return (
    <SelectAndSort
      selectedArticles={gridSection}
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
      loadingSelected={loadingGridSection}
      title="Grid Section"
      limit={5}
    />
  );
};

export default GridSectionPage;
