"use client";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { isSortable } from "@dnd-kit/react/sortable";
import { ArticleListResponse } from "@/types/article";
import SelectAndSort from "@/components/admin/articles/SelectAndSort";
import api from "@/lib/axios";
import { SectionArticleItem } from "@/types/articleSection";
import { useSectionArticleSearch } from "@/hooks/useSectionArticleSearch";

interface EditorChoicePageProps {}

const CarouselSectionPage = ({}: EditorChoicePageProps) => {
  // State untuk carousel section
  const [carouselSection, setCarouselSection] = useState<SectionArticleItem[]>(
    [],
  );
  const [loadingCarouselSection, setLoadingCarouselSection] = useState(true);

  const {
    availableArticles,
    searchQuery,
    setSearchQuery,
    loading,
    hasMore,
    handleLoadMore,
    excludeFromAvailable,
    prependToAvailable,
  } = useSectionArticleSearch(carouselSection, {
    enabled: !loadingCarouselSection,
  });

  // Fetch existing carousel section saat mount
  useEffect(() => {
    const fetchExistingCarouselSection = async () => {
      try {
        setLoadingCarouselSection(true);
        const response = await api.get("/articles/carousel-section");
        const { data } = response.data;
        setCarouselSection(data || []);
        toast.success("Carousel Section berhasil dimuat");
      } catch (error) {
        console.error("Error fetching carousel section:", error);
        toast.error("Gagal memuat Carousel Section");
      } finally {
        setLoadingCarouselSection(false);
      }
    };

    fetchExistingCarouselSection();
  }, []);

  // Handler: tambah artikel ke carouselSection, lalu hilangkan dari availableArticles
  const handleAddArticle = (article: ArticleListResponse) => {
    const isAlreadyAdded = carouselSection.some(
      (item) => item.article?._id === article._id,
    );
    if (isAlreadyAdded) return toast.error("Sudah ada di Carousel Section!");

    // Buat SectionArticleItem minimal agar tidak error (order, createdAt, createdBy dummy)
    setCarouselSection((prev) => [
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

    excludeFromAvailable(article._id!);

    toast.success("Artikel ditambahkan ke Carousel Section");
  };

  // Handler: hapus artikel dari carouselSection, lalu munculkan lagi di availableArticles
  const handleRemoveArticle = (idToRemove: string) => {
    setCarouselSection((prev) => {
      const removed = prev.find((item) => item._id === idToRemove);
      if (removed?.article) {
        prependToAvailable(removed.article as ArticleListResponse);
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
        setCarouselSection((items) => {
          const newItems = [...items];
          const [movedItem] = newItems.splice(initialIndex, 1);
          newItems.splice(index, 0, movedItem);
          return newItems;
        });
      }
    }
  };

  const handleSave = async () => {
    if (carouselSection.length === 0) {
      toast.error("Pilih minimal 1 artikel untuk Carousel Section");
      return;
    }

    try {
      // Prepare payload dengan article_id dan maintain order dari dnd-kit
      const payload = {
        articles: carouselSection.map((item) => ({
          article_id: item.article_id,
        })),
      };

      toast.info("Menyimpan perubahan...");

      // POST ke backend
      const response = await api.post("/articles/carousel-section", payload);

      // Update state dengan response dari server
      setCarouselSection(response.data.data || []);

      toast.success("Carousel Section berhasil disimpan!");
    } catch (error) {
      console.error("Error saving carousel section:", error);
      toast.error("Gagal menyimpan Carousel Section");
    }
  };

  return (
    <SelectAndSort
      selectedArticles={carouselSection}
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
      loadingSelected={loadingCarouselSection}
      title="Carousel Section"
    />
  );
};

export default CarouselSectionPage;
