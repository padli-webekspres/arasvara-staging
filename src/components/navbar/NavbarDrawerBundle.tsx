"use client";

import type { ChangeEvent, KeyboardEvent } from "react";
import { Drawer } from "@/components/ui/drawer";
import DrawerNavbar from "./DrawerNavbar";

export default function NavbarDrawerBundle({
  open,
  onOpenChange,
  pathname,
  searchValue,
  onChangeInput,
  onKeyDownInput,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
  searchValue: string;
  onChangeInput: (e: ChangeEvent<HTMLInputElement>) => void;
  onKeyDownInput: (e: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <Drawer direction="top" open={open} onOpenChange={onOpenChange}>
      <DrawerNavbar
        pathname={pathname}
        searchValue={searchValue}
        onChangeInput={onChangeInput}
        onKeyDownInput={onKeyDownInput}
      />
    </Drawer>
  );
}
