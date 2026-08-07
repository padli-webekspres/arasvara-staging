import { z } from "zod";
import slugify from "slugify";
import { isReservedRootSegment } from "@/lib/article-public-path";

/** Skema formulir kategori (create/edit) — pesan validasi bahasa Indonesia */
export const categoryFormSchema = z
  .object({
    name: z
      .string()
      .min(3, "Nama kategori minimal 3 karakter.")
      .max(32, "Nama kategori maksimal 32 karakter."),
    description: z
      .string()
      .min(10, "Deskripsi minimal 10 karakter.")
      .max(100, "Deskripsi maksimal 100 karakter."),
    parentId: z.string().optional(),
    nickname: z
      .string()
      .max(48, "Nama panggilan maksimal 48 karakter.")
      .optional(),
  })
  .refine(
    (data) => {
      const slug = slugify(data.name || "", { lower: true, strict: true });
      return !isReservedRootSegment(slug);
    },
    {
      message:
        "Nama kategori ini menghasilkan slug terproteksi sistem (misal: search, news, api, dll). Harap gunakan nama lain.",
      path: ["name"],
    },
  );

export type CategoryFormInput = z.input<typeof categoryFormSchema>;
export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export const defaultCategoryFormValues: CategoryFormInput = {
  name: "",
  description: "",
  parentId: "",
  nickname: "",
};
