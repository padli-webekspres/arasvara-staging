"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Plus, RotateCcw, SquareArrowOutUpRight } from "lucide-react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchAllCategoriesPages } from "@/components/categories/categoryModalFetch";
import VideoHeroUploader from "@/components/configuration/VideoHeroUploader";
import ImageDropZone from "@/components/configuration/ImageDropZone";
import { Switch } from "@/components/ui/switch";
import {
  getVideoFromIndexedDB,
  saveVideoToIndexedDB,
  removeVideoFromIndexedDB,
} from "@/lib/configuration/indexeddb-config";
import { extractVideoThumbnail } from "@/lib/configuration/video-thumbnail";
import { prepareImageForCrop } from "@/lib/image/prepareImageForCrop";
import { IMAGE_UPLOAD_TIMEOUT_MS } from "@/lib/image/uploadTimeout";
import {
  CreateConfigurationPayload,
  Configuration,
} from "@/types/configuration";
import axios from "axios";
import api from "@/lib/axios";
import Link from "next/link";
import { adminPanelHref } from "@/lib/admin-panel-path";

/**
 * Normalisasi file gambar (HEIC/foto besar) lewat prepareImageForCrop,
 * lalu kembalikan File siap upload/preview. Caller tidak perlu revoke URL.
 */
async function normalizeConfigImageFile(file: File): Promise<File> {
  const objectUrl = await prepareImageForCrop(file);
  try {
    const response = await fetch(objectUrl);
    const blob = await response.blob();
    const mime = blob.type || "image/jpeg";
    const ext = mime.includes("png")
      ? "png"
      : mime.includes("webp")
        ? "webp"
        : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.${ext}`, { type: mime });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function revokeBlobUrl(url: string | null | undefined) {
  if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
}

// ── Form validation schema ────────────────────────────────────────────────
const formSchema = z.object({
  tagline_website: z
    .string()
    .min(3, "Tag line must be at least 3 characters.")
    .max(100, "Tag line must be at most 100 characters.")
    .optional()
    .or(z.literal("")),
  copyright_text: z.string().optional().or(z.literal("")),
  meta_description_website: z.string().optional().or(z.literal("")),
  whatsapp_channel: z.string().optional().or(z.literal("")),
  telegram_group: z.string().optional().or(z.literal("")),
  section_fotografi_title: z.string().optional().or(z.literal("")),
  section_sponsor_title: z.string().optional().or(z.literal("")),
  section_youtube_title: z.string().optional().or(z.literal("")),
  section_socmed_title: z.string().optional().or(z.literal("")),
  section_sponsor_active: z.boolean().default(false).optional(),
  section_youtube_active: z.boolean().default(false).optional(),
  section_socmed_active: z.boolean().default(false).optional(),
  grid_section_category_slug: z.string().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

// ── Main Component ────────────────────────────────────────────────────────

const ConfigurationPage = () => {
  // Hero Video
  const [heroVideoFile, setHeroVideoFile] = useState<File | null>(null);
  const [heroVideoThumbnail, setHeroVideoThumbnail] = useState<Blob | null>(
    null,
  );

  // Fotografi Section Background
  const [fotografiBgFile, setFotografiBgFile] = useState<File | null>(null);
  const [fotografiBgPreview, setFotografiBgPreview] = useState<string | null>(
    null,
  );

  // Hero Video Poster Background
  const [heroVideoPosterBgFile, setHeroVideoPosterBgFile] = useState<File | null>(null);
  const [heroVideoPosterBgPreview, setHeroVideoPosterBgPreview] = useState<string | null>(null);

  // Per-section backgrounds
  const [youtubeBgFile, setYoutubeBgFile] = useState<File | null>(null);
  const [youtubeBgPreview, setYoutubeBgPreview] = useState<string | null>(null);
  const [socmedBgFile, setSocmedBgFile] = useState<File | null>(null);
  const [socmedBgPreview, setSocmedBgPreview] = useState<string | null>(null);

  // Dirty flags: only upload when user actually changes media in this session
  const [isFotografiBgDirty, setIsFotografiBgDirty] = useState(false);
  const [isYoutubeBgDirty, setIsYoutubeBgDirty] = useState(false);
  const [isSocmedBgDirty, setIsSocmedBgDirty] = useState(false);
  const [isHeroVideoPosterBgDirty, setIsHeroVideoPosterBgDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingConfiguration, setIsLoadingConfiguration] = useState(true);
  const [categoryOptions, setCategoryOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  // Ambil bucket dari env
  const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_CONFIGURATION || "";
  const previewUrlsRef = useRef({
    heroPoster: null as string | null,
    fotografi: null as string | null,
    youtube: null as string | null,
    socmed: null as string | null,
  });

  const setPreviewSlot = useCallback(
    (
      slot: keyof typeof previewUrlsRef.current,
      blob: Blob,
      setter: (url: string | null) => void,
    ) => {
      revokeBlobUrl(previewUrlsRef.current[slot]);
      const url = URL.createObjectURL(blob);
      previewUrlsRef.current[slot] = url;
      setter(url);
    },
    [],
  );

  const clearPreviewSlot = useCallback(
    (
      slot: keyof typeof previewUrlsRef.current,
      setter: (url: string | null) => void,
    ) => {
      revokeBlobUrl(previewUrlsRef.current[slot]);
      previewUrlsRef.current[slot] = null;
      setter(null);
    },
    [],
  );

  useEffect(() => {
    return () => {
      const urls = previewUrlsRef.current;
      revokeBlobUrl(urls.heroPoster);
      revokeBlobUrl(urls.fotografi);
      revokeBlobUrl(urls.youtube);
      revokeBlobUrl(urls.socmed);
    };
  }, []);

  // --- DropZone Handlers (must be after state declarations) ---
  const handleHeroVideoPosterBgAccepted = useCallback(async (file: File) => {
    try {
      const normalized = await normalizeConfigImageFile(file);
      setHeroVideoPosterBgFile(normalized);
      setIsHeroVideoPosterBgDirty(true);
      setPreviewSlot("heroPoster", normalized, setHeroVideoPosterBgPreview);
      await saveVideoToIndexedDB(
        "hero_video_poster_bg",
        normalized,
        normalized.type,
      );
    } catch (err) {
      toast.error(
        "Gambar tidak dapat dimuat. Coba lagi atau gunakan format JPEG/PNG/WebP.",
      );
    }
  }, [setPreviewSlot]);

  const handleHeroVideoPosterBgRemove = useCallback(async () => {
    setHeroVideoPosterBgFile(null);
    clearPreviewSlot("heroPoster", setHeroVideoPosterBgPreview);
    setIsHeroVideoPosterBgDirty(true);
    await removeVideoFromIndexedDB("hero_video_poster_bg");
  }, [clearPreviewSlot]);
  const handleFotografiAccepted = useCallback(async (file: File) => {
    try {
      const normalized = await normalizeConfigImageFile(file);
      setFotografiBgFile(normalized);
      setIsFotografiBgDirty(true);
      setPreviewSlot("fotografi", normalized, setFotografiBgPreview);
      await saveVideoToIndexedDB(
        "fotografi_section_bg",
        normalized,
        normalized.type,
      );
    } catch (err) {
      toast.error(
        "Gambar tidak dapat dimuat. Coba lagi atau gunakan format JPEG/PNG/WebP.",
      );
    }
  }, [setPreviewSlot]);

  const handleFotografiRemove = useCallback(async () => {
    setFotografiBgFile(null);
    clearPreviewSlot("fotografi", setFotografiBgPreview);
    setIsFotografiBgDirty(true);
    await removeVideoFromIndexedDB("fotografi_section_bg");
  }, [clearPreviewSlot]);

  const handleYoutubeAccepted = useCallback(async (file: File) => {
    try {
      const normalized = await normalizeConfigImageFile(file);
      setYoutubeBgFile(normalized);
      setIsYoutubeBgDirty(true);
      setPreviewSlot("youtube", normalized, setYoutubeBgPreview);
      await saveVideoToIndexedDB(
        "youtube_section_bg",
        normalized,
        normalized.type,
      );
    } catch (err) {
      toast.error(
        "Gambar tidak dapat dimuat. Coba lagi atau gunakan format JPEG/PNG/WebP.",
      );
    }
  }, [setPreviewSlot]);

  const handleYoutubeRemove = useCallback(async () => {
    setYoutubeBgFile(null);
    clearPreviewSlot("youtube", setYoutubeBgPreview);
    setIsYoutubeBgDirty(true);
    await removeVideoFromIndexedDB("youtube_section_bg");
  }, [clearPreviewSlot]);

  const handleSocmedAccepted = useCallback(async (file: File) => {
    try {
      const normalized = await normalizeConfigImageFile(file);
      setSocmedBgFile(normalized);
      setIsSocmedBgDirty(true);
      setPreviewSlot("socmed", normalized, setSocmedBgPreview);
      await saveVideoToIndexedDB(
        "socmed_section_bg",
        normalized,
        normalized.type,
      );
    } catch (err) {
      toast.error(
        "Gambar tidak dapat dimuat. Coba lagi atau gunakan format JPEG/PNG/WebP.",
      );
    }
  }, [setPreviewSlot]);

  const handleSocmedRemove = useCallback(async () => {
    setSocmedBgFile(null);
    clearPreviewSlot("socmed", setSocmedBgPreview);
    setIsSocmedBgDirty(true);
    await removeVideoFromIndexedDB("socmed_section_bg");
  }, [clearPreviewSlot]);
  // State untuk menyimpan konfigurasi lama
  // const [oldConfigurations, setOldConfigurations] = useState<Configuration[]>(
  const [oldConfigurations, setOldConfigurations] = useState<Configuration[]>(
    [],
  );
  const [defaultThumbnailUrl, setDefaultThumbnailUrl] = useState<string | null>(
    null,
  );
  const [defaultVideoUrl, setDefaultVideoUrl] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tagline_website: "",
      copyright_text: "",
      meta_description_website: "",
      whatsapp_channel: "",
      telegram_group: "",
      section_fotografi_title: "",
      section_sponsor_title: "",
      section_youtube_title: "",
      section_socmed_title: "",
      section_sponsor_active: false,
      section_youtube_active: true,
      section_socmed_active: true,
      grid_section_category_slug: "",
    },
  });

  useEffect(() => {
    let cancelled = false;
    setLoadingCategories(true);
    fetchAllCategoriesPages({ sortBy: "name" })
      .then((cats) => {
        if (cancelled) return;
        setCategoryOptions(
          cats.map((c) => ({
            value: c.slug,
            label: c.name,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) toast.error("Gagal memuat daftar kategori.");
      })
      .finally(() => {
        if (!cancelled) setLoadingCategories(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Reusable configuration fetching function ─────────────────────────────
  const fetchConfigurationData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) {
        setIsLoadingConfiguration(true);
      }
      const response = await api.get("/configuration");
      const configurations: Configuration[] = response.data || [];
      setOldConfigurations(configurations);
      const defaultValues: Partial<FormValues> = {
        tagline_website: "",
        copyright_text: "",
        meta_description_website: "",
        whatsapp_channel: "",
        telegram_group: "",
        section_fotografi_title: "",
        section_sponsor_title: "",
        section_youtube_title: "",
        section_socmed_title: "",
        section_sponsor_active: false,
        section_youtube_active: true,
        section_socmed_active: true,
        grid_section_category_slug: "",
      };
      configurations.forEach((config) => {
        if (config.key === "tagline_website" && config.type === "string") {
          defaultValues.tagline_website = (config.value as string) || "";
        }
        if (config.key === "copyright_text" && config.type === "string") {
          defaultValues.copyright_text = (config.value as string) || "";
        }
        if (config.key === "meta_description_website" && config.type === "string") {
          defaultValues.meta_description_website = (config.value as string) || "";
        }
        if (config.key === "whatsapp_channel" && config.type === "string") {
          defaultValues.whatsapp_channel = (config.value as string) || "";
        }
        if (config.key === "telegram_group" && config.type === "string") {
          defaultValues.telegram_group = (config.value as string) || "";
        }
        if (
          config.key === "section_fotografi_title" &&
          config.type === "string"
        ) {
          defaultValues.section_fotografi_title =
            (config.value as string) || "";
        }
        if (
          config.key === "section_sponsor_title" &&
          config.type === "string"
        ) {
          defaultValues.section_sponsor_title =
            (config.value as string) || "";
        }
        if (
          config.key === "section_youtube_title" &&
          config.type === "string"
        ) {
          defaultValues.section_youtube_title =
            (config.value as string) || "";
        }
        if (
          config.key === "section_socmed_title" &&
          config.type === "string"
        ) {
          defaultValues.section_socmed_title =
            (config.value as string) || "";
        }
        if (
          config.key === "section_sponsor_active" &&
          (config.type === "boolean" || typeof config.value === "boolean")
        ) {
          defaultValues.section_sponsor_active =
            config.value === true || config.value === "true";
        }
        if (
          config.key === "section_youtube_active" &&
          (config.type === "boolean" || typeof config.value === "boolean")
        ) {
          defaultValues.section_youtube_active =
            config.value === true || config.value === "true";
        }
        if (
          config.key === "section_socmed_active" &&
          (config.type === "boolean" || typeof config.value === "boolean")
        ) {
          defaultValues.section_socmed_active =
            config.value === true || config.value === "true";
        }
        if (
          config.key === "grid_section_category_slug" &&
          config.type === "string"
        ) {
          defaultValues.grid_section_category_slug =
            (config.value as string) || "";
        }
      });

      if (!defaultValues.section_socmed_title) {
        const legacyTiktokTitle = configurations.find(
          (c) => c.key === "section_tiktok_title" && c.type === "string",
        );
        const legacyInstagramTitle = configurations.find(
          (c) => c.key === "section_instagram_title" && c.type === "string",
        );
        defaultValues.section_socmed_title =
          (legacyTiktokTitle?.value as string) ||
          (legacyInstagramTitle?.value as string) ||
          "";
      }

      const hasSocmedActive = configurations.some(
        (c) => c.key === "section_socmed_active",
      );
      if (!hasSocmedActive) {
        const legacyTiktokActive = configurations.find(
          (c) => c.key === "section_tiktok_active",
        );
        const legacyInstagramActive = configurations.find(
          (c) => c.key === "section_instagram_active",
        );
        const tiktokOn =
          legacyTiktokActive?.value === true ||
          legacyTiktokActive?.value === "true";
        const instagramOn =
          legacyInstagramActive?.value === true ||
          legacyInstagramActive?.value === "true";
        defaultValues.section_socmed_active = tiktokOn || instagramOn;
      }

      form.reset(defaultValues);

      // Get video config for defaultVideoUrl
      const videoConfig = configurations.find(
        (c) => c.key === "hero_video_config" && c.type === "file",
      );
      if (
        videoConfig &&
        videoConfig.value &&
        typeof videoConfig.value === "object" &&
        videoConfig.value.storageKey
      ) {
        const storageBaseUrl = process.env.NEXT_PUBLIC_STORAGE_BASE_URL || "";
        const url =
          videoConfig.value.url ||
          `${storageBaseUrl.replace(/\/$/, "")}/${videoConfig.value.storageKey}`;
        setDefaultVideoUrl(url);
      } else {
        setDefaultVideoUrl(null);
      }

      const thumbConfig = configurations.find(
        (c) => c.key === "hero_video_config_thumbnail" && c.type === "file",
      );
      if (
        thumbConfig &&
        thumbConfig.value &&
        typeof thumbConfig.value === "object" &&
        thumbConfig.value.storageKey
      ) {
        const storageBaseUrl = process.env.NEXT_PUBLIC_STORAGE_BASE_URL || "";
        const url =
          thumbConfig.value.url ||
          `${storageBaseUrl.replace(/\/$/, "")}/${thumbConfig.value.storageKey}`;
        setDefaultThumbnailUrl(url);
        try {
          const res = await axios.get<Blob>(url, { responseType: "blob" });
          const blob = res.data;
          await saveVideoToIndexedDB(
            "hero_video_config_thumbnail",
            blob,
            "image/png",
          );
        } catch {

          // Ignore fetch/cache error
        }
      } else {
        setDefaultThumbnailUrl(null);
      }

      const getFileConfigUrl = (key: string) => {
        const cfg = configurations.find((c) => c.key === key && c.type === "file");
        if (!cfg || !cfg.value || typeof cfg.value !== "object") return null;
        const v = cfg.value as { url?: string; storageKey?: string };
        if (typeof v.url === "string" && v.url.trim()) return v.url;
        if (typeof v.storageKey === "string" && v.storageKey.trim()) {
          const storageBaseUrl = process.env.NEXT_PUBLIC_STORAGE_BASE_URL || "";
          return `${storageBaseUrl.replace(/\/$/, "")}/${v.storageKey}`;
        }
        return null;
      };

      // seed previews from saved configuration (http URL, bukan blob)
      revokeBlobUrl(previewUrlsRef.current.heroPoster);
      revokeBlobUrl(previewUrlsRef.current.fotografi);
      revokeBlobUrl(previewUrlsRef.current.youtube);
      revokeBlobUrl(previewUrlsRef.current.socmed);
      previewUrlsRef.current.heroPoster = null;
      previewUrlsRef.current.fotografi = null;
      previewUrlsRef.current.youtube = null;
      previewUrlsRef.current.socmed = null;
      setHeroVideoPosterBgPreview(getFileConfigUrl("hero_video_poster_bg"));
      setFotografiBgPreview(getFileConfigUrl("fotografi_section_bg"));
      setYoutubeBgPreview(getFileConfigUrl("youtube_section_bg"));
      setSocmedBgPreview(
        getFileConfigUrl("socmed_section_bg") ||
          getFileConfigUrl("tiktok_section_bg") ||
          getFileConfigUrl("instagram_section_bg"),
      );

      // reset dirty flags after successful sync from server
      setIsHeroVideoPosterBgDirty(false);
      setIsFotografiBgDirty(false);
      setIsYoutubeBgDirty(false);
      setIsSocmedBgDirty(false);
    } catch (error) {
      toast.error(
        `Failed to load configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      if (!isSilent) {
        setIsLoadingConfiguration(false);
      }
    }
  }, [form]);

  // ── Fetch configuration data on mount ──────────────────────────────────
  useEffect(() => {
    fetchConfigurationData();

    const loadIndexedDBFiles = async () => {
      // Load Hero Video Poster Background from IndexedDB if exists
      try {
        const stored = await getVideoFromIndexedDB("hero_video_poster_bg");
        if (stored) {
          setHeroVideoPosterBgFile(
            new File([stored.file], "hero-video-poster-bg", {
              type: stored.mimeType,
            }),
          );
          setPreviewSlot("heroPoster", stored.file, setHeroVideoPosterBgPreview);
        }
      } catch {}

      // Load Fotografi Section Background from IndexedDB if exists
      try {
        const stored = await getVideoFromIndexedDB("fotografi_section_bg");
        if (stored) {
          setFotografiBgFile(
            new File([stored.file], "fotografi-section-bg", {
              type: stored.mimeType,
            }),
          );
          setPreviewSlot("fotografi", stored.file, setFotografiBgPreview);
        }
      } catch {}

      // Load YouTube Section Background from IndexedDB if exists
      try {
        const stored = await getVideoFromIndexedDB("youtube_section_bg");
        if (stored) {
          setYoutubeBgFile(
            new File([stored.file], "youtube-section-bg", {
              type: stored.mimeType,
            }),
          );
          setPreviewSlot("youtube", stored.file, setYoutubeBgPreview);
        }
      } catch {}

      // Load Socmed Section Background from IndexedDB if exists
      try {
        const stored = await getVideoFromIndexedDB("socmed_section_bg");
        if (stored) {
          setSocmedBgFile(
            new File([stored.file], "socmed-section-bg", {
              type: stored.mimeType,
            }),
          );
          setPreviewSlot("socmed", stored.file, setSocmedBgPreview);
        }
      } catch {}
    };

    loadIndexedDBFiles();
  }, [fetchConfigurationData, setPreviewSlot]);

  // ── Auto-extract thumbnail saat video dipilih ────────────────────────────
  useEffect(() => {
    const extractThumbnail = async () => {
      if (!heroVideoFile) {
        setHeroVideoThumbnail(null);
        return;
      }

      try {
        console.log("[ConfigurationPage] Extracting thumbnail from video...");
        const thumbnailBlob = await extractVideoThumbnail(heroVideoFile);
        setHeroVideoThumbnail(thumbnailBlob);
        console.log("[ConfigurationPage] Thumbnail extracted successfully");
      } catch (error) {
        console.error(
          "[ConfigurationPage] Failed to extract thumbnail:",
          error,
        );
        // Continue without thumbnail if extraction fails
        toast.error(
          `Failed to extract thumbnail: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        setHeroVideoThumbnail(null);
      }
    };

    extractThumbnail();
  }, [heroVideoFile]);

  // ── Handle form submission ─────────────────────────────────────────────
  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);

      // Get video from IndexedDB if available
      let videoData = null;
      if (heroVideoFile) {
        const stored = await getVideoFromIndexedDB("hero_video_config");
        if (stored) {
          videoData = {
            storageKey: "hero_video_config",
            mimeType: stored.mimeType,
            file: stored.file,
          };
        }
      }

      // Get hero video poster bg from IndexedDB if changed in this session
      let heroVideoPosterBgData = null;
      if (isHeroVideoPosterBgDirty && heroVideoPosterBgFile) {
        const stored = await getVideoFromIndexedDB("hero_video_poster_bg");
        if (stored) {
          heroVideoPosterBgData = {
            storageKey: "hero_video_poster_bg",
            mimeType: stored.mimeType,
            file: stored.file,
          };
        }
      }

      // Get fotografi section bg from IndexedDB if changed in this session
      let fotografiBgData = null;
      if (isFotografiBgDirty && fotografiBgFile) {
        const stored = await getVideoFromIndexedDB("fotografi_section_bg");
        if (stored) {
          fotografiBgData = {
            storageKey: "fotografi_section_bg",
            mimeType: stored.mimeType,
            file: stored.file,
          };
        }
      }

      // Get youtube section bg from IndexedDB if changed in this session
      let youtubeBgData = null;
      if (isYoutubeBgDirty && youtubeBgFile) {
        const stored = await getVideoFromIndexedDB("youtube_section_bg");
        if (stored) {
          youtubeBgData = {
            storageKey: "youtube_section_bg",
            mimeType: stored.mimeType,
            file: stored.file,
          };
        }
      }

      // Get socmed section bg from IndexedDB if changed in this session
      let socmedBgData = null;
      if (isSocmedBgDirty && socmedBgFile) {
        const stored = await getVideoFromIndexedDB("socmed_section_bg");
        if (stored) {
          socmedBgData = {
            storageKey: "socmed_section_bg",
            mimeType: stored.mimeType,
            file: stored.file,
          };
        }
      }

      // Bandingkan dengan konfigurasi lama, hanya kirim yang berubah
      const changedConfigurations: Configuration[] = [];

      // Cek perubahan tagline_website
      const oldTagline = oldConfigurations.find(
        (c) => c.key === "tagline_website" && c.type === "string",
      );
      const oldTaglineValue = oldTagline ? oldTagline.value : "";
      if (oldTaglineValue !== (data.tagline_website || "")) {
        changedConfigurations.push({
          key: "tagline_website",
          value: data.tagline_website || "",
          type: "string",
        });
      }

      // Cek perubahan copyright_text, meta_description_website, whatsapp_channel, telegram_group, section_fotografi_title
      const simpleStringKeys: (keyof FormValues)[] = [
        "copyright_text",
        "meta_description_website",
        "whatsapp_channel",
        "telegram_group",
        "section_fotografi_title",
      ];
      simpleStringKeys.forEach((key) => {
        const oldCfg = oldConfigurations.find(
          (c) => c.key === key && c.type === "string",
        );
        const oldVal = oldCfg ? String(oldCfg.value || "") : "";
        const newVal = String(data[key] || "");
        if (oldVal !== newVal) {
          changedConfigurations.push({ key, value: newVal, type: "string" });
        }
      });


      const oldGridCategory = oldConfigurations.find(
        (c) => c.key === "grid_section_category_slug" && c.type === "string",
      );
      const oldGridCategoryValue = oldGridCategory
        ? String(oldGridCategory.value || "")
        : "";
      if (oldGridCategoryValue !== (data.grid_section_category_slug || "")) {
        changedConfigurations.push({
          key: "grid_section_category_slug",
          value: data.grid_section_category_slug || "",
          type: "string",
        });
      }

      // Cek perubahan section_sponsor_title
      const oldSponsorTitle = oldConfigurations.find(
        (c) => c.key === "section_sponsor_title" && c.type === "string",
      );
      const oldSponsorTitleValue = oldSponsorTitle ? oldSponsorTitle.value : "";
      if (oldSponsorTitleValue !== (data.section_sponsor_title || "")) {
        changedConfigurations.push({
          key: "section_sponsor_title",
          value: data.section_sponsor_title || "",
          type: "string",
        });
      }

      // Cek perubahan section_sponsor_active
      const oldSponsorActive = oldConfigurations.find(
        (c) =>
          c.key === "section_sponsor_active" &&
          (c.type === "boolean" || typeof c.value === "boolean"),
      );
      const oldSponsorActiveValue = oldSponsorActive
        ? oldSponsorActive.value === true || oldSponsorActive.value === "true"
        : false; // default is false
      if (oldSponsorActiveValue !== data.section_sponsor_active) {
        changedConfigurations.push({
          key: "section_sponsor_active",
          value: data.section_sponsor_active ? true : false,
          type: "boolean",
        });
      }

      // Cek perubahan section_youtube_active
      const oldYoutubeActive = oldConfigurations.find(
        (c) =>
          c.key === "section_youtube_active" &&
          (c.type === "boolean" || typeof c.value === "boolean"),
      );
      const oldYoutubeActiveValue = oldYoutubeActive
        ? oldYoutubeActive.value === true || oldYoutubeActive.value === "true"
        : true; // default is true
      if (oldYoutubeActiveValue !== data.section_youtube_active) {
        changedConfigurations.push({
          key: "section_youtube_active",
          value: data.section_youtube_active ? true : false,
          type: "boolean",
        });
      }

      // Cek perubahan section_socmed_active
      const oldSocmedActive = oldConfigurations.find(
        (c) =>
          c.key === "section_socmed_active" &&
          (c.type === "boolean" || typeof c.value === "boolean"),
      );
      const oldSocmedActiveValue = oldSocmedActive
        ? oldSocmedActive.value === true || oldSocmedActive.value === "true"
        : true;
      if (oldSocmedActiveValue !== data.section_socmed_active) {
        changedConfigurations.push({
          key: "section_socmed_active",
          value: data.section_socmed_active ? true : false,
          type: "boolean",
        });
      }

      // Cek perubahan section_youtube_title
      const oldYoutubeTitle = oldConfigurations.find(
        (c) => c.key === "section_youtube_title" && c.type === "string",
      );
      const oldYoutubeTitleValue = oldYoutubeTitle ? oldYoutubeTitle.value : "";
      if (oldYoutubeTitleValue !== (data.section_youtube_title || "")) {
        changedConfigurations.push({
          key: "section_youtube_title",
          value: data.section_youtube_title || "",
          type: "string",
        });
      }

      // Cek perubahan section_socmed_title
      const oldSocmedTitle = oldConfigurations.find(
        (c) => c.key === "section_socmed_title" && c.type === "string",
      );
      const oldSocmedTitleValue = oldSocmedTitle ? oldSocmedTitle.value : "";
      if (oldSocmedTitleValue !== (data.section_socmed_title || "")) {
        changedConfigurations.push({
          key: "section_socmed_title",
          value: data.section_socmed_title || "",
          type: "string",
        });
      }

      // Cek perubahan video (hanya jika file baru diupload)
      if (videoData) {
        const oldVideo = oldConfigurations.find(
          (c) => c.key === "hero_video_config" && c.type === "file",
        );
        // Bandingkan storageKey dan mimeType saja (url akan diisi server)
        const isVideoChanged =
          !oldVideo ||
          !oldVideo.value ||
          (typeof oldVideo.value === "object" &&
            (oldVideo.value.storageKey !== videoData.storageKey ||
              oldVideo.value.mimeType !== videoData.mimeType));
        if (isVideoChanged) {
          changedConfigurations.push({
            key: "hero_video_config",
            value: {
              storageKey: videoData.storageKey,
              url: "", // URL will be generated by server after S3 upload
              mimeType: videoData.mimeType,
              bucket: bucket, // Ambil dari env
            },
            type: "file",
          });
        }
      }

      // Cek perubahan hero video poster bg (upload only when dirty + file exists)
      if (isHeroVideoPosterBgDirty && heroVideoPosterBgData) {
        const oldFoto = oldConfigurations.find(
          (c) => c.key === "hero_video_poster_bg" && c.type === "file",
        );
        const isFotoChanged =
          !oldFoto ||
          !oldFoto.value ||
          (typeof oldFoto.value === "object" &&
            (oldFoto.value.storageKey !== heroVideoPosterBgData.storageKey ||
              oldFoto.value.mimeType !== heroVideoPosterBgData.mimeType));
        if (isFotoChanged) {
          changedConfigurations.push({
            key: "hero_video_poster_bg",
            value: {
              storageKey: heroVideoPosterBgData.storageKey,
              url: "",
              mimeType: heroVideoPosterBgData.mimeType,
              bucket: bucket,
            },
            type: "file",
          });
        }
      }

      // Cek perubahan fotografi section bg (upload only when dirty + file exists)
      if (isFotografiBgDirty && fotografiBgData) {
        const oldFoto = oldConfigurations.find(
          (c) => c.key === "fotografi_section_bg" && c.type === "file",
        );
        const isFotoChanged =
          !oldFoto ||
          !oldFoto.value ||
          (typeof oldFoto.value === "object" &&
            (oldFoto.value.storageKey !== fotografiBgData.storageKey ||
              oldFoto.value.mimeType !== fotografiBgData.mimeType));
        if (isFotoChanged) {
          changedConfigurations.push({
            key: "fotografi_section_bg",
            value: {
              storageKey: fotografiBgData.storageKey,
              url: "",
              mimeType: fotografiBgData.mimeType,
              bucket: bucket,
            },
            type: "file",
          });
        }
      }

      // Cek perubahan youtube section bg
      if (isYoutubeBgDirty && youtubeBgData) {
        const oldVid = oldConfigurations.find(
          (c) => c.key === "youtube_section_bg" && c.type === "file",
        );
        const isVidChanged =
          !oldVid ||
          !oldVid.value ||
          (typeof oldVid.value === "object" &&
            (oldVid.value.storageKey !== youtubeBgData.storageKey ||
              oldVid.value.mimeType !== youtubeBgData.mimeType));
        if (isVidChanged) {
          changedConfigurations.push({
            key: "youtube_section_bg",
            value: {
              storageKey: youtubeBgData.storageKey,
              url: "",
              mimeType: youtubeBgData.mimeType,
              bucket: bucket,
            },
            type: "file",
          });
        }
      }

      // Cek perubahan socmed section bg
      if (isSocmedBgDirty && socmedBgData) {
        const oldCfg = oldConfigurations.find(
          (c) => c.key === "socmed_section_bg" && c.type === "file",
        );
        const isChanged =
          !oldCfg ||
          !oldCfg.value ||
          (typeof oldCfg.value === "object" &&
            (oldCfg.value.storageKey !== socmedBgData.storageKey ||
              oldCfg.value.mimeType !== socmedBgData.mimeType));
        if (isChanged) {
          changedConfigurations.push({
            key: "socmed_section_bg",
            value: {
              storageKey: socmedBgData.storageKey,
              url: "",
              mimeType: socmedBgData.mimeType,
              bucket,
            },
            type: "file",
          });
        }
      }

      if (changedConfigurations.length === 0) {
        toast("Tidak ada perubahan konfigurasi.");
        setIsSubmitting(false);
        return;
      }

      // Build payload
      const payload: CreateConfigurationPayload = {
        configurations: changedConfigurations,
      };

      console.log("Payload:", payload);

      // Prepare FormData for multipart upload
      const formData = new FormData();
      formData.append("configurations", JSON.stringify(payload.configurations));

      // Append video file if exists dan memang berubah
      if (
        changedConfigurations.some((c) => c.key === "hero_video_config") &&
        videoData
      ) {
        formData.append("hero_video_config", videoData.file);
        if (heroVideoThumbnail) {
          formData.append(
            "hero_video_config_thumbnail",
            heroVideoThumbnail,
            "thumbnail.png",
          );
        }
      }

      // Append hero video poster bg file if exists and changed
      if (
        changedConfigurations.some((c) => c.key === "hero_video_poster_bg") &&
        heroVideoPosterBgData
      ) {
        formData.append("hero_video_poster_bg", heroVideoPosterBgData.file);
      }

      // Append fotografi section bg file if exists and changed
      if (
        changedConfigurations.some((c) => c.key === "fotografi_section_bg") &&
        fotografiBgData
      ) {
        formData.append("fotografi_section_bg", fotografiBgData.file);
      }

      // Append youtube section bg file if exists and changed
      if (
        changedConfigurations.some((c) => c.key === "youtube_section_bg") &&
        youtubeBgData
      ) {
        formData.append("youtube_section_bg", youtubeBgData.file);
      }

      // Append socmed section bg file if exists and changed
      if (
        changedConfigurations.some((c) => c.key === "socmed_section_bg") &&
        socmedBgData
      ) {
        formData.append("socmed_section_bg", socmedBgData.file);
      }

      // Send to API using axios
      try {
        const response = await api.post("/configuration", formData, {
          validateStatus: (status: number) => status < 500,
          timeout: IMAGE_UPLOAD_TIMEOUT_MS,
        });
        console.log("response from API:", response.data);
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
      setHeroVideoFile(null);
      // Synchronize states silently to keep oldConfigurations up-to-date and prevent stale comparisons
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuration</h1>
          <p className="text-muted-foreground">Manage website configuration</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link href="/admin-xyz/configuration/about-us">
            <Button
              type="button"
              variant="outline"
              className="flex items-center gap-2 border-primary/40 hover:border-primary text-primary transition-all"
            >
              Tentang Kami & Kontak
              <SquareArrowOutUpRight className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            onClick={() => form.reset()}
            disabled={isLoadingConfiguration || isSubmitting}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Form
          </Button>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-card rounded-lg border border-border overflow-hidden p-6">
        {isLoadingConfiguration ? (
          // Loading skeleton
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Skeleton for tagline_website field */}
              <div className="space-y-2">
                <div className="h-5 w-20 bg-muted rounded animate-pulse" />
                <div className="h-10 w-full bg-muted rounded animate-pulse" />
              </div>

              {/* Skeleton for video uploader */}
              <div className="space-y-2">
                <div className="h-5 w-32 bg-muted rounded animate-pulse" />
                <div className="h-48 w-full bg-muted rounded animate-pulse" />
              </div>
            </div>
          </div>
        ) : (
          <form
            id="config-form"
            className="w-full space-y-6"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FieldGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
              {/* Tag Line Field */}
              <Controller
                name="tagline_website"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="col-span-1 lg:col-span-6">
                    <FieldLabel htmlFor="tagline_website">Tag Line</FieldLabel>
                    <Input
                      {...field}
                      id="tagline_website"
                      placeholder="Enter tag line"
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

              {/* Grid section — kategori artikel di homepage */}
              <Controller
                name="grid_section_category_slug"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="col-span-1 lg:col-span-6"
                  >
                    <FieldLabel htmlFor="grid_section_category_slug">
                      Grid Section — Kategori
                    </FieldLabel>
                    <Select
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                      disabled={isSubmitting || loadingCategories}
                    >
                      <SelectTrigger
                        id="grid_section_category_slug"
                        className="w-full max-w-md"
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectValue
                          placeholder={
                            loadingCategories
                              ? "Memuat kategori…"
                              : "Pilih kategori"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Artikel grid di beranda diambil dari slug kategori ini
                      (maks. 4 artikel terbaru).
                    </p>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              {/* Copyright Text */}
              <Controller
                name="copyright_text"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="col-span-1 lg:col-span-3"
                  >
                    <FieldLabel htmlFor="copyright_text">
                      Copyright Text
                    </FieldLabel>
                    <Textarea
                      {...field}
                      id="copyright_text"
                      placeholder="© 2025 Arasvara Media. All rights reserved."
                      autoComplete="off"
                      aria-invalid={fieldState.invalid}
                      disabled={isSubmitting}
                      className="min-h-[80px]"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              {/* Meta Description Website */}
              <Controller
                name="meta_description_website"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="col-span-1 lg:col-span-3"
                  >
                    <FieldLabel htmlFor="meta_description_website">
                      Meta Description Website
                    </FieldLabel>
                    <Textarea
                      {...field}
                      id="meta_description_website"
                      placeholder="Masukkan meta deskripsi default untuk website..."
                      autoComplete="off"
                      aria-invalid={fieldState.invalid}
                      disabled={isSubmitting}
                      className="min-h-[80px]"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              {/* WhatsApp Channel */}
              <Controller
                name="whatsapp_channel"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="col-span-1 md:col-span-1 lg:col-span-3"
                  >
                    <FieldLabel htmlFor="whatsapp_channel">
                      WhatsApp Channel (URL)
                    </FieldLabel>
                    <Input
                      {...field}
                      id="whatsapp_channel"
                      placeholder="https://whatsapp.com/channel/..."
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

              {/* Telegram Group */}
              <Controller
                name="telegram_group"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="col-span-1 md:col-span-1 lg:col-span-3"
                  >
                    <FieldLabel htmlFor="telegram_group">
                      Telegram Group (URL)
                    </FieldLabel>
                    <Input
                      {...field}
                      id="telegram_group"
                      placeholder="https://t.me/..."
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

              {/* Judul section beranda */}
              <p className="col-span-1 lg:col-span-6 text-sm font-semibold text-foreground pt-2 border-t border-border">
                Judul section beranda
              </p>

              {/* Section Fotografi Title */}
              <Controller
                name="section_fotografi_title"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="col-span-1 md:col-span-1 lg:col-span-3"
                  >
                    <FieldLabel htmlFor="section_fotografi_title">
                      Fotografi Title
                    </FieldLabel>
                    <Input
                      {...field}
                      id="section_fotografi_title"
                      placeholder="e.g. Arah Lensa"
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

              {/* Section Sponsor Title */}
              <Controller
                name="section_sponsor_title"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="col-span-1 md:col-span-1 lg:col-span-3"
                  >
                    <FieldLabel htmlFor="section_sponsor_title">
                      Section Sponsor Title
                    </FieldLabel>
                    <Input
                      {...field}
                      id="section_sponsor_title"
                      placeholder="Enter section sponsor title"
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

              {/* Section Youtube Title */}
              <Controller
                name="section_youtube_title"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="col-span-1 md:col-span-1 lg:col-span-3"
                  >
                    <FieldLabel htmlFor="section_youtube_title">
                      Section Youtube Title
                    </FieldLabel>
                    <Input
                      {...field}
                      id="section_youtube_title"
                      placeholder="Enter section youtube title"
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

              {/* Section Socmed Title */}
              <Controller
                name="section_socmed_title"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="col-span-1 md:col-span-1 lg:col-span-3"
                  >
                    <FieldLabel htmlFor="section_socmed_title">
                      Section Socmed Title
                    </FieldLabel>
                    <Input
                      {...field}
                      id="section_socmed_title"
                      placeholder="Enter section socmed title"
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

              {/* Section Sponsor Active */}
              <Controller
                name="section_sponsor_active"
                control={form.control}
                render={({ field }) => (
                  <Field className="col-span-1 lg:col-span-3">
                    <FieldLabel htmlFor="section_sponsor_active" className="">
                      Section Sponsor Active
                    </FieldLabel>
                    <div className="flex items-center gap-4">
                      <Switch
                        id="section_sponsor_active"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSubmitting}
                      />
                      <Link
                        href={adminPanelHref("sponsor")}
                        target="_blank"
                        className="flex items-center gap-2 text-sm font-light text-primary hover:text-hijauSawah transition-colors group"
                      >
                        Atur section sponsor
                        <SquareArrowOutUpRight className="w-4 h-4 text-primary/75 group-hover:text-hijauSawah transition-colors" />
                      </Link>
                    </div>
                  </Field>
                )}
              />

              {/* Section Youtube Active */}
              <Controller
                name="section_youtube_active"
                control={form.control}
                render={({ field }) => (
                  <Field className="col-span-1 lg:col-span-3">
                    <FieldLabel htmlFor="section_youtube_active" className="">
                      Section Youtube Active
                    </FieldLabel>
                    <div className="flex items-center gap-4">
                      <Switch
                        id="section_youtube_active"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSubmitting}
                      />
                      <Link
                        href={adminPanelHref("articles/youtube-section")}
                        target="_blank"
                        className="flex items-center gap-2 text-sm font-light text-primary hover:text-hijauSawah transition-colors group"
                      >
                        Atur section youtube
                        <SquareArrowOutUpRight className="w-4 h-4 text-primary/75 group-hover:text-hijauSawah transition-colors" />
                      </Link>
                    </div>
                  </Field>
                )}
              />

              {/* Section Socmed Active */}
              <Controller
                name="section_socmed_active"
                control={form.control}
                render={({ field }) => (
                  <Field className="col-span-1 lg:col-span-3">
                    <FieldLabel htmlFor="section_socmed_active" className="">
                      Section Socmed Active
                    </FieldLabel>
                    <div className="flex items-center gap-4">
                      <Switch
                        id="section_socmed_active"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSubmitting}
                      />
                      <Link
                        href={adminPanelHref("articles/socmed")}
                        target="_blank"
                        className="flex items-center gap-2 text-sm font-light text-primary hover:text-hijauSawah transition-colors group"
                      >
                        Atur section socmed
                        <SquareArrowOutUpRight className="w-4 h-4 text-primary/75 group-hover:text-hijauSawah transition-colors" />
                      </Link>
                    </div>
                  </Field>
                )}
              />
            </FieldGroup>

            <FieldGroup className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* Video Hero Uploader */}
              <VideoHeroUploader
                onVideoSelect={setHeroVideoFile}
                defaultKey="hero_video_config"
                defaultThumbnailUrl={defaultThumbnailUrl}
                defaultVideoUrl={defaultVideoUrl}
              />

              {/* Hero Video Poster Background */}
              <ImageDropZone
                label="Hero Video Poster Background"
                previewUrl={heroVideoPosterBgPreview}
                disabled={isSubmitting}
                onFileAccepted={handleHeroVideoPosterBgAccepted}
                onRemove={handleHeroVideoPosterBgRemove}
              />

              {/* Fotografi / YouTube / TikTok / Instagram Section Backgrounds */}
              <ImageDropZone
                label="Fotografi Section Background"
                previewUrl={fotografiBgPreview}
                disabled={isSubmitting}
                onFileAccepted={handleFotografiAccepted}
                onRemove={handleFotografiRemove}
              />
              <ImageDropZone
                label="Youtube Section Background"
                previewUrl={youtubeBgPreview}
                disabled={isSubmitting}
                onFileAccepted={handleYoutubeAccepted}
                onRemove={handleYoutubeRemove}
              />
              <ImageDropZone
                label="Socmed Section Background"
                previewUrl={socmedBgPreview}
                disabled={isSubmitting}
                onFileAccepted={handleSocmedAccepted}
                onRemove={handleSocmedRemove}
              />
            </FieldGroup>

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-6 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  form.reset();
                  setHeroVideoFile(null);
                  await removeVideoFromIndexedDB("hero_video_config");
                  await removeVideoFromIndexedDB("hero_video_config_thumbnail");
                  await removeVideoFromIndexedDB("hero_video_poster_bg");
                  await removeVideoFromIndexedDB("fotografi_section_bg");
                  await removeVideoFromIndexedDB("youtube_section_bg");
                  await removeVideoFromIndexedDB("socmed_section_bg");
                }}
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

export default ConfigurationPage;
