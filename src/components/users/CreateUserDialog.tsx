"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDropzone } from "react-dropzone";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import { ROLES } from "@/lib/constants";
import { toast } from "sonner";
import api from "@/lib/axios";
import { Team } from "@/types/team";
import FormUserDialogUi from "./FormUserDialogUi";

// ── Constants ─────────────────────────────────────────────────────────────────
const DRAFT_KEY = "draftCreateUser";
const IDB_AVATAR_KEY = "draftCreateUserAvatar";

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.string().min(1, "Please select a role"),
  bio: z.string().optional(),
  teamId: z.string().optional(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────
export interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateUserDialogProps) {
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  const {
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "subscriber",
      bio: "",
      teamId: "",
      isActive: true,
    },
  });

  const values = watch();

  // ── Load draft on open ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<FormValues>;
        (Object.keys(draft) as (keyof FormValues)[]).forEach((k) => {
          if (draft[k] !== undefined) setValue(k, draft[k] as never);
        });
      }
    } catch {
      /* ignore malformed draft */
    }
    idbGet<Blob>(IDB_AVATAR_KEY).then((blob) => {
      if (blob) {
        setAvatarBlob(blob);
        setAvatarPreview(URL.createObjectURL(blob));
      }
    });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch teams on open ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const fetchTeams = async () => {
      try {
        setTeamsLoading(true);
        const response = await api.get("/teams", { params: { limit: 100 } });
        setTeams(response.data.teams || []);
      } catch (error) {
        console.error("Failed to fetch teams:", error);
        setTeams([]);
      } finally {
        setTeamsLoading(false);
      }
    };
    fetchTeams();
  }, [open]);

  // ── Persist draft on every field change ──────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const { unsubscribe } = watch((v) => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(v));
      } catch {
        /* ignore */
      }
    });
    return () => unsubscribe();
  }, [open, watch]);

  // ── Revoke object URLs on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dropzone ──────────────────────────────────────────────────────────────
  const onDrop = useCallback((files: File[]) => {
    if (!files.length) return;
    setRawImageSrc(URL.createObjectURL(files[0]));
    setCropOpen(true);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
    multiple: false,
  });

  // ── Crop done ─────────────────────────────────────────────────────────────
  const handleCropDone = useCallback(
    async (blob: Blob) => {
      setCropOpen(false);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
      setRawImageSrc(null);
      setAvatarBlob(blob);
      setAvatarPreview(URL.createObjectURL(blob));
      await idbSet(IDB_AVATAR_KEY, blob);
    },
    [avatarPreview, rawImageSrc],
  );

  const handleCropCancel = useCallback(() => {
    setCropOpen(false);
    if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
    setRawImageSrc(null);
  }, [rawImageSrc]);

  // ── Remove avatar ─────────────────────────────────────────────────────────
  const handleRemoveAvatar = useCallback(async () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarBlob(null);
    setAvatarPreview(null);
    await idbDel(IDB_AVATAR_KEY);
  }, [avatarPreview]);

  // ── Clear all drafts ──────────────────────────────────────────────────────
  const handleClearDraft = useCallback(async () => {
    reset();
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarBlob(null);
    setAvatarPreview(null);
    localStorage.removeItem(DRAFT_KEY);
    await idbDel(IDB_AVATAR_KEY);
    toast.info("Draft cleared");
  }, [reset, avatarPreview]);

  // ── Submit (integrasi backend) ─────────────────────────────────────────────
  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([k, v]) => formData.append(k, String(v)));
      if (avatarBlob) formData.append("avatar", avatarBlob, "avatar.webp");

      const response = await api.post("/users", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        validateStatus: (status: number) => status < 500, // handle 4xx as resolved
      });

      if (response.status >= 400) {
        const msg = response.data?.error || "Gagal membuat user";
        toast.error(msg);
        return;
      }

      toast.success("User created successfully");
      // --- cleanup ---
      reset();
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarBlob(null);
      setAvatarPreview(null);
      localStorage.removeItem(DRAFT_KEY);
      await idbDel(IDB_AVATAR_KEY);
      onOpenChange(false);
      onCreated?.();
    } catch (err: unknown) {
      let msg = "Gagal membuat user";
      if (err && typeof err === "object") {
        // @ts-expect-error: dynamic error shape
        msg = err?.response?.data?.error || err?.message || msg;
      }
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Handler for value changes in the form fields
  const handleValueChange = (field: string, value: string | boolean) => {
    setValue(field as keyof FormValues, value as never, { shouldValidate: true, shouldDirty: true });
  };

  // Handler for cancel button (close dialog)
  const handleCancel = () => {
    onOpenChange(false);
  };

  // Handler for form submit (wrap handleSubmit)
  const handleFormSubmit = handleSubmit(onSubmit);

  return (
    <FormUserDialogUi
      open={open}
      onOpenChange={onOpenChange}
      mode="create"
      values={{
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role,
        bio: values.bio,
        teamId: values.teamId,
        isActive: values.isActive,
      }}
      errors={errors as Record<string, { message?: string }>}
      submitting={submitting}
      onSubmit={handleFormSubmit}
      onClearDraft={handleClearDraft}
      onCancel={handleCancel}
      onValueChange={handleValueChange}
      avatarPreview={avatarPreview}
      onRemoveAvatar={handleRemoveAvatar}
      cropOpen={cropOpen}
      rawImageSrc={rawImageSrc}
      onCropDone={handleCropDone}
      onCropCancel={handleCropCancel}
      isDragActive={isDragActive}
      getRootProps={getRootProps}
      getInputProps={getInputProps}
      ROLES={ROLES}
      teams={teams}
      teamsLoading={teamsLoading}
    />
  );
}
