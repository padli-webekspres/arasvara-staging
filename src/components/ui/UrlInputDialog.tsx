"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Satu field URL (YouTube, embed sosial, dll.) */
export type UrlInputDialogSingleProps = {
  mode?: "single";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  onConfirm: (url: string) => void;
};

/** Sisipkan tautan: teks tampilan + URL */
export type UrlInputDialogLinkProps = {
  mode: "link";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  linkTextLabel?: string;
  urlLabel?: string;
  linkTextPlaceholder?: string;
  urlPlaceholder?: string;
  onConfirm: (payload: { linkText: string; url: string }) => void;
};

export type UrlInputDialogProps = UrlInputDialogSingleProps | UrlInputDialogLinkProps;

export function UrlInputDialog(props: UrlInputDialogProps) {
  const isLink = props.mode === "link";

  const [singleValue, setSingleValue] = useState("");
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const singleRef = useRef<HTMLInputElement>(null);
  const linkTextRef = useRef<HTMLInputElement>(null);
  const linkUrlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!props.open) return;
    if (isLink) {
      setLinkText("");
      setLinkUrl("");
      setTimeout(() => linkTextRef.current?.focus(), 50);
    } else {
      setSingleValue("");
      setTimeout(() => singleRef.current?.focus(), 50);
    }
  }, [props.open, isLink]);

  const handleConfirm = () => {
    if (isLink) {
      const url = linkUrl.trim();
      if (!url) return;
      const text = linkText.trim();
      props.onConfirm({ linkText: text, url });
      props.onOpenChange(false);
      return;
    }
    const trimmed = singleValue.trim();
    if (!trimmed) return;
    props.onConfirm(trimmed);
    props.onOpenChange(false);
  };

  const onKeyDownSingle = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    }
    if (e.key === "Escape") {
      props.onOpenChange(false);
    }
  };

  const onKeyDownLinkText = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      linkUrlRef.current?.focus();
    }
    if (e.key === "Escape") {
      props.onOpenChange(false);
    }
  };

  const onKeyDownLinkUrl = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    }
    if (e.key === "Escape") {
      props.onOpenChange(false);
    }
  };

  const canSubmit = isLink
    ? Boolean(linkUrl.trim())
    : Boolean(singleValue.trim());

  const title = props.title;
  const description = props.description;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {isLink ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url-dialog-link-text">
                {props.linkTextLabel ?? "Teks yang ditampilkan"}
              </Label>
              <Input
                id="url-dialog-link-text"
                ref={linkTextRef}
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                onKeyDown={onKeyDownLinkText}
                placeholder={props.linkTextPlaceholder ?? "Teks tautan"}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url-dialog-link-url">
                {props.urlLabel ?? "URL"}
              </Label>
              <Input
                id="url-dialog-link-url"
                ref={linkUrlRef}
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={onKeyDownLinkUrl}
                placeholder={props.urlPlaceholder ?? "https://..."}
                autoComplete="off"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="url-input-dialog">
              {props.label ?? "URL"}
            </Label>
            <Input
              id="url-input-dialog"
              ref={singleRef}
              value={singleValue}
              onChange={(e) => setSingleValue(e.target.value)}
              onKeyDown={onKeyDownSingle}
              placeholder={props.placeholder ?? "https://..."}
              autoComplete="off"
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit}>
            Insert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
