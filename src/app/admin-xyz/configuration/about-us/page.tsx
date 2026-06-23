"use client";

import React, { useState, useEffect, useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import {
  RotateCcw,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CreateConfigurationPayload,
  Configuration,
} from "@/types/configuration";
import api from "@/lib/axios";

// ── Form validation schemas ───────────────────────────────────────────────
const sectionSchema = z.object({
  title: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  link_button: z.string().optional().or(z.literal("")),
  button_text: z.string().optional().or(z.literal("")),
});

const personSchema = z.object({
  id: z.string(),
  name: z.string().optional().or(z.literal("")),
});

const positionSchema = z.object({
  id: z.string(),
  position: z.string().optional().or(z.literal("")),
  people: z.array(personSchema),
});

const formSchema = z.object({
  about_us_text: z.string().optional().or(z.literal("")),
  address_text: z.string().optional().or(z.literal("")),
  social_instagram_link: z.string().optional().or(z.literal("")),
  social_facebook_link: z.string().optional().or(z.literal("")),
  social_twitter_link: z.string().optional().or(z.literal("")),
  social_threads_link: z.string().optional().or(z.literal("")),
  contact_email: z.string().optional().or(z.literal("")),
  contact_phone: z.string().optional().or(z.literal("")),
  contact_fax: z.string().optional().or(z.literal("")),

  // New Fields validation
  tagline_about_us: z.string().optional().or(z.literal("")),
  sub_tagline_about_us: z.string().optional().or(z.literal("")),
  visi: z.string().optional().or(z.literal("")),
  misi: z.string().optional().or(z.literal("")),
  sections_about_us: z.array(sectionSchema),
  quotes: z.string().optional().or(z.literal("")),
  quotes_owner: z.string().optional().or(z.literal("")),
  title_meet_us: z.string().optional().or(z.literal("")),
  desc_meet_us: z.string().optional().or(z.literal("")),
  link_gmaps: z.string().optional().or(z.literal("")),

  // Editorial Structure validation
  title_redaksi: z.string().optional().or(z.literal("")),
  redaksi_positions: z.array(positionSchema),
});

type FormValues = z.infer<typeof formSchema>;

// ── Section IDs untuk accordion state ────────────────────────────────────
type SectionId =
  | "profile"
  | "visi_misi"
  | "redaksi"
  | "sections_cta"
  | "quotes"
  | "meet_us"
  | "kontak";

// ── Accordion Section Wrapper Component ──────────────────────────────────────
interface AccordionSectionProps {
  id: SectionId;
  title: string;
  openSections: Set<SectionId>;
  onToggle: (id: SectionId) => void;
  children: React.ReactNode;
}

function AccordionSection({
  id,
  title,
  openSections,
  onToggle,
  children,
}: AccordionSectionProps) {
  const isOpen = openSections.has(id);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header / Toggle */}
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between px-5 py-4 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <h2 className="text-base font-bold">{title}</h2>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Collapsible Body */}
      {isOpen && (
        <div className="px-5 py-6 space-y-6 border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Sortable Person Item Component ──────────────────────────────────────────
interface SortablePersonItemProps {
  person: { id: string; name: string };
  index: number;
  onNameChange: (val: string) => void;
  onRemove: () => void;
  isSubmitting: boolean;
}

function SortablePersonItem({
  person,
  index,
  onNameChange,
  onRemove,
  isSubmitting,
}: SortablePersonItemProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: person.id,
    index,
  });

  return (
    <div
      ref={ref}
      className={`flex items-center gap-2 min-w-0 bg-background border border-border/80 rounded-md p-2 transition-all ${
        isDragging ? "opacity-50 z-50 scale-[1.02] shadow-md" : "opacity-100"
      }`}
    >
      <div
        ref={handleRef}
        className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-muted rounded-md text-muted-foreground transition-colors touch-none"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <Input
        value={person.name || ""}
        placeholder="Nama Anggota Redaksi"
        disabled={isSubmitting}
        onChange={(e) => onNameChange(e.target.value)}
        className="flex-1 min-w-0"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
        disabled={isSubmitting}
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ── Sortable Position Item Component ─────────────────────────────────────────
interface SortablePositionItemProps {
  positionItem: {
    id: string;
    position: string;
    people: { id: string; name: string }[];
  };
  index: number;
  onPositionChange: (val: string) => void;
  onPeopleChange: (people: { id: string; name: string }[]) => void;
  onRemove: () => void;
  isSubmitting: boolean;
}

function SortablePositionItem({
  positionItem,
  index,
  onPositionChange,
  onPeopleChange,
  onRemove,
  isSubmitting,
}: SortablePositionItemProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: positionItem.id,
    index,
  });

  const handleDragEndPeople = (event: any) => {
    const { operation } = event;
    if (!operation) return;
    const { from, to } = operation;
    if (from !== to) {
      const newPeople = [...positionItem.people];
      const [moved] = newPeople.splice(from, 1);
      newPeople.splice(to, 0, moved);
      onPeopleChange(newPeople);
    }
  };

  return (
    <div
      ref={ref}
      className={`bg-muted/10 border border-border rounded-lg p-5 space-y-4 relative transition-all min-w-0 ${
        isDragging ? "opacity-50 z-40 scale-[1.01] shadow-lg" : "opacity-100"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-2 gap-4 min-w-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            ref={handleRef}
            className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-muted rounded-md text-muted-foreground transition-colors touch-none"
          >
            <GripVertical className="h-5 w-5" />
          </div>
          <Input
            value={positionItem.position || ""}
            placeholder="Nama Jabatan / Posisi (e.g. Pemimpin Redaksi)"
            disabled={isSubmitting}
            onChange={(e) => onPositionChange(e.target.value)}
            className="font-bold text-base bg-background/50 focus:bg-background flex-1 min-w-0"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
          disabled={isSubmitting}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          Hapus Posisi
        </Button>
      </div>

      <div className="space-y-3 pl-8">
        <FieldLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
          Daftar Nama Redaksi
        </FieldLabel>

        {positionItem.people.length > 0 ? (
          <DragDropProvider onDragEnd={handleDragEndPeople}>
            <div className="space-y-2">
              {positionItem.people.map((person, personIdx) => (
                <SortablePersonItem
                  key={person.id}
                  person={person}
                  index={personIdx}
                  isSubmitting={isSubmitting}
                  onNameChange={(val) => {
                    const newPeople = [...positionItem.people];
                    newPeople[personIdx] = { ...newPeople[personIdx], name: val };
                    onPeopleChange(newPeople);
                  }}
                  onRemove={() => {
                    const newPeople = [...positionItem.people];
                    newPeople.splice(personIdx, 1);
                    onPeopleChange(newPeople);
                  }}
                />
              ))}
            </div>
          </DragDropProvider>
        ) : (
          <div className="text-sm text-muted-foreground py-2 border border-dashed border-border rounded-md text-center">
            Belum ada nama redaksi di posisi ini.
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full flex items-center justify-center gap-1 text-xs py-2 mt-2"
          disabled={isSubmitting}
          onClick={() => {
            onPeopleChange([
              ...positionItem.people,
              { id: Math.random().toString(36).substring(2, 9), name: "" },
            ]);
          }}
        >
          <Plus className="h-3 w-3 mr-1" />
          Tambah Anggota
        </Button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

const AboutUsConfigurationPage = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingConfiguration, setIsLoadingConfiguration] = useState(true);
  const [oldConfigurations, setOldConfigurations] = useState<Configuration[]>(
    [],
  );

  // Semua section dibuka secara default
  const [openSections, setOpenSections] = useState<Set<SectionId>>(
    new Set(["profile", "visi_misi", "redaksi", "sections_cta", "quotes", "meet_us", "kontak"]),
  );

  const toggleSection = (id: SectionId) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      about_us_text: "",
      address_text: "",
      social_instagram_link: "",
      social_facebook_link: "",
      social_twitter_link: "",
      social_threads_link: "",
      contact_email: "",
      contact_phone: "",
      contact_fax: "",

      // New Fields Defaults
      tagline_about_us: "",
      sub_tagline_about_us: "",
      visi: "",
      misi: "",
      sections_about_us: [],
      quotes: "",
      quotes_owner: "",
      title_meet_us: "",
      desc_meet_us: "",
      link_gmaps: "",

      // Editorial Structure Defaults
      title_redaksi: "",
      redaksi_positions: [],
    },
  });

  // ── Fetch configuration data ─────────────────────────────
  const fetchConfigurationData = useCallback(
    async (isSilent = false) => {
      try {
        if (!isSilent) {
          setIsLoadingConfiguration(true);
        }
        const response = await api.get("/configuration");
        const configurations: Configuration[] = response.data || [];
        setOldConfigurations(configurations);

        const defaultValues: FormValues = {
          about_us_text: "",
          address_text: "",
          social_instagram_link: "",
          social_facebook_link: "",
          social_twitter_link: "",
          social_threads_link: "",
          contact_email: "",
          contact_phone: "",
          contact_fax: "",

          // New Fields Default Reset
          tagline_about_us: "",
          sub_tagline_about_us: "",
          visi: "",
          misi: "",
          sections_about_us: [],
          quotes: "",
          quotes_owner: "",
          title_meet_us: "",
          desc_meet_us: "",
          link_gmaps: "",

          // Editorial Structure Default Reset
          title_redaksi: "",
          redaksi_positions: [],
        };

        configurations.forEach((config) => {
          if (config.key === "about_us_text" && config.type === "string") {
            defaultValues.about_us_text = (config.value as string) || "";
          }
          if (config.key === "address_text" && config.type === "string") {
            defaultValues.address_text = (config.value as string) || "";
          }
          if (
            config.key === "social_instagram_link" &&
            config.type === "string"
          ) {
            defaultValues.social_instagram_link =
              (config.value as string) || "";
          }
          if (
            config.key === "social_facebook_link" &&
            config.type === "string"
          ) {
            defaultValues.social_facebook_link = (config.value as string) || "";
          }
          if (
            config.key === "social_twitter_link" &&
            config.type === "string"
          ) {
            defaultValues.social_twitter_link = (config.value as string) || "";
          }
          if (
            config.key === "social_threads_link" &&
            config.type === "string"
          ) {
            defaultValues.social_threads_link = (config.value as string) || "";
          }
          if (config.key === "contact_email" && config.type === "string") {
            defaultValues.contact_email = (config.value as string) || "";
          }
          if (config.key === "contact_phone" && config.type === "string") {
            let rawPhone = (config.value as string) || "";
            // Strip prefix agar hanya angka setelah 62 yang tampil di field
            if (rawPhone.startsWith("+62")) {
              rawPhone = rawPhone.slice(3);
            } else if (rawPhone.startsWith("62")) {
              rawPhone = rawPhone.slice(2);
            } else if (rawPhone.startsWith("0")) {
              rawPhone = rawPhone.slice(1);
            }
            defaultValues.contact_phone = rawPhone;
          }
          if (config.key === "contact_fax" && config.type === "string") {
            defaultValues.contact_fax = (config.value as string) || "";
          }

          // Parse New Fields
          if (config.key === "tagline_about_us" && config.type === "string") {
            defaultValues.tagline_about_us = (config.value as string) || "";
          }
          if (
            config.key === "sub_tagline_about_us" &&
            config.type === "string"
          ) {
            defaultValues.sub_tagline_about_us = (config.value as string) || "";
          }
          if (config.key === "visi" && config.type === "string") {
            defaultValues.visi = (config.value as string) || "";
          }
          if (config.key === "misi" && config.type === "string") {
            defaultValues.misi = (config.value as string) || "";
          }
          if (config.key === "sections_about_us" && config.type === "string") {
            try {
              defaultValues.sections_about_us =
                JSON.parse(config.value as string) || [];
            } catch {
              defaultValues.sections_about_us = [];
            }
          }
          if (config.key === "quotes" && config.type === "string") {
            defaultValues.quotes = (config.value as string) || "";
          }
          if (config.key === "quotes_owner" && config.type === "string") {
            defaultValues.quotes_owner = (config.value as string) || "";
          }
          if (config.key === "title_meet_us" && config.type === "string") {
            defaultValues.title_meet_us = (config.value as string) || "";
          }
          if (config.key === "desc_meet_us" && config.type === "string") {
            defaultValues.desc_meet_us = (config.value as string) || "";
          }
          if (config.key === "link_gmaps" && config.type === "string") {
            defaultValues.link_gmaps = (config.value as string) || "";
          }
          if (config.key === "title_redaksi" && config.type === "string") {
            defaultValues.title_redaksi = (config.value as string) || "";
          }
          if (config.key === "redaksi_positions" && config.type === "string") {
            try {
              defaultValues.redaksi_positions =
                JSON.parse(config.value as string) || [];
            } catch {
              defaultValues.redaksi_positions = [];
            }
          }
        });

        form.reset(defaultValues);
      } catch (error) {
        toast.error(
          `Failed to load configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      } finally {
        if (!isSilent) {
          setIsLoadingConfiguration(false);
        }
      }
    },
    [form],
  );

  // ── Fetch configuration data on mount ──────────────────────────────────
  useEffect(() => {
    fetchConfigurationData();
  }, [fetchConfigurationData]);

  // ── Handle form submission ─────────────────────────────────────────────
  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);
      const changedConfigurations: Configuration[] = [];

      const keys: (keyof FormValues)[] = [
        "about_us_text",
        "address_text",
        "social_instagram_link",
        "social_facebook_link",
        "social_twitter_link",
        "social_threads_link",
        "contact_email",
        "contact_phone",
        "contact_fax",
        "tagline_about_us",
        "sub_tagline_about_us",
        "visi",
        "misi",
        "sections_about_us",
        "quotes",
        "quotes_owner",
        "title_meet_us",
        "desc_meet_us",
        "link_gmaps",
        "title_redaksi",
        "redaksi_positions",
      ];

      keys.forEach((key) => {
        const oldConfig = oldConfigurations.find(
          (c) => c.key === key && c.type === "string",
        );
        const oldValue = oldConfig ? oldConfig.value : "";
        const newValue = data[key];

        if (key === "sections_about_us" || key === "redaksi_positions") {
          // Serialise array ke JSON string untuk perbandingan dan penyimpanan
          const oldStr = typeof oldValue === "string" ? oldValue : "[]";
          const newStr = JSON.stringify(data[key] || []);
          if (oldStr !== newStr) {
            changedConfigurations.push({
              key,
              value: newStr,
              type: "string",
            });
          }
        } else {
          const oldValStr = oldValue ? String(oldValue) : "";
          let newValStr = newValue ? String(newValue) : "";

          // Normalisasi nomor telepon: pastikan disimpan dengan prefix "62"
          if (key === "contact_phone" && newValStr) {
            let cleanPhone = newValStr.trim();
            if (cleanPhone.startsWith("+62")) {
              cleanPhone = cleanPhone.slice(3);
            } else if (cleanPhone.startsWith("62")) {
              cleanPhone = cleanPhone.slice(2);
            } else if (cleanPhone.startsWith("0")) {
              cleanPhone = cleanPhone.slice(1);
            }
            newValStr = `62${cleanPhone}`;
          }

          if (oldValStr !== newValStr) {
            changedConfigurations.push({
              key,
              value: newValStr,
              type: "string",
            });
          }
        }
      });

      if (changedConfigurations.length === 0) {
        toast("Tidak ada perubahan konfigurasi.");
        setIsSubmitting(false);
        return;
      }

      // Build payload
      const payload: CreateConfigurationPayload = {
        configurations: changedConfigurations,
      };

      // Prepare FormData for multipart upload
      const formData = new FormData();
      formData.append("configurations", JSON.stringify(payload.configurations));

      // Send to API
      try {
        await api.post("/configuration", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          validateStatus: (status: number) => status < 500,
        });
      } catch (err) {
        if (err instanceof Error && "response" in err) {
          const errorData = (
            err as { response?: { data?: { error?: string } } }
          ).response?.data;
          throw new Error(errorData?.error || "Failed to save configuration");
        }
        throw err;
      }

      toast.success("Configuration saved successfully!");
      // Sinkronisasi state secara silent agar perbandingan berikutnya akurat
      await fetchConfigurationData(true);
    } catch (error) {
      console.error("Error saving configuration:", error);
      toast.error(
        `Failed to save configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tentang Kami & Kontak</h1>
          <p className="text-muted-foreground">
            Manage about us, corporate sections, and contact details
          </p>
        </div>
        <Button
          onClick={() => form.reset()}
          disabled={isLoadingConfiguration || isSubmitting}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset Form
        </Button>
      </div>

      {/* Configuration Form */}
      <div className="bg-card rounded-lg border border-border overflow-hidden p-6">
        {isLoadingConfiguration ? (
          // Loading skeleton
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-14 w-full bg-muted rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : (
          <form
            id="config-form"
            className="w-full space-y-4"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            {/* ── SECTION 1: ABOUT US GENERAL ── */}
            <AccordionSection
              id="profile"
              title="Profil & Deskripsi Tentang Kami"
              openSections={openSections}
              onToggle={toggleSection}
            >
              <FieldGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
                {/* Tagline About Us */}
                <Controller
                  name="tagline_about_us"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="col-span-1 lg:col-span-3"
                    >
                      <FieldLabel htmlFor="tagline_about_us">
                        Tagline About Us
                      </FieldLabel>
                      <Input
                        {...field}
                        id="tagline_about_us"
                        placeholder="Enter about us tagline"
                        autoComplete="off"
                        aria-invalid={fieldState.invalid}
                        disabled={isSubmitting}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                {/* Sub Tagline About Us */}
                <Controller
                  name="sub_tagline_about_us"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="col-span-1 lg:col-span-3"
                    >
                      <FieldLabel htmlFor="sub_tagline_about_us">
                        Sub Tagline About Us
                      </FieldLabel>
                      <Input
                        {...field}
                        id="sub_tagline_about_us"
                        placeholder="Enter about us sub tagline"
                        autoComplete="off"
                        aria-invalid={fieldState.invalid}
                        disabled={isSubmitting}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                {/* About Us Text */}
                <Controller
                  name="about_us_text"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="col-span-1 lg:col-span-6"
                    >
                      <FieldLabel htmlFor="about_us_text">
                        About Us Text
                      </FieldLabel>
                      <Textarea
                        {...field}
                        id="about_us_text"
                        placeholder="Enter about us description"
                        aria-invalid={fieldState.invalid}
                        disabled={isSubmitting}
                        className="min-h-[120px]"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </FieldGroup>
            </AccordionSection>

            {/* ── SECTION 2: VISI & MISI ── */}
            <AccordionSection
              id="visi_misi"
              title="Visi & Misi Perusahaan"
              openSections={openSections}
              onToggle={toggleSection}
            >
              <FieldGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
                {/* Visi */}
                <Controller
                  name="visi"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="col-span-1 lg:col-span-3"
                    >
                      <FieldLabel htmlFor="visi">Visi</FieldLabel>
                      <Textarea
                        {...field}
                        id="visi"
                        placeholder="Tulis visi perusahaan..."
                        aria-invalid={fieldState.invalid}
                        disabled={isSubmitting}
                        className="min-h-[100px]"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                {/* Misi */}
                <Controller
                  name="misi"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="col-span-1 lg:col-span-3"
                    >
                      <FieldLabel htmlFor="misi">Misi</FieldLabel>
                      <Textarea
                        {...field}
                        id="misi"
                        placeholder="Tulis misi perusahaan..."
                        aria-invalid={fieldState.invalid}
                        disabled={isSubmitting}
                        className="min-h-[100px]"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </FieldGroup>
            </AccordionSection>

            {/* ── SECTION 3: STRUKTUR REDAKSI (DnD REPEATER) ── */}
            <AccordionSection
              id="redaksi"
              title="Struktur Organisasi Redaksi"
              openSections={openSections}
              onToggle={toggleSection}
            >
              <FieldGroup className="grid grid-cols-1 lg:grid-cols-6 gap-6">
                {/* Title Section Struktur */}
                <Controller
                  name="title_redaksi"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="col-span-1 lg:col-span-6"
                    >
                      <FieldLabel htmlFor="title_redaksi">
                        Title Section Struktur Redaksi
                      </FieldLabel>
                      <Input
                        {...field}
                        id="title_redaksi"
                        placeholder="e.g. Struktur Redaksi Arasvara"
                        autoComplete="off"
                        aria-invalid={fieldState.invalid}
                        disabled={isSubmitting}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                {/* Editorial Positions DnD Repeater */}
                <div className="col-span-1 lg:col-span-6 space-y-4">
                  <FieldLabel className="text-sm font-bold">
                    Positions & Members
                  </FieldLabel>
                  <Controller
                    name="redaksi_positions"
                    control={form.control}
                    render={({ field }) => {
                      const positions = field.value || [];

                      const handleDragEndPositions = (event: any) => {
                        const { operation } = event;
                        if (!operation) return;
                        const { from, to } = operation;
                        if (from !== to) {
                          const newPositions = [...positions];
                          const [moved] = newPositions.splice(from, 1);
                          newPositions.splice(to, 0, moved);
                          field.onChange(newPositions);
                        }
                      };

                      return (
                        <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
                          {positions.length > 0 ? (
                            <DragDropProvider onDragEnd={handleDragEndPositions}>
                              <div className="space-y-4">
                                {positions.map((posItem: any, posIdx: number) => (
                                  <SortablePositionItem
                                    key={posItem.id}
                                    positionItem={posItem}
                                    index={posIdx}
                                    isSubmitting={isSubmitting}
                                    onPositionChange={(val) => {
                                      const newPositions = [...positions];
                                      newPositions[posIdx] = {
                                        ...newPositions[posIdx],
                                        position: val,
                                      };
                                      field.onChange(newPositions);
                                    }}
                                    onPeopleChange={(peopleVal) => {
                                      const newPositions = [...positions];
                                      newPositions[posIdx] = {
                                        ...newPositions[posIdx],
                                        people: peopleVal,
                                      };
                                      field.onChange(newPositions);
                                    }}
                                    onRemove={() => {
                                      const newPositions = [...positions];
                                      newPositions.splice(posIdx, 1);
                                      field.onChange(newPositions);
                                    }}
                                  />
                                ))}
                              </div>
                            </DragDropProvider>
                          ) : (
                            <div className="text-sm text-muted-foreground py-6 border-2 border-dashed border-border rounded-lg text-center bg-muted/5">
                              Belum ada struktur redaksi yang ditambahkan. Klik
                              &quot;Tambah Posisi Jabatan&quot; untuk memulai.
                            </div>
                          )}

                          <Button
                            type="button"
                            variant="outline"
                            className="w-full flex items-center justify-center gap-2 border-dashed border-2 py-4 hover:bg-accent transition-colors"
                            disabled={isSubmitting}
                            onClick={() => {
                              field.onChange([
                                ...positions,
                                {
                                  id: Math.random()
                                    .toString(36)
                                    .substring(2, 9),
                                  position: "",
                                  people: [],
                                },
                              ]);
                            }}
                          >
                            <Plus className="h-4 w-4" />
                            Tambah Posisi Jabatan Baru
                          </Button>
                        </div>
                      );
                    }}
                  />
                </div>
              </FieldGroup>
            </AccordionSection>

            {/* ── SECTION 4: REPEATER SECTIONS CTA ── */}
            <AccordionSection
              id="sections_cta"
              title="Sections & Call to Action (CTA)"
              openSections={openSections}
              onToggle={toggleSection}
            >
              <Controller
                name="sections_about_us"
                control={form.control}
                render={({ field }) => {
                  const list = field.value || [];
                  return (
                    <div className="space-y-4">
                      {list.map((item: any, index: number) => (
                        <div
                          key={index}
                          className="bg-muted/10 border border-border rounded-lg p-5 relative space-y-4"
                        >
                          <div className="flex justify-between items-center border-b border-border pb-2">
                            <span className="text-sm font-bold text-muted-foreground">
                              Section Item #{index + 1}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
                              onClick={() => {
                                const newList = [...list];
                                newList.splice(index, 1);
                                field.onChange(newList);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-1.5" />
                              Hapus Section
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field className="col-span-1 md:col-span-2">
                              <FieldLabel htmlFor={`sections_title_${index}`}>
                                Title
                              </FieldLabel>
                              <Input
                                id={`sections_title_${index}`}
                                value={item.title || ""}
                                placeholder="Enter section title"
                                disabled={isSubmitting}
                                onChange={(e) => {
                                  const newList = [...list];
                                  newList[index] = {
                                    ...newList[index],
                                    title: e.target.value,
                                  };
                                  field.onChange(newList);
                                }}
                              />
                            </Field>

                            <Field className="col-span-1">
                              <FieldLabel htmlFor={`sections_desc_${index}`}>
                                Description
                              </FieldLabel>
                              <Textarea
                                id={`sections_desc_${index}`}
                                value={item.description || ""}
                                placeholder="Enter section description"
                                className="min-h-[80px]"
                                rows={4}
                                disabled={isSubmitting}
                                onChange={(e) => {
                                  const newList = [...list];
                                  newList[index] = {
                                    ...newList[index],
                                    description: e.target.value,
                                  };
                                  field.onChange(newList);
                                }}
                              />
                            </Field>
                            <div className="col-span-1 space-y-4">
                              <Field>
                                <FieldLabel
                                  htmlFor={`sections_btn_text_${index}`}
                                >
                                  Button Text
                                </FieldLabel>
                                <Input
                                  id={`sections_btn_text_${index}`}
                                  value={item.button_text || ""}
                                  placeholder="e.g. Hubungi Kami"
                                  disabled={isSubmitting}
                                  onChange={(e) => {
                                    const newList = [...list];
                                    newList[index] = {
                                      ...newList[index],
                                      button_text: e.target.value,
                                    };
                                    field.onChange(newList);
                                  }}
                                />
                              </Field>
                              <Field>
                                <FieldLabel
                                  htmlFor={`sections_btn_link_${index}`}
                                >
                                  Link Button
                                </FieldLabel>
                                <Input
                                  id={`sections_btn_link_${index}`}
                                  value={item.link_button || ""}
                                  placeholder="e.g. https://wa.me/..."
                                  disabled={isSubmitting}
                                  onChange={(e) => {
                                    const newList = [...list];
                                    newList[index] = {
                                      ...newList[index],
                                      link_button: e.target.value,
                                    };
                                    field.onChange(newList);
                                  }}
                                />
                              </Field>
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full flex items-center justify-center gap-2 border-dashed border-2 py-6 hover:bg-accent transition-colors"
                        onClick={() => {
                          field.onChange([
                            ...list,
                            {
                              title: "",
                              description: "",
                              link_button: "",
                              button_text: "",
                            },
                          ]);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Tambah Section Baru
                      </Button>
                    </div>
                  );
                }}
              />
            </AccordionSection>

            {/* ── SECTION 5: QUOTES ── */}
            <AccordionSection
              id="quotes"
              title="Quotes & Pemilik Kutipan"
              openSections={openSections}
              onToggle={toggleSection}
            >
              <FieldGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
                {/* Quotes */}
                <Controller
                  name="quotes"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="col-span-1 lg:col-span-4"
                    >
                      <FieldLabel htmlFor="quotes">Quotes</FieldLabel>
                      <Input
                        {...field}
                        id="quotes"
                        placeholder="Enter quotes or motto..."
                        autoComplete="off"
                        aria-invalid={fieldState.invalid}
                        disabled={isSubmitting}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                {/* Quotes Owner */}
                <Controller
                  name="quotes_owner"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="col-span-1 lg:col-span-2"
                    >
                      <FieldLabel htmlFor="quotes_owner">
                        Quotes Owner
                      </FieldLabel>
                      <Input
                        {...field}
                        id="quotes_owner"
                        placeholder="e.g. John Doe (CEO)"
                        autoComplete="off"
                        aria-invalid={fieldState.invalid}
                        disabled={isSubmitting}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </FieldGroup>
            </AccordionSection>

            {/* ── SECTION 6: MEET US ── */}
            <AccordionSection
              id="meet_us"
              title="Meet Us & Lokasi Maps"
              openSections={openSections}
              onToggle={toggleSection}
            >
              <FieldGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
                {/* Title Meet Us */}
                <Controller
                  name="title_meet_us"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="col-span-1 lg:col-span-3"
                    >
                      <FieldLabel htmlFor="title_meet_us">
                        Title Meet Us
                      </FieldLabel>
                      <Input
                        {...field}
                        id="title_meet_us"
                        placeholder="e.g. Kunjungi Kantor Kami"
                        autoComplete="off"
                        aria-invalid={fieldState.invalid}
                        disabled={isSubmitting}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                {/* Desc Meet Us */}
                <Controller
                  name="desc_meet_us"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="col-span-1 lg:col-span-3"
                    >
                      <FieldLabel htmlFor="desc_meet_us">
                        Desc Meet Us
                      </FieldLabel>
                      <Input
                        {...field}
                        id="desc_meet_us"
                        placeholder="Enter description for meet us section"
                        autoComplete="off"
                        aria-invalid={fieldState.invalid}
                        disabled={isSubmitting}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                {/* Link Gmaps */}
                <Controller
                  name="link_gmaps"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="col-span-1 lg:col-span-6"
                    >
                      <FieldLabel htmlFor="link_gmaps">
                        Link Google Maps (URL / Embed)
                      </FieldLabel>
                      <Input
                        {...field}
                        id="link_gmaps"
                        placeholder="https://maps.google.com/..."
                        autoComplete="off"
                        aria-invalid={fieldState.invalid}
                        disabled={isSubmitting}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </FieldGroup>
            </AccordionSection>

            {/* ── SECTION 7: SOCIAL MEDIA, KONTAK & ALAMAT ── */}
            <AccordionSection
              id="kontak"
              title="Kontak, Alamat & Media Sosial"
              openSections={openSections}
              onToggle={toggleSection}
            >
              <FieldGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
                {/* Instagram Link */}
                <Controller
                  name="social_instagram_link"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="col-span-1 lg:col-span-2"
                    >
                      <FieldLabel htmlFor="social_instagram_link">
                        Instagram Link
                      </FieldLabel>
                      <Input
                        {...field}
                        id="social_instagram_link"
                        placeholder="e.g. https://instagram.com/username"
                        autoComplete="off"
                        aria-invalid={fieldState.invalid}
                        disabled={isSubmitting}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                {/* Facebook Link */}
                <Controller
                  name="social_facebook_link"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="col-span-1 lg:col-span-2"
                    >
                      <FieldLabel htmlFor="social_facebook_link">
                        Facebook Link
                      </FieldLabel>
                      <Input
                        {...field}
                        id="social_facebook_link"
                        placeholder="e.g. https://facebook.com/username"
                        autoComplete="off"
                        aria-invalid={fieldState.invalid}
                        disabled={isSubmitting}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                {/* Twitter Link */}
                <Controller
                  name="social_twitter_link"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="col-span-1 lg:col-span-2"
                    >
                      <FieldLabel htmlFor="social_twitter_link">
                        Twitter (X) Link
                      </FieldLabel>
                      <Input
                        {...field}
                        id="social_twitter_link"
                        placeholder="e.g. https://x.com/username"
                        autoComplete="off"
                        aria-invalid={fieldState.invalid}
                        disabled={isSubmitting}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                {/* Threads Link */}
                <Controller
                  name="social_threads_link"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="col-span-1 lg:col-span-2"
                    >
                      <FieldLabel htmlFor="social_threads_link">
                        Threads Link
                      </FieldLabel>
                      <Input
                        {...field}
                        id="social_threads_link"
                        placeholder="e.g. https://threads.net/@username"
                        autoComplete="off"
                        aria-invalid={fieldState.invalid}
                        disabled={isSubmitting}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                {/* Email Contact */}
                <Controller
                  name="contact_email"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="col-span-1 lg:col-span-2"
                    >
                      <FieldLabel htmlFor="contact_email">Email</FieldLabel>
                      <Input
                        {...field}
                        id="contact_email"
                        placeholder="e.g. redaksi@arasvara.id"
                        autoComplete="off"
                        aria-invalid={fieldState.invalid}
                        disabled={isSubmitting}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                {/* Telepon Contact */}
                <Controller
                  name="contact_phone"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="col-span-1 lg:col-span-2"
                    >
                      <FieldLabel htmlFor="contact_phone">Telepon</FieldLabel>
                      <div className="flex rounded-md shadow-sm">
                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-border bg-muted/50 text-muted-foreground text-sm font-medium">
                          +62
                        </span>
                        <Input
                          {...field}
                          id="contact_phone"
                          placeholder="e.g. 812345678"
                          autoComplete="off"
                          aria-invalid={fieldState.invalid}
                          disabled={isSubmitting}
                          className="rounded-l-none focus-visible:ring-1"
                        />
                      </div>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                {/* Fax Contact */}
                <Controller
                  name="contact_fax"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="col-span-1 lg:col-span-2"
                    >
                      <FieldLabel htmlFor="contact_fax">Fax</FieldLabel>
                      <Input
                        {...field}
                        id="contact_fax"
                        placeholder="e.g. 021-..."
                        autoComplete="off"
                        aria-invalid={fieldState.invalid}
                        disabled={isSubmitting}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                {/* Address Field */}
                <Controller
                  name="address_text"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="col-span-1 lg:col-span-6"
                    >
                      <FieldLabel htmlFor="address_text">Alamat</FieldLabel>
                      <Textarea
                        {...field}
                        id="address_text"
                        placeholder="Enter address details"
                        aria-invalid={fieldState.invalid}
                        disabled={isSubmitting}
                        className="min-h-[100px]"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </FieldGroup>
            </AccordionSection>

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-6 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset()}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AboutUsConfigurationPage;
