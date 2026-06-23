"use client";

import { useEffect, useRef, useState } from "react";
import api from "@/lib/axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import CategoriesForm from "./CategoriesForm";
import type { CategoryParentOption } from "./CategoriesForm";
import {
  categoryFormSchema,
  defaultCategoryFormValues,
  type CategoryFormInput,
  type CategoryFormValues,
} from "./categoryFormSchema";

async function fetchParentOptions(
  excludeCategoryId?: string,
): Promise<CategoryParentOption[]> {
  try {
    const res = await api.get<{ categories: { _id: string; name: string }[] }>("/categories", {
      params: { limit: 1000 },
    });
    const json = res.data;
    if (!Array.isArray(json.categories)) return [];
    const cats = json.categories;
    const filtered = excludeCategoryId
      ? cats.filter((c) => String(c._id) !== String(excludeCategoryId))
      : cats;
    return filtered
      .map((c) => ({ label: c.name, value: String(c._id) }))
      .sort((a, b) => a.label.localeCompare(b.label, "id"));
  } catch {
    return [];
  }
}

export interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  /** Diperlukan jika mode === "edit" */
  categoryId?: string | null;
  /** Dipanggil setelah simpan berhasil (mis. navigasi atau refresh daftar) */
  onSuccess?: () => void;
}

export default function CategoryFormDialog({
  open,
  onOpenChange,
  mode,
  categoryId,
  onSuccess,
}: CategoryFormDialogProps) {
  const [parentOptions, setParentOptions] = useState<CategoryParentOption[]>(
    [],
  );
  const [bootstrap, setBootstrap] = useState(false);
  const initialEditRef = useRef<CategoryFormInput | null>(null);

  const form = useForm<CategoryFormInput, unknown, CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: defaultCategoryFormValues,
  });

  useEffect(() => {
    if (!open) {
      setBootstrap(false);
      initialEditRef.current = null;
      return;
    }

    let cancelled = false;

    async function run() {
      setBootstrap(false);
      if (mode === "create") {
        try {
          const opts = await fetchParentOptions();
          if (cancelled) return;
          setParentOptions(opts);
          form.reset(defaultCategoryFormValues);
          initialEditRef.current = null;
        } catch {
          if (!cancelled) toast.error("Gagal memuat daftar kategori induk.");
        } finally {
          if (!cancelled) setBootstrap(true);
        }
        return;
      }

      if (!categoryId) {
        if (!cancelled) setBootstrap(true);
        return;
      }

      try {
        const [catRes, opts] = await Promise.all([
          api.get(`/categories/${encodeURIComponent(categoryId)}`),
          fetchParentOptions(categoryId),
        ]);
        const catJson = catRes.data;
        if (!catJson) {
          toast.error("Kategori tidak ditemukan.");
          if (!cancelled) onOpenChange(false);
          return;
        }
        if (cancelled) return;
        setParentOptions(opts);
        const values: CategoryFormInput = {
          name: catJson.name ?? "",
          description: catJson.description ?? "",
          parentId: catJson.parentId ? String(catJson.parentId) : "",
          nickname: catJson.nickname ?? "",
        };
        form.reset(values);
        initialEditRef.current = { ...values };
      } catch {
        if (!cancelled) toast.error("Gagal memuat data kategori.");
      } finally {
        if (!cancelled) setBootstrap(true);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- form.reset stabil; hindari loop jika deps memuat `form`
  }, [open, mode, categoryId, onOpenChange]);

  const onSubmit = async (data: CategoryFormValues) => {
    try {
      if (mode === "create") {
        await api.post("/categories", {
          name: data.name,
          description: data.description,
          parentId: data.parentId || undefined,
          nickname: data.nickname?.trim() ? data.nickname.trim() : undefined,
        });
        toast.success("Kategori berhasil ditambahkan.");
        onSuccess?.();
        onOpenChange(false);
        return;
      }

      if (!categoryId) return;

      await api.patch(
        `/categories/${encodeURIComponent(categoryId)}`,
        {
          name: data.name,
          description: data.description,
          parentId: data.parentId || undefined,
          nickname: data.nickname?.trim() ? data.nickname.trim() : "",
        },
      );
      toast.success("Kategori berhasil diperbarui.");
      onSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      const message = e?.response?.data?.error || e?.response?.data?.message || e?.message || "Terjadi kesalahan.";
      toast.error(message);
    }
  };

  const handleReset = () => {
    if (mode === "edit" && initialEditRef.current) {
      form.reset(initialEditRef.current);
    } else {
      form.reset(defaultCategoryFormValues);
    }
  };

  const submitting = form.formState.isSubmitting;

  const formId =
    mode === "create" ? "category-dialog-create" : "category-dialog-edit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="lg:max-w-5xl  w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Tambah kategori" : "Ubah kategori"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {mode === "create"
              ? "Isi formulir untuk menambah kategori baru."
              : "Perbarui data kategori."}
          </DialogDescription>
        </DialogHeader>

        {!bootstrap ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <CategoriesForm
            form={form}
            parentOptions={parentOptions}
            submitting={submitting}
            onReset={handleReset}
            onSubmit={onSubmit}
            mode={mode}
            formId={formId}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
