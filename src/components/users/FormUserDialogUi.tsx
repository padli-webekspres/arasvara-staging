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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Team } from "@/types/team";
import CropImageModal from "./CropImageModal";
import { ImageIcon, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateUserSlug } from "@/lib/user-validation";
import Image from "next/image";

// ── Types ────────────────────────────────────────────────────────────────────
export interface FormUserDialogUiProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  values: {
    name: string;
    email?: string;
    password?: string;
    role: string;
    bio?: string;
    teamId?: string;
    isActive: boolean;
  };
  errors: Record<string, { message?: string }>;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClearDraft: () => void;
  onCancel: () => void;
  onValueChange: (field: string, value: string | boolean) => void;
  avatarPreview: string | null;
  onRemoveAvatar: () => void;
  cropOpen: boolean;
  rawImageSrc: string | null;
  onCropDone: (blob: Blob) => void;
  onCropCancel: () => void;
  isDragActive: boolean;
  getRootProps: () => React.HTMLAttributes<HTMLDivElement>;
  getInputProps: () => React.InputHTMLAttributes<HTMLInputElement>;
  ROLES: Array<{ value: string; label: string }>;
  submitLabel?: string;
  canEditIsActive?: boolean; // default true
  teams?: Team[];
  teamsLoading?: boolean;
  // End of FormUserDialogUiProps interface
}

// ── UI Component ─────────────────────────────────────────────────────────────

const FormUserDialogUi: React.FC<FormUserDialogUiProps> = ({
  open,
  onOpenChange,
  mode,
  values,
  errors,
  submitting,
  onSubmit,
  onClearDraft,
  onCancel,
  onValueChange,
  avatarPreview,
  onRemoveAvatar,
  cropOpen,
  rawImageSrc,
  onCropDone,
  onCropCancel,
  isDragActive,
  getRootProps,
  getInputProps,
  ROLES,
  submitLabel,
  canEditIsActive = true,
  teams = [],
  teamsLoading = false,
}) => {
  // Determine dialog title and submit button label based on mode
  const dialogTitle = mode === "edit" ? "Edit User" : "Create New User";
  const submitText = submitLabel || (mode === "edit" ? "Update User" : "Create User");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-5 py-1">
            {/* Avatar Upload Section */}
            <div className="space-y-2">
              <Label>Avatar</Label>
              {avatarPreview ? (
                <div className="flex items-center gap-4">
                  <Image
                    unoptimized
                    src={avatarPreview}
                    alt="Avatar preview"
                    width={480}
                    height={480}
                    className="h-20 w-20 shrink-0 rounded-full border-2 border-border object-cover"
                  />
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">
                      Avatar cropped and ready.
                    </p>
                    <div className="flex gap-2">
                      {/* Replace — re-opens dropzone without removing current preview */}
                      <div {...getRootProps()}>
                        <input {...getInputProps()} />
                        <Button type="button" variant="outline" size="sm">
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                          Replace
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={onRemoveAvatar}
                      >
                        <X className="mr-1.5 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  {...getRootProps()}
                  className={cn(
                    "flex w-full cursor-pointer select-none flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 transition-colors",
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/30",
                  )}
                >
                  <input {...getInputProps()} />
                  <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {isDragActive
                      ? "Drop image here…"
                      : "Drag & drop or click to upload"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PNG, JPG, WEBP — will be cropped square
                  </p>
                </div>
              )}
            </div>

            {/* Full Name Field */}
            <div className="space-y-1.5">
              <Label htmlFor="cu-name">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cu-name"
                placeholder="e.g. John Doe"
                autoComplete="off"
                value={values.name}
                onChange={(e) => onValueChange("name", e.target.value)}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
              {values.name.trim() && (
                <p className="text-xs text-muted-foreground">
                  URL penulis: /author/
                  {generateUserSlug(values.name) || "—"}
                  <span className="block mt-0.5">
                    Preview; slug final bisa berbeda jika nama bentrok (mis.
                    suffix -2).
                  </span>
                </p>
              )}
            </div>

            {/* Email Field (only in create mode) */}
            {mode === "create" && (
              <div className="space-y-1.5">
                <Label htmlFor="cu-email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cu-email"
                  type="email"
                  placeholder="john@arasvara.com"
                  autoComplete="off"
                  value={values.email}
                  onChange={(e) => onValueChange("email", e.target.value)}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>
            )}

            {/* Password Field (only in create mode) */}
            {mode === "create" && (
              <div className="space-y-1.5">
                <Label htmlFor="cu-password">
                  Password <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cu-password"
                  type="password"
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  value={values.password || ""}
                  onChange={(e) => onValueChange("password", e.target.value)}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>
            )}

            {/* Role Field (only in create mode) */}
            {mode === "create" && (
              <div className="space-y-1.5 w-full">
                <Label htmlFor="cu-role">
                  Role <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={values.role}
                  onValueChange={(v) => onValueChange("role", v)}
                >
                  <SelectTrigger id="cu-role" className="w-full">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.role && (
                  <p className="text-xs text-destructive">
                    {errors.role.message}
                  </p>
                )}
              </div>
            )}

            {/* Team Field (in create & edit mode) */}
            {(mode === "create" || mode === "edit") && (
              <div className="space-y-1.5 w-full">
                <Label htmlFor="cu-team">Team</Label>
                <Select
                  value={values.teamId === undefined || values.teamId === "" ? "no-team" : values.teamId}
                  onValueChange={(v) => onValueChange("teamId", v === "no-team" ? "" : v)}
                  disabled={teamsLoading}
                >
                  <SelectTrigger id="cu-team" className="w-full">
                    <SelectValue placeholder="Select a team (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-team">Tanpa Tim</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team._id as string} value={team._id as string}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Bio Field */}
            <div className="space-y-1.5">
              <Label htmlFor="cu-bio">Bio</Label>
              <Textarea
                id="cu-bio"
                placeholder="Short bio (optional)"
                rows={3}
                value={values.bio || ""}
                onChange={(e) => onValueChange("bio", e.target.value)}
              />
            </div>

            {/* Active Toggle */}
            {canEditIsActive && (
              <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Active Account</p>
                  <p className="text-xs text-muted-foreground">
                    User can log in immediately after creation
                  </p>
                </div>
                <Switch
                  checked={values.isActive}
                  onCheckedChange={(v) => onValueChange("isActive", v)}
                />
              </div>
            )}

            {/* Footer Buttons */}
            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mr-auto text-xs text-muted-foreground hover:text-destructive"
                onClick={onClearDraft}
                disabled={submitting}
              >
                Clear Draft
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (mode === "edit" ? "Updating…" : "Creating…") : submitText}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Crop modal — rendered as sibling to stack on top of main dialog */}
      {rawImageSrc && (
        <CropImageModal
          open={cropOpen}
          imageSrc={rawImageSrc}
          onCrop={onCropDone}
          onCancel={onCropCancel}
        />
      )}
    </>
  );
};

export default FormUserDialogUi;
