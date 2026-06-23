"use client";

import { ListTable } from "@/components/table/ListTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, FileText, Search } from "lucide-react";
import Link from "next/link";
import React from "react";

/**
 * CardReportTable
 * Komponen presentasi table dalam card, tanpa logika apapun.
 * Data dan columns harus diberikan dari parent.
 */
interface CardReportTableProps {
  title: string;
  columns: any[];
  data: any[];
  link?: string; // opsional, untuk tombol "selengkapnya"
}

const CardReportTable = ({
  columns,
  data,
  title,
  link,
}: CardReportTableProps) => {
  return (
    <div className="bg-card p-4 border rounded-xl flex flex-col gap-4">
      <div className="flex">
        <h3 className="font-bold text-xl capitalize">{title}</h3>

        {/* Button "selengkapnya" */}
        {link && (
          <Button variant="outline" size="sm" className="ml-auto" asChild>
            <Link href={link} target="_blank">
              Selengkapnya
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        )}
      </div>
      {/* Filters (dummy, hanya tampilan) */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={""}
            onChange={() => {}}
            className="pl-10"
            disabled
          />
        </div>
        <div className="">
          {/* button export to pdf */}
          <Button variant="outline">
            {/* icon pdf */}
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <ListTable
          columns={columns}
          data={data}
          loading={false}
          emptyText="No users found"
          rowKey={(row: any) => row._id}
        />
      </div>
    </div>
  );
};

export default CardReportTable;
