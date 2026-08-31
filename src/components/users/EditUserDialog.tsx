import React, { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDropzone } from "react-dropzone";
import { get as idbGet, del as idbDel } from "idb-keyval";
import { setDraftImage } from "@/lib/image/draftImageStorage";
import { toast } from "sonner";
import api from "@/lib/axios";
import { getApiErrorMessage } from "@/lib/api-error";
import FormUserDialogUi from "./FormUserDialogUi";
import { useCurrentUser } from "@/hooks/useCurrentUser";
// import { ROLES } from "@/lib/constants";
import { Team } from "@/types/team";
import { User } from "@/types/user";
import { formatCoverageAreas, JOB_TITLE_MAX } from "@/lib/user-profile-fields";
import { prepareImageForCrop } from "@/lib/image/prepareImageForCrop";
import {
  IMAGE_DROPZONE_ACCEPT,
  isProbablyImageFile,
} from "@/lib/image/isProbablyImageFile";
import { IMAGE_UPLOAD_TIMEOUT_MS } from "@/lib/image/uploadTimeout";

const DRAFT_KEY = "draftEditUser";
const IDB_AVATAR_KEY = "draftEditUserAvatar";


const schema = z.object({
  name: z.string().min(1, "Name is required"),
  password: z.string().optional(),
  teamId: z.string().optional(),
  bio: z.string().optional(),
  jobTitle: z.string().max(JOB_TITLE_MAX).optional(),
  coverageAreas: z.string().optional(),
  isActive: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  onUpdated?: () => void;
}

export default function EditUserDialog({
  open,
  onOpenChange,
  user,
  onUpdated,
}: EditUserDialogProps) {
  // Teams state
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar ? (typeof user.avatar === "string" ? user.avatar : user.avatar.url) : null);
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);


  const {
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user.name || "",
      password: "",
      teamId: (user.team?._id ? String(user.team._id) : ""),
      bio: user.bio || "",
      jobTitle: user.jobTitle || "",
      coverageAreas: formatCoverageAreas(user.coverageAreas),
      isActive: user.isActive ?? true,
    },
  });
  // Fetch teams on open
  useEffect(() => {
    if (!open) return;
    setTeamsLoading(true);
    api.get("/teams?limit=1000").then((res) => {
      setTeams(res.data?.teams || []);
    }).catch(() => {
      setTeams([]);
    }).finally(() => {
      setTeamsLoading(false);
    });
  }, [open]);

  const values = watch();

  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY + user._id);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<FormValues>;
        (Object.keys(draft) as (keyof FormValues)[]).forEach((k) => {
          if (draft[k] !== undefined) setValue(k, draft[k] as never);
        });
      }
    } catch {
      /* ignore malformed draft */
    }
    idbGet<Blob>(IDB_AVATAR_KEY + user._id).then((blob) => {
      if (blob) {
        setAvatarBlob(blob);
        setAvatarPreview(URL.createObjectURL(blob));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user._id]);

  useEffect(() => {
    if (!open) return;
    const { unsubscribe } = watch((v) => {
      try {
        localStorage.setItem(DRAFT_KEY + user._id, JSON.stringify(v));
      } catch {
        /* ignore */
      }
    });
    return () => unsubscribe();
  }, [open, watch, user._id]);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDrop = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const file = files[0];
      if (!isProbablyImageFile(file)) {
        toast.error("Hanya file gambar yang diizinkan");
        return;
      }
      try {
        const objectUrl = await prepareImageForCrop(file);
        if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
        setRawImageSrc(objectUrl);
        setCropOpen(true);
      } catch {
        toast.error(
          "Gambar tidak dapat dimuat. Coba lagi atau gunakan format JPEG/PNG/WebP.",
        );
      }
    },
    [rawImageSrc],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: IMAGE_DROPZONE_ACCEPT,
    useFsAccessApi: false,
    maxFiles: 1,
    multiple: false,
  });

  const handleCropDone = useCallback(
    async (blob: Blob) => {
      setCropOpen(false);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
      setRawImageSrc(null);
      setAvatarBlob(blob);
      setAvatarPreview(URL.createObjectURL(blob));
      await setDraftImage(IDB_AVATAR_KEY + user._id, blob);
    },
    [avatarPreview, rawImageSrc, user._id],
  );

  const handleCropCancel = useCallback(() => {
    setCropOpen(false);
    if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
    setRawImageSrc(null);
  }, [rawImageSrc]);

  const handleRemoveAvatar = useCallback(async () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarBlob(null);
    setAvatarPreview(null);
    await idbDel(IDB_AVATAR_KEY + user._id);
  }, [avatarPreview, user._id]);

  const handleClearDraft = useCallback(async () => {
    reset();
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarBlob(null);
    setAvatarPreview(null);
    localStorage.removeItem(DRAFT_KEY + user._id);
    await idbDel(IDB_AVATAR_KEY + user._id);
    toast.info("Draft cleared");
  }, [reset, avatarPreview, user._id]);

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        if (k === "password" && !v) return; // skip empty password
        if (k === "email") return; // never send email in edit
        if (k === "teamId" && (!v || v === "no-team")) return; // skip if no team
        formData.append(k, String(v));
      });
      // Always send teamId, even if empty, to allow unassigning team
      if (!data.teamId || data.teamId === "no-team") {
        formData.append("teamId", "");
      }
      if (avatarBlob) formData.append("avatar", avatarBlob, "avatar.webp");

      const response = await api.patch(`/users/${user._id}`, formData, {
        validateStatus: (status: number) => status < 500,
        timeout: IMAGE_UPLOAD_TIMEOUT_MS,
      });

      if (response.status >= 400) {
        toast.error(
          getApiErrorMessage({ response }, "Gagal mengupdate user"),
        );
        return;
      }

      toast.success("User updated successfully");
      // --- cleanup ---
      reset();
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarBlob(null);
      setAvatarPreview(null);
      localStorage.removeItem(DRAFT_KEY + user._id);
      await idbDel(IDB_AVATAR_KEY + user._id);
      onOpenChange(false);
      onUpdated?.();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Gagal mengupdate user"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleValueChange = (field: string, value: string | boolean) => {
    setValue(field as keyof FormValues, value as never, { shouldValidate: true, shouldDirty: true });
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleFormSubmit = handleSubmit(onSubmit);

  // Ambil user login
  const { data: currentUser } = useCurrentUser();
  // Cek apakah user yang diedit adalah dirinya sendiri
  const isSelf = currentUser && (user._id === currentUser._id || user.email === currentUser.email);

  return (
    <FormUserDialogUi
      open={open}
      onOpenChange={onOpenChange}
      mode="edit"
      values={{
        name: values.name,
        password: values.password,
        teamId: values.teamId,
        bio: values.bio,
        jobTitle: values.jobTitle,
        coverageAreas: values.coverageAreas,
        isActive: values.isActive,
        // Provide role for type compatibility, but not used in edit UI
        role: user.role || "subscriber",
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
      teams={teams}
      teamsLoading={teamsLoading}
      ROLES={[]}
      submitLabel={"Update User"}
      canEditIsActive={!isSelf}
    />
  );
}
