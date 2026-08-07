"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface CategoryOrderModalLayoutProps {
  orderPanel: ReactNode;
  pickerPanel: ReactNode;
  orderTabLabel: string;
  pickerTabLabel: string;
  defaultMobileTab?: "order" | "picker";
}

export function CategoryOrderModalLayout({
  orderPanel,
  pickerPanel,
  orderTabLabel,
  pickerTabLabel,
  defaultMobileTab = "picker",
}: CategoryOrderModalLayoutProps) {
  return (
    <>
      {/* Mobile: single scroll area per tab */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden px-4">
        <Tabs
          defaultValue={defaultMobileTab}
          className="flex min-h-0 flex-1 flex-col gap-0 "
        >
          <TabsList className="mx-4 mt-3 mb-0 w-[calc(100%-2rem)] shrink-0">
            <TabsTrigger value="order" className="flex-1">
              {orderTabLabel}
            </TabsTrigger>
            <TabsTrigger value="picker" className="flex-1">
              {pickerTabLabel}
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="order"
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden mt-1 border-t border-border bg-card py-4">
              <div className="flex min-h-0 flex-1 flex-col">{orderPanel}</div>
            </div>
          </TabsContent>

          <TabsContent
            value="picker"
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border bg-card p-4">
              <div className="flex min-h-0 flex-1 flex-col">{pickerPanel}</div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop: side-by-side grid */}
      <div
        className={cn(
          "hidden min-h-0 flex-1 grid-cols-3 gap-4 overflow-hidden p-4 lg:grid",
        )}
      >
        <div className="col-span-2 flex min-h-0 flex-col rounded-lg border border-border bg-card p-4">
          <div className="flex min-h-0 flex-1 flex-col">{orderPanel}</div>
        </div>
        <div className="flex min-h-0 flex-col rounded-lg border border-border bg-card p-4">
          <div className="flex min-h-0 flex-1 flex-col">{pickerPanel}</div>
        </div>
      </div>
    </>
  );
}
