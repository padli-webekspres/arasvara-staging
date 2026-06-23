"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Field, FieldGroup } from "@/components/ui/field";
import { Controller, useForm } from "react-hook-form";
import { fetcher } from "@/lib/fetcher";
import api from "@/lib/axios";
import type { Category } from "@/types/category";
import NewsCard from "@/components/news/NewsCard";
import ArticlesBySelectedTopicsPanel from "./ArticlesBySelectedTopicsPanel";
import { PopulatedTopic } from "@/types/general";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type PendingMap = Record<string, ReturnType<typeof setTimeout>>;

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

const SelectedTopicsPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [topics, setTopics] = useState<PopulatedTopic[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * pendingAdd  – categoryId => timeout yang akan POST ke backend
   * pendingRemove – topicId   => timeout yang akan DELETE ke backend
   */
  const pendingAdd = useRef<PendingMap>({});
  const pendingRemove = useRef<PendingMap>({});

  // force re-render ketika ref berubah
  const [, forceRender] = useState(0);
  const refresh = useCallback(() => forceRender((n) => n + 1), []);

  const form = useForm({ defaultValues: { search: "" } });
  const search = form.watch("search");

  // ── Initial fetch ──────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetcher<{ categories: Category[] }>("/categories?limit=1000"),
      fetcher<{ data: PopulatedTopic[] }>("/selected-topics"),
    ])
      .then(([catRes, topicRes]) => {
        setCategories(catRes?.categories ?? []);
        setTopics(topicRes?.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Derived state ──────────────────────────────────────────────────────────

  /** Set category id yang sudah dipilih (termasuk yang masih optimistic) */
  const selectedCategoryIds = useMemo(
    () => new Set(topics.map((t) => String(t.category?._id ?? t.categoryId))),
    [topics],
  );

  /** Kategori yang belum dipilih, difilter oleh search */
  const availableCategories = useMemo(() => {
    const lower = search.toLowerCase();
    return categories.filter(
      (cat) =>
        !selectedCategoryIds.has(String(cat._id)) &&
        (lower === "" || cat.name.toLowerCase().includes(lower)),
    );
  }, [categories, search, selectedCategoryIds]);

  // ── Add topic (optimistic) ─────────────────────────────────────────────────

  const handleAdd = useCallback(
    (cat: Category) => {
      const catId = String(cat._id);
      const tempId = `optimistic-${catId}`;

      // 1. Optimistic UI: langsung tambah ke daftar topik
      setTopics((prev) => [
        ...prev,
        {
          _id: tempId,
          categoryId: catId,
          selectedBy: "",
          category: cat,
          optimistic: true,
        },
      ]);

      // 2. Jadwalkan POST ke backend setelah 2 detik
      pendingAdd.current[catId] = setTimeout(async () => {
        delete pendingAdd.current[catId];
        refresh();
        try {
          const res = await api.post<{ data: PopulatedTopic }>(
            "/selected-topics",
            { categoryId: catId },
          );
          // Ganti optimistic item dengan data real dari backend
          setTopics((prev) =>
            prev.map((t) => (t._id === tempId ? res.data.data : t)),
          );
        } catch {
          // Rollback jika gagal
          setTopics((prev) => prev.filter((t) => t._id !== tempId));
        }
      }, 2000);

      refresh();
    },
    [refresh],
  );

  /** Undo tambah: batalkan sebelum timer habis */
  const handleUndoAdd = useCallback(
    (cat: Category) => {
      const catId = String(cat._id);
      clearTimeout(pendingAdd.current[catId]);
      delete pendingAdd.current[catId];
      setTopics((prev) => prev.filter((t) => t._id !== `optimistic-${catId}`));
      refresh();
    },
    [refresh],
  );

  // ── Remove topic (optimistic) ──────────────────────────────────────────────

  const handleRemove = useCallback(
    (topic: PopulatedTopic) => {
      // Jika masih optimistic (belum sempat dikirim), cukup batalkan add
      if (topic.optimistic) {
        handleUndoAdd(topic.category);
        return;
      }

      // 1. Optimistic UI: langsung hapus dari daftar
      setTopics((prev) => prev.filter((t) => t._id !== topic._id));

      // 2. Jadwalkan DELETE ke backend setelah 2 detik
      pendingRemove.current[topic._id] = setTimeout(async () => {
        delete pendingRemove.current[topic._id];
        refresh();
        try {
          await api.delete(`/selected-topics/${topic._id}`);
        } catch {
          // Rollback jika gagal
          setTopics((prev) => [...prev, topic]);
        }
      }, 2000);

      refresh();
    },
    [handleUndoAdd, refresh],
  );

  /** Undo hapus: batalkan sebelum timer habis */
  const handleUndoRemove = useCallback(
    (topic: PopulatedTopic) => {
      clearTimeout(pendingRemove.current[topic._id]);
      delete pendingRemove.current[topic._id];
      setTopics((prev) => [...prev, topic]);
      refresh();
    },
    [refresh],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Selected Topics</h1>
          <p className="text-muted-foreground">
            Manage all your selected topics
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* ── Panel Kiri: Pilih Minat ── */}
        <div className="bg-card rounded-lg border border-border p-4 space-y-4">
          {/* Cari minat */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Cari minat anda</h3>
            <FieldGroup>
              <Controller
                name="search"
                control={form.control}
                render={({ field }) => (
                  <Field className="w-full">
                    <Input
                      {...field}
                      placeholder="Cari kategori..."
                      className="w-full"
                    />
                  </Field>
                )}
              />
            </FieldGroup>

            <div className="flex flex-row gap-2 mt-3 flex-wrap">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : availableCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {search ? "Tidak ditemukan" : "Semua kategori sudah dipilih"}
                </p>
              ) : (
                availableCategories.map((cat) => (
                  <Button
                    key={String(cat._id)}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => handleAdd(cat)}
                  >
                    <span>{cat.name}</span>
                    <Plus className="h-3 w-3" />
                  </Button>
                ))
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Topik yang diminati */}
          <div>
            <h3 className="text-lg font-semibold mb-2">
              Topik yang anda minati
            </h3>
            <div className="flex flex-row gap-2 flex-wrap">
              {topics.length === 0 && !loading ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada topik yang dipilih
                </p>
              ) : (
                topics.map((topic) => {
                  const isPendingRemove = !!pendingRemove.current[topic._id];
                  const isPendingAdd = topic.optimistic;

                  return (
                    <div key={topic._id} className="flex items-center gap-1">
                      <Button
                        variant={isPendingAdd ? "secondary" : "default"}
                        size="sm"
                        className="flex items-center gap-2"
                        onClick={() => handleRemove(topic)}
                      >
                        <span>{topic.category?.name}</span>
                        <Minus className="h-3 w-3" />
                      </Button>

                      {/* Undo add – masih dalam 2 detik sebelum POST */}
                      {isPendingAdd && (
                        <button
                          className="text-xs text-muted-foreground underline hover:text-foreground"
                          onClick={() => handleUndoAdd(topic.category)}
                        >
                          Undo
                        </button>
                      )}

                      {/* Undo remove – masih dalam 2 detik sebelum DELETE */}
                      {isPendingRemove && (
                        <button
                          className="text-xs text-muted-foreground underline hover:text-foreground"
                          onClick={() => handleUndoRemove(topic)}
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Panel Kanan: Artikel Terkait ── */}
        <ArticlesBySelectedTopicsPanel topics={topics} />
      </div>
    </div>
  );
};

export default SelectedTopicsPage;
