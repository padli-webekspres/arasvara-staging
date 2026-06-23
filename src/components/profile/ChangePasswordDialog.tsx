"use client";

import React, { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import api from "@/lib/axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId?: string;
  isAdminPageReset?: boolean;
}

export default function ChangePasswordDialog({
  open,
  onOpenChange,
  targetUserId,
  isAdminPageReset = false,
}: ChangePasswordDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const isAdminReset = !!targetUserId || isAdminPageReset;

  const schema = useMemo(() => {
    return z
      .object({
        oldPassword: isAdminReset
          ? z.string().optional()
          : z.string().min(8, "Password lama minimal 8 karakter"),
        newPassword: z.string().min(8, "Password baru minimal 8 karakter"),
        confirmPassword: z.string().min(8, "Konfirmasi password baru minimal 8 karakter"),
      })
      .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Konfirmasi password baru tidak cocok",
        path: ["confirmPassword"],
      });
  }, [isAdminReset]);

  type ChangePasswordValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ChangePasswordValues) => {
    setSubmitting(true);
    try {
      const response = await api.post("/auth/change-password", {
        oldPassword: isAdminReset ? undefined : data.oldPassword,
        newPassword: data.newPassword,
        targetUserId,
        isAdminPageReset,
      }, {
        validateStatus: (status) => status < 500,
      });

      if (response.status >= 400) {
        const errMsg = response.data?.error || "Gagal mengubah password";
        toast.error(errMsg);
        return;
      }

      toast.success(response.data?.message || "Password berhasil diperbarui!");
      reset();
      onOpenChange(false);
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.message || "Terjadi kesalahan koneksi";
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isAdminReset ? "Reset Password Pengguna" : "Ganti Password"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Password Lama (Hanya jika bukan Admin Reset) */}
          {!isAdminReset && (
            <div className="space-y-1.5">
              <Label htmlFor="cp-oldPassword">Password Lama</Label>
              <Input
                id="cp-oldPassword"
                type="password"
                placeholder="Masukkan password saat ini"
                autoComplete="current-password"
                disabled={submitting}
                {...register("oldPassword")}
              />
              {errors.oldPassword && (
                <p className="text-xs text-destructive">
                  {errors.oldPassword.message}
                </p>
              )}
            </div>
          )}

          {/* Password Baru */}
          <div className="space-y-1.5">
            <Label htmlFor="cp-newPassword">Password Baru</Label>
            <Input
              id="cp-newPassword"
              type="password"
              placeholder="Masukkan password baru (min. 8 karakter)"
              autoComplete="new-password"
              disabled={submitting}
              {...register("newPassword")}
            />
            {errors.newPassword && (
              <p className="text-xs text-destructive">
                {errors.newPassword.message}
              </p>
            )}
          </div>

          {/* Konfirmasi Password Baru */}
          <div className="space-y-1.5">
            <Label htmlFor="cp-confirmPassword">Konfirmasi Password Baru</Label>
            <Input
              id="cp-confirmPassword"
              type="password"
              placeholder="Ulangi password baru Anda"
              autoComplete="new-password"
              disabled={submitting}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Footer Buttons */}
          <DialogFooter className="gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Memproses…" : "Ganti Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
