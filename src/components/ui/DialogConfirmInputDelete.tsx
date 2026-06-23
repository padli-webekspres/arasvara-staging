"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

interface DialogConfirmInputDeleteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onConfirm: () => void;
  loading?: boolean;
}

export default function DialogConfirmInputDelete({
  open,
  onOpenChange,
  email,
  onConfirm,
  loading,
}: DialogConfirmInputDeleteProps) {
  const [input, setInput] = useState("");
  const isMatch = input.trim() === email;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this user?</AlertDialogTitle>
          <AlertDialogDescription>
            <span style={{ userSelect: "none", WebkitUserSelect: "none" }}>
              Untuk menghapus user ini, ketikkan email <strong>{email}</strong>{" "}
              di bawah. Tindakan ini tidak dapat dibatalkan.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          autoFocus
          placeholder="Type email to confirm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          style={{ userSelect: "none", WebkitUserSelect: "none" }}
          onPaste={(e) => e.preventDefault()}
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={!isMatch || loading}
            variant="destructive"
          >
            Yes, Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
