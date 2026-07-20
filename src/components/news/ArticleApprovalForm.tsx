"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Form,
} from "@/components/ui/form";
import { Article, ArticleStatus, STATUS_ROLE_MAP } from "@/types/article";
import api from "@/lib/axios";
import { toast } from "sonner";
import { adminPanelHref } from "@/lib/admin-panel-path";
import { canPickArticleAttribution } from "@/lib/editorialPublicationAccess";
import type { AttributionUserOption } from "@/components/admin/articles/ArticleEditorFormUi";
import SearchableSelect from "@/components/ui/SearchableSelect";
import type { option } from "@/types/general";
import {
  formatDatetimeLocalFromUtc,
  parseDatetimeLocalAsWib,
  roundDatetimeLocalTo5Minutes,
} from "@/lib/datetime-jakarta";

// ─── Zod Schema ────────────────────────────────────────────────────────────

const ArticleApprovalSchema = z
  .object({
    status: z.nativeEnum(ArticleStatus).describe("Status tidak valid"),
    scheduledAt: z.string().optional().nullable(),
    reason: z
      .string()
      .max(500, "Alasan tidak boleh lebih dari 500 karakter")
      .optional()
      .nullable(),
    authorId: z.string().optional(),
    editorId: z.string().optional(),
    contributorIds: z.array(z.string()).optional(),
  })
  .refine(
    (data) => {
      // Jika status SCHEDULED, scheduledAt harus ada dan valid sebagai wall-clock WIB
      if (data.status === ArticleStatus.SCHEDULED) {
        if (!data.scheduledAt || data.scheduledAt.trim() === "") {
          return false;
        }
        return parseDatetimeLocalAsWib(data.scheduledAt) != null;
      }
      return true;
    },
    {
      message:
        "Tanggal jadwal tidak valid atau tidak boleh kosong untuk status SCHEDULED",
      path: ["scheduledAt"],
    },
  );

type ArticleApprovalFormData = z.infer<typeof ArticleApprovalSchema>;

// ─── Component Props ────────────────────────────────────────────────────────

interface ArticleApprovalFormProps {
  article: Article;
  userRole: string;
  onSuccess?: () => void;
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function ArticleApprovalForm({
  article,
  userRole,
  onSuccess,
}: ArticleApprovalFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attributionLoading, setAttributionLoading] = useState(false);
  const [attributionAuthors, setAttributionAuthors] = useState<
    AttributionUserOption[]
  >([]);
  const [attributionEditors, setAttributionEditors] = useState<
    AttributionUserOption[]
  >([]);

  const canPick = canPickArticleAttribution(userRole);

  // Filter allowed statuses berdasarkan user role dari STATUS_ROLE_MAP
  // filter hilangkan taken_down
  const allowedStatuses = (
    Object.entries(STATUS_ROLE_MAP) as [ArticleStatus, string[]][]
  )

    .filter(
      ([status, roles]) =>
        roles.includes(userRole.toLowerCase()) &&
        status !== ArticleStatus.TAKEN_DOWN &&
        status !== ArticleStatus.DRAFT,
    )
    .map(([status]) => status);

  // Default values (useMemo agar referensinya stabil)
  const defaultValues = useMemo<ArticleApprovalFormData>(
    () => ({
      status: article.status || ArticleStatus.DRAFT,
      scheduledAt:
        article.scheduledAt && article.status === ArticleStatus.SCHEDULED
          ? formatDatetimeLocalFromUtc(article.scheduledAt)
          : "",
      reason: undefined,
      authorId: article.authorId ?? "",
      editorId: article.editorId ?? "",
      contributorIds: Array.isArray(article.contributorIds)
        ? article.contributorIds
        : [],
    }),
    [
      article.status,
      article.scheduledAt,
      article.authorId,
      article.editorId,
      article.contributorIds,
    ],
  );

  const form = useForm<ArticleApprovalFormData>({
    resolver: zodResolver(ArticleApprovalSchema),
    defaultValues,
    mode: "onChange",
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  useEffect(() => {
    if (!canPick) return;
    let cancelled = false;
    void (async () => {
      setAttributionLoading(true);
      try {
        const res = await api.get<{ users: Record<string, unknown>[] }>(
          "/users/author?limit=200",
          { withCredentials: true },
        );
        const res2 = await api.get<{ users: Record<string, unknown>[] }>(
          "/users?limit=200",
          { withCredentials: true },
        );
        if (cancelled) return;
        const mapRow = (u: Record<string, unknown>): AttributionUserOption => ({
          _id: String(u._id ?? ""),
          name: String(u.name ?? ""),
          email: String(u.email ?? ""),
          role: String(u.role ?? "").toLowerCase(),
        });
        const authors = (res.data.users ?? []).map(mapRow);
        const editorialRoles = new Set([
          "admin",
          "editor-in-chief",
          "managing-editor",
          "head-of",
          "editor",
        ]);
        const editors = (res2.data.users ?? [])
          .map(mapRow)
          .filter((u) => editorialRoles.has(u.role));
        setAttributionAuthors(authors);
        setAttributionEditors(editors);
      } catch {
        if (!cancelled) toast.error("Gagal memuat daftar pengguna atribusi");
      } finally {
        if (!cancelled) setAttributionLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canPick]);

  const formatUserLabel = (u: AttributionUserOption) => u.name || u.email;

  const authorApprovalOptions = useMemo<option[]>(
    () => [
      {
        id: "none",
        value: "__none__",
        label: "Default (penulis di dokumen / penyimpan)",
      },
      ...attributionAuthors.map((u) => ({
        id: u._id,
        value: u._id,
        label: formatUserLabel(u),
      })),
    ],
    [attributionAuthors],
  );

  const editorApprovalOptions = useMemo<option[]>(
    () => [
      { id: "none", value: "__none__", label: "Tidak ada" },
      ...attributionEditors.map((u) => ({
        id: u._id,
        value: u._id,
        label: formatUserLabel(u),
      })),
    ],
    [attributionEditors],
  );

  const contributorApprovalOptions = useMemo<option[]>(
    () =>
      attributionAuthors.map((u) => ({
        id: u._id,
        value: u._id,
        label: formatUserLabel(u),
      })),
    [attributionAuthors],
  );

  const selectedStatus = form.watch("status");
  const showScheduledInput = selectedStatus === ArticleStatus.SCHEDULED;

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleScheduledAtChange = useCallback(
    (value: string) => {
      if (!value) {
        form.setValue("scheduledAt", "");
        return;
      }
      const rounded = roundDatetimeLocalTo5Minutes(value);
      form.setValue("scheduledAt", rounded);
    },
    [form],
  );

  const onSubmit = useCallback(
    async (data: ArticleApprovalFormData) => {
      if (!article._id) {
        toast.error("Article ID tidak ditemukan");
        return;
      }

      // Validate user is allowed for this status
      if (!allowedStatuses.includes(data.status)) {
        toast.error("Anda tidak memiliki izin untuk status ini");
        return;
      }

      setIsSubmitting(true);

      try {
        // datetime-local = wall-clock WIB → kirim ISO UTC ke API
        let scheduledAtIso: string | null = null;
        if (
          data.status === ArticleStatus.SCHEDULED &&
          data.scheduledAt?.trim()
        ) {
          const parsed = parseDatetimeLocalAsWib(data.scheduledAt, {
            roundTo5Minutes: true,
          });
          if (!parsed) {
            toast.error("Tanggal jadwal tidak valid");
            setIsSubmitting(false);
            return;
          }
          scheduledAtIso = parsed.toISOString();
        }

        const payload: Record<string, unknown> = {
          status: data.status,
          scheduledAt: scheduledAtIso,
          reason: data.reason || undefined,
        };

        if (canPick) {
          const aid = (data.authorId ?? "").trim();
          if (aid && /^[a-f\d]{24}$/i.test(aid)) {
            payload.authorId = aid;
          }
          const eid = (data.editorId ?? "").trim();
          payload.editorId = eid && /^[a-f\d]{24}$/i.test(eid) ? eid : null;
          payload.contributorIds = [
            ...new Set((data.contributorIds ?? []).filter(Boolean)),
          ];
        }

        // Send to API
        await api.patch(`/articles/${article._id}/approval`, payload, {
          withCredentials: true,
        });

        toast.success("Status artikel berhasil diubah");

        // Redirect to approval list page
        router.push(adminPanelHref("articles/approval"));

        // Optionally, still trigger callback if needed
        if (onSuccess) {
          onSuccess();
        }

        // Reset form
        form.reset(defaultValues);
      } catch (error: any) {
        const errorMessage =
          error?.response?.data?.error ||
          error?.message ||
          "Gagal mengubah status artikel";
        toast.error(errorMessage);
        console.error("Error submitting approval:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      article._id,
      allowedStatuses,
      onSuccess,
      form,
      defaultValues,
      router,
      canPick,
    ],
  );

  // Early return jika user tidak punya akses ke approval
  if (allowedStatuses.length === 0) {
    return null;
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-6">
      <div className="flex md:justify-between items-start md:items-center flex-col md:flex-row gap-2">
        <div className="w-full md:w-auto">
          <h2 className="text-xl font-bold text-foreground">Approval</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Ubah status artikel dan atur jadwal publikasi
          </p>
        </div>
        <div className="flex md:justify-end items-center gap-4 w-full md:w-auto">
          <Button
            className="w-auto min-w-fit"
            variant="outline"
            onClick={() =>
              router.push(adminPanelHref(`articles/${article._id}`))
            }
          >
            Edit Artikel
          </Button>
          <Button
            className=""
            onClick={() =>
              router.push(adminPanelHref(`articles/${article._id}/related`))
            }
          >
            Tambah Artikel Terkait
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="gap-4 grid grid-cols-1 lg:grid-cols-2 lg:gap-8"
        >
          {canPick && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4 w-full">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Atribusi artikel
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Sama seperti di editor: penulis, editor, dan kontributor.
                </p>
              </div>
              {attributionLoading ? (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  Memuat daftar pengguna…
                </p>
              ) : (
                <>
                  <FormField
                    control={form.control}
                    name="authorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Penulis</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            options={authorApprovalOptions}
                            value={
                              field.value?.trim() ? field.value : "__none__"
                            }
                            onChange={(v) =>
                              field.onChange(
                                typeof v === "string" && v !== "__none__"
                                  ? v
                                  : "",
                              )
                            }
                            placeholder="Penanggung jawab teks"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Kosongkan default hanya jika ingin mengandalkan ID
                          penulis yang sudah tersimpan tanpa mengubah ke
                          pengguna lain.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="editorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Editor</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            options={editorApprovalOptions}
                            value={
                              field.value?.trim() ? field.value : "__none__"
                            }
                            onChange={(v) =>
                              field.onChange(
                                typeof v === "string" && v !== "__none__"
                                  ? v
                                  : "",
                              )
                            }
                            placeholder="Opsional"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contributorIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kontributor</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            options={contributorApprovalOptions}
                            value={field.value ?? []}
                            onChange={(v) =>
                              field.onChange(Array.isArray(v) ? v : [])
                            }
                            placeholder="Pilih kontributor…"
                            isMulti
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>
          )}

          <div className="flex flex-col gap-4 w-full">
            {/* Status Field */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {allowedStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Scheduled At Field - Conditional */}
            {showScheduledInput && (
              <FormField
                control={form.control}
                name="scheduledAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Jadwal Publikasi
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        step="300" // 5 minutes
                        value={field.value || ""}
                        onChange={(e) => {
                          handleScheduledAtChange(e.target.value);
                          field.onChange(e);
                        }}
                        onBlur={field.onBlur}
                        className="w-full"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-2">
                      Waktu publikasi hanya bisa kelipatan 5 menit (misal:
                      10:00, 10:05, dst)
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Reason Field */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    Alasan{" "}
                    <span className="text-muted-foreground">(Opsional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tambahkan alasan atau catatan untuk perubahan status ini..."
                      value={field.value || ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      rows={3}
                      maxLength={500}
                      className="w-full resize-none"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {field.value?.length || 0}/500 karakter
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="lg:col-span-2"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Ubah Status
              </>
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
