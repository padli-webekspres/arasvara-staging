"use client";

import { ListTable } from "../../table/ListTable";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { ArrowRight, FileText, Search } from "lucide-react";
import Link from "next/link";
import React from "react";
import { ADMIN_PAGINATION_WRAP } from "@/lib/admin-ui";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { SkeletonTableRow } from "../../ui/skeleton";

/**
 * CardReportTable
 * Komponen presentasi table dalam card untuk menampilkan laporan data.
 * Props: title, columns, data, loading, currentPage, totalPages, onPageChange, link, search, onSearchChange
 */
interface CardReportTableProps {
  title: string;
  columns: any[];
  data: any[];
  loading?: boolean;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  search?: string; // opsional, untuk search input value
  onSearchChange?: (searchValue: string) => void; // opsional, callback saat search berubah
  link?: string; // opsional, untuk tombol "selengkapnya"
}

const CardReportTable = ({
  columns,
  data,
  title,
  link,
  loading = false,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  search = "",
  onSearchChange,
}: CardReportTableProps) => {
  // Render skeleton rows ketika loading
  const renderTableContent = () => {
    if (loading) {
      return Array.from({ length: 5 }).map((_, i) => (
        <SkeletonTableRow key={i} columns={columns.length} />
      ));
    }

    if (data.length === 0) {
      return (
        <tr>
          <td
            colSpan={columns.length}
            className="p-8 text-center text-muted-foreground"
          >
            No data found
          </td>
        </tr>
      );
    }

    return data.map((row: any, idx: number) => (
      <tr key={idx} className="border-b border-border hover:bg-muted/50">
        {columns.map((col: any) => (
          <td key={col.key} className={col.className || "p-4"}>
            {col.render ? col.render(row, idx) : String(row[col.key] || "-")}
          </td>
        ))}
      </tr>
    ));
  };

  // Generate pagination pages with advanced logic
  const generatePaginationPages = () => {
    // If total pages <= 5, show all
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // For >5 pages: always show first, last, 3 around current
    const pages: number[] = [1];
    for (let i = currentPage - 1; i <= currentPage + 1; i++) {
      if (i > 1 && i < totalPages) pages.push(i);
    }
    if (!pages.includes(totalPages)) pages.push(totalPages);

    const uniquePages = Array.from(new Set(pages)).sort((a, b) => a - b);

    // Add ellipsis for gaps > 1
    const result: (number | string)[] = [];
    uniquePages.forEach((pageNum, idx) => {
      const prevPage = uniquePages[idx - 1];
      if (idx > 0 && pageNum - prevPage > 1) {
        result.push("...");
      }
      result.push(pageNum);
    });

    return result;
  };

  return (
    <div className="bg-card p-4 border rounded-xl flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-bold text-xl capitalize">{title}</h3>

        {/* Button "selengkapnya" */}
        {link && (
          <Button variant="outline" size="sm" className="sm:ml-auto shrink-0" asChild>
            <Link href={link} target="_blank">
              Selengkapnya
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        )}
      </div>

      {/* Filters - Search functionality aktif */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pl-10"
          />
        </div>
        <div>
          <Button variant="outline" disabled>
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Table dengan skeleton loading */}
      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {columns.map((col: any, i: number) => (
                <th
                  key={i}
                  className={col.className || "text-left p-4 font-medium"}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{renderTableContent()}</tbody>
        </table>

        {/* Pagination */}
        <Pagination className="py-4">
          <PaginationContent className={ADMIN_PAGINATION_WRAP}>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage > 1 && onPageChange) {
                    onPageChange(currentPage - 1);
                  }
                }}
                className={
                  currentPage === 1 ? "pointer-events-none opacity-50" : ""
                }
              />
            </PaginationItem>

            {generatePaginationPages().map((page, i) => (
              <PaginationItem key={i}>
                {page === "..." ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink
                    href="#"
                    isActive={page === currentPage}
                    onClick={(e) => {
                      e.preventDefault();
                      if (typeof page === "number" && onPageChange) {
                        onPageChange(page);
                      }
                    }}
                  >
                    {page}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage < totalPages && onPageChange) {
                    onPageChange(currentPage + 1);
                  }
                }}
                className={
                  currentPage === totalPages
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
};

export default CardReportTable;
