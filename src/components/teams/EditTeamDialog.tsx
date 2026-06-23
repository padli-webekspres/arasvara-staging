"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import api from "@/lib/axios";
import FormTeamDialogUi from "./FormTeamDialogUi";
import type { Team } from "@/types/team";

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(1, "Nama tim diperlukan"),
});

type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────
export interface EditTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team;
  onUpdated?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function EditTeamDialog({
  open,
  onOpenChange,
  team,
  onUpdated,
}: EditTeamDialogProps) {
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
      name: team.name,
    },
  });

  const values = watch();

  // ── Track original name untuk detect changes ────────────────────────────────
  const originalName = team.name;
  const isChanged = values.name !== originalName && values.name.trim() !== "";
  const isDisabled = !isChanged || submitting;

  // ── Reset form jika dialog dibuka ──────────────────────────────────────────
  useEffect(() => {
    if (open) {
      reset({ name: team.name });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, team._id]);

  // ── Submit handler ────────────────────────────────────────────────────────
  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      const response = await api.patch(`/teams/${team._id}`, data, {
        validateStatus: (status: number) => status < 500,
      });

      if (response.status >= 400) {
        const msg = response.data?.error || "Gagal mengupdate tim";
        toast.error(msg);
        return;
      }

      toast.success("Tim berhasil diupdate");
      reset();
      onOpenChange(false);
      onUpdated?.();
    } catch (err: unknown) {
      let msg = "Gagal mengupdate tim";
      if (err && typeof err === "object") {
        // @ts-expect-error: dynamic error shape
        msg = err?.response?.data?.error || err?.message || msg;
      }
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Handler for value changes ─────────────────────────────────────────────
  const handleValueChange = (field: string, value: string) => {
    setValue(field as keyof FormValues, value as never, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  // ── Handler for cancel button ─────────────────────────────────────────────
  const handleCancel = () => {
    reset();
    onOpenChange(false);
  };

  // ── Handler for form submit ───────────────────────────────────────────────
  const handleFormSubmit = handleSubmit(onSubmit);

  return (
    <FormTeamDialogUi
      open={open}
      onOpenChange={onOpenChange}
      mode="edit"
      values={{
        name: values.name,
      }}
      errors={errors as Record<string, { message?: string }>}
      submitting={submitting}
      onSubmit={handleFormSubmit}
      onCancel={handleCancel}
      onValueChange={handleValueChange}
      submitLabel="Update Tim"
      submitDisabled={isDisabled}
    />
  );
}
