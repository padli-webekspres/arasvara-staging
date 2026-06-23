"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import api from "@/lib/axios";
import {
  Target,
  FileText,
  CheckSquare,
  Share2,
  AlertCircle,
  Timer,
  Eye,
  Coins,
  Copy,
  Save,
  RotateCcw,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonthlyTargetKey, TargetScopeType } from "@/types/monthlyTarget";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// Types (State lokal UI)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Representasi satu target dalam state lokal UI.
 * Nilai selalu dalam string agar kompatibel dengan input HTML.
 * Khusus SLA: nilai ditampilkan dalam jam (dikonversi dari menit DB).
 */
interface LocalTarget {
  key: MonthlyTargetKey;
  /** Nilai dalam string. SLA ditampilkan sebagai jam desimal. */
  value: string;
  period: string;
  scopeType: TargetScopeType;
  category?: {
    _id: string;
    name: string;
    slug: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Konstanta
// ─────────────────────────────────────────────────────────────────────────────

/** Kategori yang digunakan untuk menyusun kerangka channel targets.
 *  Nanti bisa diganti dengan fetch dari API categories. */
const DEFAULT_CATEGORIES = [
  { _id: "cat_news", name: "News", slug: "news" },
  { _id: "cat_tekno", name: "Tekno", slug: "tekno" },
  { _id: "cat_ekonomi", name: "Ekonomi Bisnis", slug: "ekonomi-bisnis" },
  { _id: "cat_metro", name: "Metro", slug: "metro" },
  { _id: "cat_lifestyle", name: "Lifestyle", slug: "lifestyle" },
  { _id: "cat_entertainment", name: "Entertainment", slug: "entertainment" },
  { _id: "cat_otomotif", name: "Otomotif", slug: "otomotif" },
  { _id: "cat_aneka", name: "Aneka", slug: "aneka" },
];

const MONTHS = [
  { value: "01", label: "Januari" },
  { value: "02", label: "Februari" },
  { value: "03", label: "Maret" },
  { value: "04", label: "April" },
  { value: "05", label: "Mei" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "Agustus" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

function getYearOptions(): string[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => String(currentYear - 2 + i));
}

/**
 * Definisi visual untuk setiap key target (ikon, warna, deskripsi, satuan).
 * Skema warna premium khas Arasvara (Hijau Sawah, Terakota, Slate Teal, dll.).
 */
const TARGET_DECORATORS: Record<
  string,
  {
    icon: any;
    iconColor: string;
    bgColor: string;
    description: string;
    /** Satuan yang ditampilkan di UI (SLA dalam "Jam", bukan "Menit"). */
    unit: string;
    /** Label input untuk accessibility. */
    inputLabel: string;
  }
> = {
  [MonthlyTargetKey.ARTICLES_SUBMITTED]: {
    icon: FileText,
    iconColor: "text-[#5fa1aa]",
    bgColor: "bg-[#5fa1aa]/10",
    description:
      "Target jumlah total draf naskah artikel yang dikirimkan oleh seluruh kontributor bulan ini.",
    unit: "Draf Naskah",
    inputLabel: "Masukkan jumlah draf naskah",
  },
  [MonthlyTargetKey.ARTICLES_PUBLISHED]: {
    icon: Target,
    iconColor: "text-[#5c954e]",
    bgColor: "bg-[#5c954e]/10",
    description:
      "Target akumulasi naskah berita berkualitas yang berhasil ditayangkan ke publik.",
    unit: "Artikel Terbit",
    inputLabel: "Masukkan jumlah artikel terbit",
  },
  [MonthlyTargetKey.SOCIAL_MEDIA_PUBLISHED]: {
    icon: Share2,
    iconColor: "text-[#bb6b7e]",
    bgColor: "bg-[#bb6b7e]/10",
    description:
      "Target integrasi/embed tautan postingan sosial media resmi di halaman web berita.",
    unit: "Postingan Sosmed",
    inputLabel: "Masukkan jumlah postingan sosmed",
  },
  [MonthlyTargetKey.ARTICLES_TO_PROCESS]: {
    icon: CheckSquare,
    iconColor: "text-[#dcae61]",
    bgColor: "bg-[#dcae61]/10",
    description:
      "Volume draf artikel masuk yang wajib ditinjau, diedit, dan diproses oleh tim Editor.",
    unit: "Naskah Diproses",
    inputLabel: "Masukkan jumlah naskah yang diproses",
  },
  [MonthlyTargetKey.REVISION_RATE_MAX]: {
    icon: AlertCircle,
    iconColor: "text-[#c16b4c]",
    bgColor: "bg-[#c16b4c]/10",
    description:
      "Batas persentase penolakan draf editor terhadap draf penulis yang masuk (Strictness).",
    unit: "% Persentase",
    inputLabel: "Masukkan persentase maksimal revisi (0–100)",
  },
  [MonthlyTargetKey.PROCESSING_TIME_SLA_MINUTES]: {
    icon: Timer,
    iconColor: "text-[#5fa1aa]",
    bgColor: "bg-[#5fa1aa]/10",
    description:
      "Batas maksimal waktu tanggap proses draf dari diajukan hingga terbit. Input dalam satuan jam (desimal).",
    unit: "Jam (SLA)",
    inputLabel: "Masukkan SLA dalam jam (contoh: 2.5 untuk 2 jam 30 menit)",
  },
  [MonthlyTargetKey.SITE_TOTAL_PAGEVIEWS]: {
    icon: Eye,
    iconColor: "text-[#c16b4c]",
    bgColor: "bg-[#c16b4c]/10",
    description:
      "Target akumulasi tayangan halaman pembaca (pageviews) kumulatif untuk seluruh situs.",
    unit: "Views",
    inputLabel: "Masukkan target pageviews situs",
  },
  [MonthlyTargetKey.AD_CLICKS_MIN]: {
    icon: Coins,
    iconColor: "text-[#dcae61]",
    bgColor: "bg-[#dcae61]/10",
    description:
      "Target minimal klik pada konten sponsor / iklan komersial aktif (KPI AE).",
    unit: "Klik Sponsor",
    inputLabel: "Masukkan target klik iklan",
  },
};

/** Label nama yang lebih ramah pengguna untuk setiap key target. */
const TARGET_LABELS: Record<string, string> = {
  [MonthlyTargetKey.ARTICLES_SUBMITTED]: "Naskah Diajukan",
  [MonthlyTargetKey.ARTICLES_PUBLISHED]: "Artikel Diterbitkan",
  [MonthlyTargetKey.SOCIAL_MEDIA_PUBLISHED]: "Postingan Sosmed",
  [MonthlyTargetKey.ARTICLES_TO_PROCESS]: "Naskah Diproses",
  [MonthlyTargetKey.REVISION_RATE_MAX]: "Batas Revisi",
  [MonthlyTargetKey.PROCESSING_TIME_SLA_MINUTES]: "SLA Pemrosesan",
  [MonthlyTargetKey.SITE_TOTAL_PAGEVIEWS]: "Total Pageviews",
  [MonthlyTargetKey.AD_CLICKS_MIN]: "Klik Iklan Minimum",
  [MonthlyTargetKey.CHANNEL_PAGEVIEWS]: "Pageviews Kanal",
  [MonthlyTargetKey.CHANNEL_ARTICLES]: "Artikel Kanal",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers Konversi Nilai
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Konversi nilai dari DB ke nilai yang ditampilkan di UI.
 * Khusus SLA: menit (DB) → jam desimal (UI).
 */
function dbValueToDisplayValue(key: MonthlyTargetKey, dbValue: number): string {
  if (key === MonthlyTargetKey.PROCESSING_TIME_SLA_MINUTES) {
    // Konversi menit → jam, simpan hingga 4 desimal untuk ketepatan
    const hours = dbValue / 60;
    // Hapus trailing zero agar tampilan bersih (90 menit → "1.5", bukan "1.5000")
    return String(parseFloat(hours.toFixed(4)));
  }
  return String(dbValue);
}

/**
 * Bangun kerangka kosong target global dengan nilai string kosong.
 * Digunakan jika DB belum memiliki data untuk periode tertentu.
 */
function buildEmptyGlobalTargets(period: string): LocalTarget[] {
  const globalKeys = [
    MonthlyTargetKey.ARTICLES_SUBMITTED,
    MonthlyTargetKey.ARTICLES_PUBLISHED,
    MonthlyTargetKey.SOCIAL_MEDIA_PUBLISHED,
    MonthlyTargetKey.ARTICLES_TO_PROCESS,
    MonthlyTargetKey.REVISION_RATE_MAX,
    MonthlyTargetKey.PROCESSING_TIME_SLA_MINUTES,
    MonthlyTargetKey.SITE_TOTAL_PAGEVIEWS,
    MonthlyTargetKey.AD_CLICKS_MIN,
  ];

  return globalKeys.map((key) => ({
    key,
    value: "",
    period,
    scopeType: TargetScopeType.GLOBAL,
  }));
}

/**
 * Bangun kerangka kosong target channel untuk semua kategori.
 * Digunakan jika DB belum memiliki data untuk periode/kategori tertentu.
 */
function buildEmptyChannelTargets(
  period: string,
  categories: typeof DEFAULT_CATEGORIES,
): LocalTarget[] {
  const result: LocalTarget[] = [];

  for (const cat of categories) {
    result.push({
      key: MonthlyTargetKey.CHANNEL_PAGEVIEWS,
      value: "",
      period,
      scopeType: TargetScopeType.CHANNEL,
      category: cat,
    });
    result.push({
      key: MonthlyTargetKey.CHANNEL_ARTICLES,
      value: "",
      period,
      scopeType: TargetScopeType.CHANNEL,
      category: cat,
    });
  }

  return result;
}

/**
 * Gabungkan data dari API dengan kerangka kosong.
 * Pastikan setiap key yang seharusnya ada tetap muncul, bahkan jika DB kosong.
 */
function mergeApiDataWithSkeleton(
  apiData: any[],
  period: string,
  categories: typeof DEFAULT_CATEGORIES,
): LocalTarget[] {
  const emptyGlobals = buildEmptyGlobalTargets(period);
  const emptyChannels = buildEmptyChannelTargets(period, categories);

  // Isi nilai dari API ke skeleton global
  const mergedGlobals = emptyGlobals.map((skeleton) => {
    const found = apiData.find(
      (d) => d.key === skeleton.key && d.scopeType === TargetScopeType.GLOBAL,
    );
    if (found) {
      return {
        ...skeleton,
        value: dbValueToDisplayValue(skeleton.key, found.value),
      };
    }
    return skeleton;
  });

  // Isi nilai dari API ke skeleton channel
  const mergedChannels = emptyChannels.map((skeleton) => {
    const found = apiData.find(
      (d) =>
        d.key === skeleton.key &&
        d.scopeType === TargetScopeType.CHANNEL &&
        d.category?._id === skeleton.category?._id,
    );
    if (found) {
      return {
        ...skeleton,
        value: dbValueToDisplayValue(skeleton.key, found.value),
      };
    }
    return skeleton;
  });

  return [...mergedGlobals, ...mergedChannels];
}

/**
 * Membuat unique key untuk mengidentifikasi sebuah target secara tepat,
 * digunakan sebagai acuan perbandingan antara draf dan data server.
 */
function makeTargetKey(
  key: MonthlyTargetKey,
  scopeType: TargetScopeType,
  categoryId?: string,
): string {
  return scopeType === TargetScopeType.CHANNEL ? `${key}::${categoryId}` : key;
}

// ─────────────────────────────────────────────────────────────────────────────
// Komponen Helper: Kartu Target Global
//
// PENTING: Komponen ini sengaja didefinisikan di LUAR MonthlyTargetPage agar
// React tidak menganggapnya sebagai komponen baru di setiap re-render induk.
// Jika didefinisikan di dalam, setiap ketikan akan unmount/remount kartu ini
// sehingga focus input hilang.
// ─────────────────────────────────────────────────────────────────────────────

interface GlobalTargetCardProps {
  target: LocalTarget;
  /** Apakah nilai target ini sudah diubah tapi belum disimpan? */
  isCardDirty: boolean;
  /** Handler perubahan input yang diteruskan dari komponen induk. */
  onInputChange: (
    targetKey: string,
    categoryId: string | undefined,
    newValue: string,
  ) => void;
}

function GlobalTargetCard({
  target,
  isCardDirty,
  onInputChange,
}: GlobalTargetCardProps) {
  const decorator = TARGET_DECORATORS[target.key];
  const Icon = decorator?.icon || Sparkles;
  const isSlaField =
    target.key === MonthlyTargetKey.PROCESSING_TIME_SLA_MINUTES;

  return (
    <div
      className={[
        "bg-card text-card-foreground rounded-lg shadow-xs p-6",
        "flex flex-col justify-between min-h-[220px]",
        "transition-all duration-200",
        // Outline Terakota muncul jika kartu ini memiliki perubahan belum disimpan
        isCardDirty
          ? "border-2 border-[#c16b4c] ring-4 ring-[#c16b4c]/10 hover:shadow-sm"
          : "border border-border hover:shadow-sm",
      ].join(" ")}
    >
      {/* Header Kartu */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-full ${decorator?.bgColor || "bg-muted"}`}
          >
            <Icon
              className={`h-4.5 w-4.5 ${decorator?.iconColor || "text-foreground"}`}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground/95 leading-tight">
              {TARGET_LABELS[target.key] || target.key}
            </h3>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mt-0.5">
              Cakupan: {target.scopeType}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {decorator?.description}
        </p>
      </div>

      {/* Input Inline */}
      <div className="space-y-1.5 pt-3 border-t border-border/50">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-foreground/80">Nilai Target Bulanan</span>
          <span className="text-muted-foreground">{decorator?.unit}</span>
        </div>
        <Input
          type="text"
          inputMode="decimal"
          placeholder={
            isSlaField
              ? "Jam (contoh: 2.5 = 2j 30m)"
              : "Masukkan target (kosong)"
          }
          value={target.value}
          onChange={(e) => onInputChange(target.key, undefined, e.target.value)}
          aria-label={decorator?.inputLabel}
          className="h-9 bg-background text-base font-bold text-foreground focus-visible:ring-[#5c954e] border-border"
        />
        {/* Keterangan konversi SLA */}
        {isSlaField && target.value && !isNaN(parseFloat(target.value)) && (
          <p className="text-[10px] text-muted-foreground">
            ≈ {Math.round(parseFloat(target.value) * 60)} menit tersimpan di
            database
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Komponen Utama
// ─────────────────────────────────────────────────────────────────────────────

export default function MonthlyTargetPage() {
  const currentDate = new Date();
  const currentMonthStr = String(currentDate.getMonth() + 1).padStart(2, "0");
  const currentYearStr = String(currentDate.getFullYear());

  const yearOptions = getYearOptions();

  // ── State Periode ──────────────────────────────────────────────────────────
  const [month, setMonth] = useState(currentMonthStr);
  const [year, setYear] = useState(currentYearStr);

  // ── State Data Utama ───────────────────────────────────────────────────────
  // Data yang sedang aktif ditampilkan di layar (untuk periode yang dipilih)
  const [localTargets, setLocalTargets] = useState<LocalTarget[]>([]);

  // Daftar kategori aktif (dimuat dinamis dari database)
  const [categories, setCategories] = useState<any[]>(DEFAULT_CATEGORIES);

  // ── Fetch Daftar Kategori dari DB ──────────────────────────────────────────
  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await api.get<{ categories: any[] }>("/categories", {
          params: { isRoot: "true", limit: 100 },
        });
        const body = res.data;
        if (body && Array.isArray(body.categories) && body.categories.length > 0) {
          const formatted = body.categories.map((cat: any) => ({
            _id: cat._id,
            name: cat.name,
            slug: cat.slug,
          }));
          setCategories(formatted);
        }
      } catch (err) {
        console.error("Gagal memuat kategori dari DB, menggunakan fallback:", err);
      }
    }
    loadCategories();
  }, []);

  // Cache data orisinil dari server per periode.
  // Digunakan sebagai pembanding untuk mendeteksi perubahan (dirty check).
  const [serverDataByPeriod, setServerDataByPeriod] = useState<
    Record<string, LocalTarget[]>
  >({});

  // Cache draf editan pengguna per periode.
  // Data di sini tetap bertahan saat ganti tab atau ganti filter periode.
  const [draftsByPeriod, setDraftsByPeriod] = useState<
    Record<string, LocalTarget[]>
  >({});

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // String periode aktif dalam format "YYYY-MM"
  const period = `${year}-${month}`;

  // ── Deteksi Status Kotor (Dirty) Per Target ─────────────────────────────────
  /**
   * Periksa apakah satu target spesifik (berdasarkan key & categoryId)
   * memiliki nilai yang berbeda dari data server orisinil.
   * Digunakan untuk menentukan apakah kartu perlu outline Terakota.
   */
  const isTargetDirty = useCallback(
    (
      targetKey: MonthlyTargetKey,
      scopeType: TargetScopeType,
      categoryId?: string,
    ): boolean => {
      const serverList = serverDataByPeriod[period];
      // Jika data server belum dimuat, tidak ada yang bisa dibandingkan
      if (!serverList) return false;

      const uniqueKey = makeTargetKey(targetKey, scopeType, categoryId);

      const serverTarget = serverList.find(
        (t) => makeTargetKey(t.key, t.scopeType, t.category?._id) === uniqueKey,
      );
      const currentTarget = localTargets.find(
        (t) => makeTargetKey(t.key, t.scopeType, t.category?._id) === uniqueKey,
      );

      if (!currentTarget) return false;

      // Jika tidak ditemukan di server (data baru), dianggap kotor jika nilainya tidak kosong
      if (!serverTarget) return currentTarget.value !== "";

      return serverTarget.value !== currentTarget.value;
    },
    [localTargets, serverDataByPeriod, period],
  );

  /**
   * Hitung apakah periode saat ini (atau periode mana pun di cache draf)
   * memiliki perubahan yang belum disimpan.
   * isDirty = true jika ada setidaknya 1 target yang berubah di periode aktif.
   */
  const isDirty = useMemo(() => {
    const serverList = serverDataByPeriod[period];
    const draftList = draftsByPeriod[period];

    // Tidak ada draf di periode ini berarti tidak ada perubahan
    if (!draftList) return false;

    // Jika server belum pernah di-fetch untuk periode ini tapi ada draf, anggap kotor
    if (!serverList) return true;

    // Bandingkan setiap item draf dengan data server
    return draftList.some((draft) => {
      const uniqueKey = makeTargetKey(
        draft.key,
        draft.scopeType,
        draft.category?._id,
      );
      const serverTarget = serverList.find(
        (s) => makeTargetKey(s.key, s.scopeType, s.category?._id) === uniqueKey,
      );

      if (!serverTarget) return draft.value !== "";
      return serverTarget.value !== draft.value;
    });
  }, [serverDataByPeriod, draftsByPeriod, period]);

  // ── Fetch Data dari API ────────────────────────────────────────────────────
  const fetchTargets = useCallback(
    async (targetPeriod: string) => {
      setIsLoading(true);
      setFetchError(null);

      try {
        const res = await api.get<{ data: any[] }>("/monthly-target", {
          params: { period: targetPeriod },
        });

        const body = res.data;
        const apiData: any[] = body?.data || [];

        // Gabungkan data API dengan skeleton kosong menggunakan list kategori dinamis
        const mergedServerData = mergeApiDataWithSkeleton(
          apiData,
          targetPeriod,
          categories,
        );

        // Simpan data orisinil server untuk periode ini
        setServerDataByPeriod((prev) => ({
          ...prev,
          [targetPeriod]: mergedServerData,
        }));

        // Tampilkan draf jika ada, atau gunakan data server jika belum pernah diedit
        setDraftsByPeriod((prevDrafts) => {
          const existingDraft = prevDrafts[targetPeriod];
          if (existingDraft) {
            // Ada draf yang sudah diedit sebelumnya → tampilkan draf tersebut
            setLocalTargets(existingDraft);
          } else {
            // Belum ada draf → tampilkan data segar dari server
            setLocalTargets(mergedServerData);
          }
          return prevDrafts;
        });
      } catch (err: any) {
        const message = err?.message || "Gagal memuat data target.";
        setFetchError(message);
        toast.error(`Gagal memuat data: ${message}`);

        // Buat skeleton kosong agar UI tetap dapat digunakan walaupun fetch gagal
        const skeleton = mergeApiDataWithSkeleton(
          [],
          targetPeriod,
          categories,
        );

        setServerDataByPeriod((prev) => ({
          ...prev,
          [targetPeriod]: skeleton,
        }));

        setDraftsByPeriod((prevDrafts) => {
          const existingDraft = prevDrafts[targetPeriod];
          if (existingDraft) {
            setLocalTargets(existingDraft);
          } else {
            setLocalTargets(skeleton);
          }
          return prevDrafts;
        });
      } finally {
        setIsLoading(false);
      }
    },
    [categories],
  );

  /**
   * Ketika periode aktif berubah:
   * - Jika draf sudah ada di cache → tampilkan langsung (tanpa loading)
   * - Tetap fetch dari server jika data server belum pernah dimuat
   */
  useEffect(() => {
    const existingDraft = draftsByPeriod[period];
    const serverAlreadyLoaded = !!serverDataByPeriod[period];

    if (existingDraft && serverAlreadyLoaded) {
      // Data sudah lengkap di cache → tampilkan draf langsung tanpa loading
      setLocalTargets(existingDraft);
    } else {
      // Perlu fetch dari server (pertama kali buka periode ini)
      fetchTargets(period);
    }
    // draftsByPeriod dan serverDataByPeriod sengaja tidak dijadikan dependency
    // untuk menghindari infinite re-fetch; fetchTargets sudah stable via useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, fetchTargets]);

  // ── Handler Perubahan Input Inline ─────────────────────────────────────────
  const handleInputChange = useCallback(
    (targetKey: string, categoryId: string | undefined, newValue: string) => {
      // Hanya izinkan angka, titik desimal, dan string kosong
      const sanitized = newValue.replace(/[^0-9.]/g, "");

      setLocalTargets((prev) => {
        const updated = prev.map((target) => {
          const isMatch =
            target.scopeType === TargetScopeType.CHANNEL
              ? target.key === targetKey && target.category?._id === categoryId
              : target.key === targetKey;

          return isMatch ? { ...target, value: sanitized } : target;
        });

        // Rekam perubahan ke cache draf periode yang sedang aktif
        setDraftsByPeriod((prevDrafts) => ({
          ...prevDrafts,
          [period]: updated,
        }));

        return updated;
      });
    },
    [period],
  );

  // ── Salin Target Bulan Lalu ───────────────────────────────────────────────
  const handleCopyFromPrevious = useCallback(async () => {
    setIsLoading(true);

    try {
      let prevMonthNum = parseInt(month, 10) - 1;
      let prevYearNum = parseInt(year, 10);

      if (prevMonthNum === 0) {
        prevMonthNum = 12;
        prevYearNum -= 1;
      }

      const prevPeriod = `${prevYearNum}-${String(prevMonthNum).padStart(2, "0")}`;

      const res = await api.get<{ data: any[] }>("/monthly-target", {
        params: { period: prevPeriod },
      });

      const body = res.data;
      const prevData: any[] = body?.data || [];

      if (prevData.length === 0) {
        toast.info(`Tidak ada data target untuk periode ${prevPeriod}.`);
        return;
      }

      // Terapkan nilai dari bulan lalu ke state saat ini
      setLocalTargets((prev) => {
        const updated = prev.map((curr) => {
          const match = prevData.find((prevTarget) => {
            if (curr.scopeType === TargetScopeType.CHANNEL) {
              return (
                prevTarget.key === curr.key &&
                prevTarget.scopeType === curr.scopeType &&
                String(prevTarget.category?._id) === curr.category?._id
              );
            }
            return (
              prevTarget.key === curr.key &&
              prevTarget.scopeType === curr.scopeType
            );
          });

          if (match) {
            return {
              ...curr,
              value: dbValueToDisplayValue(curr.key, match.value),
            };
          }

          return curr;
        });

        // Rekam salinan ke cache draf periode aktif
        setDraftsByPeriod((prevDrafts) => ({
          ...prevDrafts,
          [period]: updated,
        }));

        return updated;
      });

      toast.success(
        `Berhasil menyalin target dari periode ${prevPeriod}! (Belum disimpan)`,
      );
    } catch (err: any) {
      const message = err?.message || "Gagal menyalin data bulan lalu.";
      toast.error(`Gagal menyalin: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [month, year, period]);

  // ── Simpan Semua Target ──────────────────────────────────────────────────
  const handleSaveAll = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      // Bangun payload untuk API: seluruh target pada periode aktif saat ini
      const items = localTargets.map((target) => ({
        key: target.key,
        value: target.value,
        scopeType: target.scopeType,
        ...(target.scopeType === TargetScopeType.CHANNEL && target.category
          ? { categoryId: target.category._id }
          : {}),
      }));

      const res = await api.post<{ result: { upserted: number; deleted: number } }>("/monthly-target", {
        period,
        items,
      });

      const body = res.data;

      // Setelah simpan berhasil:
      // 1. Update data server untuk periode ini (sekarang ini menjadi "orisinil" baru)
      setServerDataByPeriod((prev) => ({
        ...prev,
        [period]: localTargets,
      }));

      // 2. Hapus draf untuk periode ini (sudah tidak ada perubahan yang belum disimpan)
      setDraftsByPeriod((prev) => {
        const next = { ...prev };
        delete next[period];
        return next;
      });

      const { result } = body;
      toast.success(
        `Target berhasil disimpan! ${result.upserted} diperbarui, ${result.deleted} dihapus.`,
      );
    } catch (err: any) {
      const message = err?.message || "Gagal menyimpan target.";
      toast.error(`Gagal menyimpan: ${message}`);
    } finally {
      setIsSaving(false);
    }
  }, [localTargets, period, isSaving]);

  // ── Reset Draf ke Data Server ─────────────────────────────────────────────
  const handleReset = useCallback(() => {
    // Hapus draf untuk periode saat ini
    setDraftsByPeriod((prev) => {
      const next = { ...prev };
      delete next[period];
      return next;
    });

    // Pulihkan tampilan ke data orisinil dari server
    const originalData = serverDataByPeriod[period];
    if (originalData) {
      setLocalTargets(originalData);
    }

    setMonth(currentMonthStr);
    setYear(currentYearStr);
    toast.info("Periode di-reset ke bulan berjalan.");
  }, [currentMonthStr, currentYearStr, period, serverDataByPeriod]);

  // ── Derived State (Pemisahan target per tab) ───────────────────────────────
  const globalProductionTargets = useMemo(
    () =>
      localTargets.filter(
        (t) =>
          t.scopeType === TargetScopeType.GLOBAL &&
          [
            MonthlyTargetKey.ARTICLES_SUBMITTED,
            MonthlyTargetKey.ARTICLES_PUBLISHED,
            MonthlyTargetKey.SOCIAL_MEDIA_PUBLISHED,
          ].includes(t.key),
      ),
    [localTargets],
  );

  const globalQualityTargets = useMemo(
    () =>
      localTargets.filter(
        (t) =>
          t.scopeType === TargetScopeType.GLOBAL &&
          [
            MonthlyTargetKey.ARTICLES_TO_PROCESS,
            MonthlyTargetKey.REVISION_RATE_MAX,
            MonthlyTargetKey.PROCESSING_TIME_SLA_MINUTES,
          ].includes(t.key),
      ),
    [localTargets],
  );

  const globalCommercialTargets = useMemo(
    () =>
      localTargets.filter(
        (t) =>
          t.scopeType === TargetScopeType.GLOBAL &&
          [
            MonthlyTargetKey.SITE_TOTAL_PAGEVIEWS,
            MonthlyTargetKey.AD_CLICKS_MIN,
          ].includes(t.key),
      ),
    [localTargets],
  );

  const channelTargets = useMemo(
    () => localTargets.filter((t) => t.scopeType === TargetScopeType.CHANNEL),
    [localTargets],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Render Utama
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6 relative pb-20">
      {/* ── Header Halaman ─────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Target Bulanan</h1>
          <p className="text-sm text-muted-foreground">
            Konfigurasi target kuantitas naskah, batas toleransi mutu editorial,
            dan traffic komersial per periode.
          </p>
        </div>

        <Button
          onClick={handleSaveAll}
          disabled={isSaving || isLoading || !isDirty}
          className="shrink-0"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
        </Button>
      </div>

      {/* ── Filter Bar Periode ──────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-lg border border-border shadow-xs">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0 mr-2">
            Periode:
          </span>

          {/* Select Bulan */}
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-full md:w-40 h-9">
              <SelectValue placeholder="Pilih Bulan" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Select Tahun */}
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-full md:w-32 h-9">
              <SelectValue placeholder="Pilih Tahun" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex w-full md:w-auto md:ml-auto gap-2">
          {/* Tombol Salin Bulan Lalu */}
          {/* <Button
            variant="outline"
            onClick={handleCopyFromPrevious}
            disabled={isLoading}
            className="flex-1 md:flex-initial gap-2 text-muted-foreground hover:text-foreground h-9 text-xs font-medium cursor-pointer"
          >
            <Copy className="h-3.5 w-3.5" />
            Salin Bulan Lalu
          </Button> */}

          {/* Tombol Reset */}
          <Button
            variant="ghost"
            onClick={handleReset}
            disabled={isLoading}
            className="gap-2 text-muted-foreground h-9 text-xs font-medium cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </div>

      {/* ── Notifikasi Error Fetch ──────────────────────────────────────── */}
      {fetchError && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            Gagal memuat dari server: <strong>{fetchError}</strong> — Data
            kosong ditampilkan. Anda tetap bisa mengisi dan menyimpan.
          </span>
        </div>
      )}

      {/* ── Tabs Layout ────────────────────────────────────────────────── */}
      <Tabs defaultValue="production" className="w-full">
        <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
          <TabsTrigger value="production" className="whitespace-nowrap">
            Produksi Konten
          </TabsTrigger>
          <TabsTrigger value="quality" className="whitespace-nowrap">
            Kualitas &amp; SLA
          </TabsTrigger>
          <TabsTrigger value="channels" className="whitespace-nowrap">
            Performa Kanal
          </TabsTrigger>
          <TabsTrigger value="commercial" className="whitespace-nowrap">
            Bisnis &amp; Iklan
          </TabsTrigger>
        </TabsList>

        {/* Loading Overlay */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-xs text-muted-foreground">
              Memuat data KPI periode {period}...
            </p>
          </div>
        ) : (
          <div className="mt-6">
            {/* ── Tab 1: Produksi Konten ────────────────────────── */}
            <TabsContent
              value="production"
              className="m-0 focus-visible:outline-none"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {globalProductionTargets.map((target) => (
                  <GlobalTargetCard
                    key={target.key}
                    target={target}
                    isCardDirty={isTargetDirty(
                      target.key,
                      target.scopeType,
                      target.category?._id,
                    )}
                    onInputChange={handleInputChange}
                  />
                ))}
              </div>
            </TabsContent>

            {/* ── Tab 2: Kualitas & SLA ─────────────────────────── */}
            <TabsContent
              value="quality"
              className="m-0 focus-visible:outline-none"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {globalQualityTargets.map((target) => (
                  <GlobalTargetCard
                    key={target.key}
                    target={target}
                    isCardDirty={isTargetDirty(
                      target.key,
                      target.scopeType,
                      target.category?._id,
                    )}
                    onInputChange={handleInputChange}
                  />
                ))}
              </div>
            </TabsContent>

            {/* ── Tab 3: Performa Kanal ─────────────────────────── */}
            <TabsContent
              value="channels"
              className="m-0 focus-visible:outline-none"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map((cat) => {
                  const pvTarget = channelTargets.find(
                    (t) =>
                      t.category?._id === cat._id &&
                      t.key === MonthlyTargetKey.CHANNEL_PAGEVIEWS,
                  );
                  const artTarget = channelTargets.find(
                    (t) =>
                      t.category?._id === cat._id &&
                      t.key === MonthlyTargetKey.CHANNEL_ARTICLES,
                  );

                  // Cek apakah salah satu input kanal ini kotor (belum disimpan)
                  const isPvDirty = isTargetDirty(
                    MonthlyTargetKey.CHANNEL_PAGEVIEWS,
                    TargetScopeType.CHANNEL,
                    cat._id,
                  );
                  const isArtDirty = isTargetDirty(
                    MonthlyTargetKey.CHANNEL_ARTICLES,
                    TargetScopeType.CHANNEL,
                    cat._id,
                  );
                  const isChannelCardDirty = isPvDirty || isArtDirty;

                  return (
                    <div
                      key={cat._id}
                      className={[
                        "bg-card text-card-foreground rounded-lg shadow-xs p-6",
                        "flex flex-col justify-between min-h-[220px]",
                        "transition-all duration-200",
                        // Outline Terakota jika ada input kanal ini yang belum disimpan
                        isChannelCardDirty
                          ? "border-2 border-[#c16b4c] ring-4 ring-[#c16b4c]/10 hover:shadow-sm"
                          : "border border-border hover:shadow-sm",
                      ].join(" ")}
                    >
                      {/* Header Kanal */}
                      <div className="space-y-2 pb-3 border-b border-border/50">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-foreground text-base tracking-tight">
                            {cat.name}
                          </h3>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#5c954e]/10 text-[#5c954e] border border-[#5c954e]/20">
                            Desk Kanal
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Target aktivitas bulanan khusus kanal{" "}
                          <strong>{cat.name}</strong>.
                        </p>
                      </div>

                      {/* Side-by-Side Input Kanal */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        {/* Target Pageviews */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-foreground/80 flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5 text-[#c16b4c]" />
                            Pageviews
                          </label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="Target"
                            value={pvTarget?.value || ""}
                            onChange={(e) =>
                              handleInputChange(
                                MonthlyTargetKey.CHANNEL_PAGEVIEWS,
                                cat._id,
                                e.target.value,
                              )
                            }
                            aria-label={`Target pageviews kanal ${cat.name}`}
                            className="h-9 bg-background text-sm font-bold text-foreground border-border focus-visible:ring-[#5c954e]"
                          />
                        </div>

                        {/* Target Artikel */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-foreground/80 flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5 text-[#5c954e]" />
                            Artikel
                          </label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="Volume"
                            value={artTarget?.value || ""}
                            onChange={(e) =>
                              handleInputChange(
                                MonthlyTargetKey.CHANNEL_ARTICLES,
                                cat._id,
                                e.target.value,
                              )
                            }
                            aria-label={`Target artikel kanal ${cat.name}`}
                            className="h-9 bg-background text-sm font-bold text-foreground border-border focus-visible:ring-[#5c954e]"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* ── Tab 4: Bisnis & Iklan ─────────────────────────── */}
            <TabsContent
              value="commercial"
              className="m-0 focus-visible:outline-none"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {globalCommercialTargets.map((target) => (
                  <GlobalTargetCard
                    key={target.key}
                    target={target}
                    isCardDirty={isTargetDirty(
                      target.key,
                      target.scopeType,
                      target.category?._id,
                    )}
                    onInputChange={handleInputChange}
                  />
                ))}
              </div>
            </TabsContent>
          </div>
        )}
      </Tabs>
    </div>
  );
}
