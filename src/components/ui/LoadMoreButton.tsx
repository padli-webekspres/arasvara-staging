"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export const VIEW_MORE_NEWS_TEXT = "Lihat Berita Lainnya";

type LoadMoreButtonVariant = "hijauSawah" | "default";

const variantClassName: Record<LoadMoreButtonVariant, string> = {
  hijauSawah: "bg-hijauSawah hover:bg-hijauSawah/75",
  default: "hover:bg-hijauSawah hover:rounded-full",
};

type LoadMoreButtonBaseProps = {
  text?: string;
  variant?: LoadMoreButtonVariant;
  className?: string;
  wrapperClassName?: string;
};

type LoadMoreButtonLinkProps = LoadMoreButtonBaseProps & {
  href: string;
  onClick?: never;
  disabled?: never;
  loadingText?: never;
};

type LoadMoreButtonActionProps = LoadMoreButtonBaseProps & {
  href?: never;
  onClick: () => void;
  disabled?: boolean;
  loadingText?: string;
};

export type LoadMoreButtonProps = LoadMoreButtonLinkProps | LoadMoreButtonActionProps;

function isLinkProps(props: LoadMoreButtonProps): props is LoadMoreButtonLinkProps {
  return "href" in props;
}

function resolveLabel(
  text: string | undefined,
  mode: "link" | "action",
): string {
  if (text) return text;
  return mode === "link" ? VIEW_MORE_NEWS_TEXT : VIEW_MORE_NEWS_TEXT;
}

const LoadMoreButton = (props: LoadMoreButtonProps) => {
  const {
    variant = "hijauSawah",
    className,
    wrapperClassName,
  } = props;

  const buttonClassName = cn(
    "rounded-lg transition-all duration-300 ease-in-out w-fit",
    variantClassName[variant],
    className,
  );

  const control = isLinkProps(props) ? (
    <Button asChild className={buttonClassName}>
      <Link href={props.href}>{resolveLabel(props.text, "link")}</Link>
    </Button>
  ) : (
    <Button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={buttonClassName}
    >
      {props.disabled ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {props.loadingText ?? "Loading..."}
        </>
      ) : (
        resolveLabel(props.text, "action")
      )}
    </Button>
  );

  if (wrapperClassName) {
    return <div className={wrapperClassName}>{control}</div>;
  }

  return control;
};

export default LoadMoreButton;
