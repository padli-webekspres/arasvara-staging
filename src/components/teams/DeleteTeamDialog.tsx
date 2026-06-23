"use client";

import { useState } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import api from "@/lib/axios";
import type { Team } from "@/types/team";

// ── Props ─────────────────────────────────────────────────────────────────────
export interface DeleteTeamDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    team: Team;
    onDeleted?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DeleteTeamDialog({
    open,
    onOpenChange,
    team,
    onDeleted,
}: DeleteTeamDialogProps) {
    const [deleting, setDeleting] = useState(false);

    // ── Handle delete confirmation ────────────────────────────────────────────
    const handleConfirmDelete = async () => {
        setDeleting(true);
        try {
            const response = await api.delete(`/teams/${team._id}`, {
                validateStatus: (status: number) => status < 500,
            });

            if (response.status >= 400) {
                const msg = response.data?.error || "Gagal menghapus tim";
                toast.error(msg);
                return;
            }

            toast.success("Tim berhasil dihapus");
            onOpenChange(false);
            onDeleted?.();
        } catch (err: unknown) {
            let msg = "Gagal menghapus tim";
            if (err && typeof err === "object") {
                // @ts-expect-error: dynamic error shape
                msg = err?.response?.data?.error || err?.message || msg;
            }
            toast.error(msg);
        } finally {
            setDeleting(false);
        }
    };

    // ── Handle cancel ─────────────────────────────────────────────────────────
    const handleCancel = () => {
        onOpenChange(false);
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Hapus Tim?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Anda yakin ingin menghapus tim &quot;{team.name}&quot;? Aksi ini
                        tidak bisa dibatalkan.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex gap-2 justify-end">
                    <AlertDialogCancel onClick={handleCancel} disabled={deleting}>
                        Batal
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirmDelete}
                        disabled={deleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {deleting ? "Menghapus..." : "Hapus"}
                    </AlertDialogAction>
                </div>
            </AlertDialogContent>
        </AlertDialog>
    );
}
