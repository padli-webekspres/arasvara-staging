
"use client";

import React from "react";
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

// ── Types ────────────────────────────────────────────────────────────────────
export interface FormTeamDialogUiProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  values: {
    name: string;
  };
  errors: Record<string, { message?: string }>;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onValueChange: (field: string, value: string) => void;
  submitLabel?: string;
  submitDisabled?: boolean;
}

// ── UI Component ─────────────────────────────────────────────────────────────
const FormTeamDialogUi: React.FC<FormTeamDialogUiProps> = ({
  open,
  onOpenChange,
  mode,
  values,
  errors,
  submitting,
  onSubmit,
  onCancel,
  onValueChange,
  submitLabel,
  submitDisabled = false,
}) => {
  // ── Determine dialog title and submit button label based on mode ─────────
  const dialogTitle = mode === "edit" ? "Edit Tim" : "Buat Tim Baru";
  const submitText = submitLabel || (mode === "edit" ? "Update Tim" : "Buat Tim");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5 py-4">
          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="team-name">
              Nama Tim <span className="text-destructive">*</span>
            </Label>
            <Input
              id="team-name"
              placeholder="Masukkan nama tim..."
              autoComplete="off"
              value={values.name}
              onChange={(e) => onValueChange("name", e.target.value)}
              disabled={submitting}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Footer Buttons */}
          <DialogFooter className="gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitDisabled || submitting}>
              {submitting ? "Memproses..." : submitText}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default FormTeamDialogUi;
