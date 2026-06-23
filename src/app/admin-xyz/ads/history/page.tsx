"use client";

import React, { useState } from "react";
import { useAdsHistory, type AdsHistoryItem } from "@/hooks/useAds";
import { ListTable, ListTableColumn } from "@/components/table/ListTable";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  AlertCircle,
  Calendar,
  ShieldAlert,
  ImageIcon,
} from "lucide-react";

function BannerViewButton({ row }: { row: AdsHistoryItem }) {
  const [open, setOpen] = useState(false);
  const hasBanner = Boolean(row.bannerUrl?.trim());

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs font-medium"
        disabled={!hasBanner}
        onClick={() => setOpen(true)}
      >
        <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
        Lihat banner
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-left">{row.name}</DialogTitle>
            <DialogDescription className="text-left">
              Pratinjau banner iklan — {row.type} / {row.positionOrPlacement}
            </DialogDescription>
          </DialogHeader>
          <div className="relative w-full min-h-[160px] max-h-[70vh] rounded-md border border-border overflow-hidden bg-muted/30 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={row.bannerUrl}
              alt={`Banner ${row.name}`}
              className="max-w-full max-h-[70vh] object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AdsHistoryPage() {
  const { data, isLoading, error, refetch, isFetching } = useAdsHistory();
  const historyData = data?.history || [];

  const columns: ListTableColumn<AdsHistoryItem>[] = [
    {
      key: "banner",
      header: "Banner",
      className: "w-36 hidden md:table-cell",
      render: (row) => <BannerViewButton row={row} />,
    },
    {
      key: "name",
      header: "Nama Iklan / Sponsor",
      render: (row) => (
        <div className="min-w-0 max-w-[280px]">
          <p className="font-bold text-sm text-foreground leading-snug truncate">
            {row.name}
          </p>
          <span className="text-[10px] text-muted-foreground font-mono">
            ID: {row._id}
          </span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Slot Kategori",
      className: "hidden md:table-cell",
      render: (row) => (
        <div>
          <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-muted border border-border text-foreground/75">
            {row.type}
          </span>
          <p className="text-[10px] text-muted-foreground mt-1 font-mono uppercase tracking-tight">
            {row.positionOrPlacement}
          </p>
        </div>
      ),
    },
    {
      key: "startedAt",
      header: "Masa Tayang",
      render: (row) => {
        const start = new Date(row.startedAt).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        const end = new Date(row.endedAt).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        return (
          <div className="text-xs text-muted-foreground flex flex-col gap-0.5 justify-center leading-normal min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1 text-[10px]">
              <Calendar className="h-3 w-3 text-terakota shrink-0 hidden sm:inline" />
              <span className="truncate">
                {start} - {end}
              </span>
            </div>
            {row.deletedAt && (
              <span className="text-[9px] text-muted-foreground/65 italic">
                Dicabut:{" "}
                {new Date(row.deletedAt).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status Akhir",
      render: (row) => {
        if (row.status === "taken down") {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-orange-50 border border-terakota/20 text-terakota dark:bg-orange-950/20">
              <AlertCircle className="h-3 w-3" />
              Taken Down
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-green-50 border border-hijauSawah/20 text-hijauSawah dark:bg-green-950/20">
            Habis Masa Pakai
          </span>
        );
      },
    },
    {
      key: "clicks",
      header: "Performa",
      className: "text-right pr-8",
      render: (row) => (
        <div>
          <p className="font-extrabold text-foreground text-sm">
            {row.clicks.toLocaleString("id-ID")}
          </p>
          <p className="text-[9px] text-muted-foreground">clicks</p>
        </div>
      ),
    },
  ];

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      {/* Header Halaman — mengikuti pola audience analytics */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Riwayat & Histori Iklan
          </h1>
          <p className="text-sm text-muted-foreground">
            Arsip spanduk iklan beranda dan artikel yang telah kedaluwarsa atau
            dicopot paksa (taken down), beserta data klik dan status akhir.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Data:
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`}
              />
              Segarkan
            </Button>
          </div>
        </div>
      </div>

      <Card className="border border-border">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-bold">Arsip Log Periklanan</CardTitle>
          <CardDescription className="text-xs">
            Seluruh data klik, status akhir, dan histori tanggal terekam di database.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
              <div className="p-3 bg-destructive/10 text-destructive rounded-full">
                <ShieldAlert className="h-8 w-8 text-terakota" />
              </div>
              <h3 className="text-sm font-bold">Gagal Memuat Riwayat Iklan</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Terjadi kesalahan saat berkomunikasi dengan server API. Silakan
                periksa koneksi Anda dan coba kembali.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="text-xs font-bold"
              >
                Coba Lagi
              </Button>
            </div>
          ) : (
            <ListTable
              columns={columns}
              data={historyData}
              loading={isLoading}
              emptyText="Tidak ada arsip histori periklanan yang ditemukan di database."
              rowKey={(row) => row._id}
              skeletonRows={8}
              compact
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
