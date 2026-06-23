"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import api from "@/lib/axios";
import FormTeamDialogUi from "./FormTeamDialogUi";

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(1, "Nama tim diperlukan"),
});

type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────
export interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CreateTeamDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateTeamDialogProps) {
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
      name: "",
    },
  });

  const values = watch();

  // ── Submit handler ────────────────────────────────────────────────────────
  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      const response = await api.post("/teams", data, {
        validateStatus: (status: number) => status < 500,
      });

      if (response.status >= 400) {
        const msg = response.data?.error || "Gagal membuat tim";
        toast.error(msg);
        return;
      }

      toast.success("Tim berhasil dibuat");
      reset();
      onOpenChange(false);
      onCreated?.();
    } catch (err: unknown) {
      let msg = "Gagal membuat tim";
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
      mode="create"
      values={{
        name: values.name,
      }}
      errors={errors as Record<string, { message?: string }>}
      submitting={submitting}
      onSubmit={handleFormSubmit}
      onCancel={handleCancel}
      onValueChange={handleValueChange}
    />
  );
}
