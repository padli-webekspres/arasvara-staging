"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useCategoryOptions } from "@/hooks/useCategory";
import { useRecommendedTags } from "@/hooks/useTags";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DayPicker, DateRange } from "react-day-picker";
import { format, isValid } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { ArrowUp, Calendar as CalendarIcon, ChevronsUpDown } from "lucide-react";
import "react-day-picker/dist/style.css";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Semua filter yang bisa diapply user dari form ini */
export interface SearchFilters {
  searchText: string;
  /** "ARTICLES" | "VIDEO" */
  selectedType: string;
  /**
   * "STANDARD" | "GALLERY" — bisa lebih dari satu (multi-select).
   * Hanya berlaku saat selectedType === "ARTICLES".
   */
  selectedFormat: string[];

  selectedCategories: string[];
  selectedTags: string[];
  /** "popular" | "editor_choice" | "headline" */
  selectedHighlights: string[];
  /** "tiktok" | "instagram" | "youtube" — hanya berlaku saat selectedType === "VIDEO" */
  selectedPlatform: string[];
  dateRange: DateRange | undefined;
  sortBy: "date" | "title" | "views";
  sortOrder: "asc" | "desc";
}

interface SidebarSearchProps {
  className?: string;
  /** Dipanggil setiap kali user menekan tombol Search */
  onSearch: (filters: SearchFilters) => void;
}

// ─── Static Options ──────────────────────────────────────────────────────────

const HIGHLIGHT_OPTIONS = [
  { label: "Populer (Banyak Dilihat)", value: "popular" },
  { label: "Pilihan Editor", value: "editor_choice" },
  { label: "Headline", value: "headline" },
];

const PLATFORM_OPTIONS = [
  { label: "TikTok", value: "tiktok" },
  { label: "Instagram", value: "instagram" },
  { label: "YouTube", value: "youtube" },
];

const TYPE_OPTIONS = [
  { label: "Berita / Artikel", value: "ARTICLES" },
  { label: "Social Media (Video)", value: "VIDEO" },
];

const FORMAT_OPTIONS = [
  { label: "Artikel Teks", value: "STANDARD" },
  { label: "Fotografi / Galeri", value: "GALLERY" },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Toggle item dalam array: tambah jika belum ada, hapus jika sudah ada */
function toggleItem(
  prev: string[],
  value: string,
  checked: boolean | string,
): string[] {
  return checked ? [...prev, value] : prev.filter((v) => v !== value);
}

// ─── Default State ────────────────────────────────────────────────────────────

const DEFAULT_STATE: Omit<SearchFilters, "dateRange"> & {
  dateRange: undefined;
} = {
  searchText: "",
  selectedType: "ARTICLES", // Default: mode artikel
  selectedFormat: [], // Default: semua format (tidak difilter)

  selectedCategories: [],
  selectedTags: [],
  selectedHighlights: [],
  selectedPlatform: [],
  dateRange: undefined,
  sortBy: "date",
  sortOrder: "desc",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SidebarSearch({
  className,
  onSearch,
}: SidebarSearchProps) {
  const searchParams = useSearchParams();

  // ── Helper Sync URL ──
  // Supaya form selalu terisi nilai dari URL dan tersinkronisasi antar
  // dua instance UI (Desktop Sidebar dan Mobile Drawer).

  const [searchText, setSearchText] = useState(
    searchParams?.get("q") || DEFAULT_STATE.searchText,
  );
  const [selectedType, setSelectedType] = useState(
    searchParams?.get("type") || DEFAULT_STATE.selectedType,
  );
  const [selectedFormat, setSelectedFormat] = useState<string[]>(
    searchParams?.get("format")
      ? searchParams.get("format")!.split(",")
      : DEFAULT_STATE.selectedFormat,
  );
  const [selectedPlatform, setSelectedPlatform] = useState<string[]>(
    searchParams?.get("platform")
      ? searchParams.get("platform")!.split(",")
      : DEFAULT_STATE.selectedPlatform,
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    searchParams?.get("category")
      ? searchParams.get("category")!.split(",")
      : DEFAULT_STATE.selectedCategories,
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    const rawTags = searchParams?.get("tags");
    if (rawTags) return rawTags.split(",").map((t) => t.trim()).filter(Boolean);
    const rawTag = searchParams?.get("tag");
    if (rawTag) return [rawTag.trim()];
    return DEFAULT_STATE.selectedTags;
  });
  const [selectedHighlights, setSelectedHighlights] = useState<string[]>(
    searchParams?.get("flags")
      ? searchParams.get("flags")!.split(",")
      : DEFAULT_STATE.selectedHighlights,
  );
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = searchParams?.get("dateFrom");
    const to = searchParams?.get("dateTo");
    if (from && to) return { from: new Date(from), to: new Date(to) };
    if (from) return { from: new Date(from), to: undefined };
    return DEFAULT_STATE.dateRange;
  });
  const [sortBy, setSortBy] = useState<"date" | "title" | "views">(
    (searchParams?.get("sortBy") as any) || DEFAULT_STATE.sortBy,
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    (searchParams?.get("sortOrder") as any) || DEFAULT_STATE.sortOrder,
  );

  useEffect(() => {
    if (!searchParams) return;
    setSearchText(searchParams.get("q") || DEFAULT_STATE.searchText);
    setSelectedType(searchParams.get("type") || DEFAULT_STATE.selectedType);
    setSelectedFormat(
      searchParams.get("format")
        ? searchParams.get("format")!.split(",")
        : DEFAULT_STATE.selectedFormat,
    );
    setSelectedPlatform(
      searchParams.get("platform")
        ? searchParams.get("platform")!.split(",")
        : DEFAULT_STATE.selectedPlatform,
    );
    setSelectedCategories(
      searchParams.get("category")
        ? searchParams.get("category")!.split(",")
        : DEFAULT_STATE.selectedCategories,
    );
    const rawTags = searchParams.get("tags");
    const rawTag = searchParams.get("tag");
    if (rawTags) {
      setSelectedTags(rawTags.split(",").map((t) => t.trim()).filter(Boolean));
    } else if (rawTag) {
      setSelectedTags([rawTag.trim()]);
    } else {
      setSelectedTags(DEFAULT_STATE.selectedTags);
    }
    setSelectedHighlights(
      searchParams.get("flags")
        ? searchParams.get("flags")!.split(",")
        : DEFAULT_STATE.selectedHighlights,
    );

    const from = searchParams.get("dateFrom");
    const to = searchParams.get("dateTo");
    if (from && to) setDateRange({ from: new Date(from), to: new Date(to) });
    else if (from) setDateRange({ from: new Date(from), to: undefined });
    else setDateRange(DEFAULT_STATE.dateRange);

    setSortBy((searchParams.get("sortBy") as any) || DEFAULT_STATE.sortBy);
    setSortOrder(
      (searchParams.get("sortOrder") as any) || DEFAULT_STATE.sortOrder,
    );
  }, [searchParams]);

  // ── Data Fetching ──
  const { data: categoriesData, isLoading: loadingCategories } =
    useCategoryOptions();
  const categoryOptions = categoriesData || [];

  const { data: recommendedTagsData, isLoading: loadingTags } =
    useRecommendedTags();
  const tagOptions = recommendedTagsData || [];

  // ── Handler: Ganti Tipe (Berita ↔ Video) ──
  // Reset state yang tidak relevan saat tipe berubah
  const handleTypeChange = useCallback((newType: string) => {
    setSelectedType(newType);

    if (newType === "VIDEO") {
      // Video tidak mendukung: format, kategori, tags, highlights, sortBy=views
      setSelectedFormat([]);

      setSelectedCategories([]);
      setSelectedTags([]);
      setSelectedHighlights([]);
      setSortBy("date"); // Video hanya punya date sort
    } else {
      // Artikel tidak mendukung: filter platform video
      setSelectedPlatform([]);
    }
  }, []);

  // ── Handler: Submit Form ──
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({
      searchText,
      selectedType,
      selectedFormat,
      selectedCategories,
      selectedTags,
      selectedHighlights,
      selectedPlatform,
      dateRange,
      sortBy,
      sortOrder,
    });
  };

  // ── Handler: Reset Form ──
  const handleReset = () => {
    setSearchText(DEFAULT_STATE.searchText);
    setSelectedType(DEFAULT_STATE.selectedType);
    setSelectedFormat(DEFAULT_STATE.selectedFormat);
    setSelectedCategories(DEFAULT_STATE.selectedCategories);
    setSelectedTags(DEFAULT_STATE.selectedTags);
    setSelectedHighlights(DEFAULT_STATE.selectedHighlights);
    setSelectedPlatform(DEFAULT_STATE.selectedPlatform);
    setDateRange(DEFAULT_STATE.dateRange);
    setSortBy(DEFAULT_STATE.sortBy);
    setSortOrder(DEFAULT_STATE.sortOrder);
  };

  // ── Computed: Label rentang tanggal ──
  const dateRangeLabel =
    dateRange?.from &&
      dateRange.to &&
      isValid(dateRange.from) &&
      isValid(dateRange.to)
      ? `${format(dateRange.from, "dd MMM yyyy")} – ${format(dateRange.to, "dd MMM yyyy")}`
      : "Pilih rentang tanggal";

  const isArticleMode = selectedType === "ARTICLES";
  const isVideoMode = selectedType === "VIDEO";

  // ── Render ──
  return (
    <aside className={cn("py-8 md:overflow-y-auto md:max-h-[calc(100vh-200px)] md:pr-4", className)}>
      <h2 className="text-2xl lg:text-3xl font-bold text-center mb-4 hidden md:block">
        Search &amp; Filter
      </h2>

      <form
        onSubmit={handleSubmit}
        onReset={handleReset}
        className="mx-auto flex flex-col gap-4"
      >
        <FieldSet className="w-full">
          <FieldGroup className="flex flex-col gap-4">
            {/* ── Search Text ── */}
            <Field className="w-full">
              <Input
                id="search-q"
                autoComplete="off"
                placeholder="Cari berdasarkan judul, penulis, tag..."
                className="rounded-lg w-full"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </Field>

            {/* ── Date Range Picker ── */}
            <Field className="w-full">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRangeLabel}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <DayPicker
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={1}
                    showOutsideDays
                    locale={idLocale}
                  />
                </PopoverContent>
              </Popover>
            </Field>

            {/* ── Sorting ── */}
            <span className="text-sm font-semibold block">
              Urutkan Berdasar
            </span>
            <FieldGroup className="flex flex-row gap-3 items-center">
              <Field className="w-full">
                <Select
                  value={sortBy}
                  onValueChange={(v) =>
                    setSortBy(v as "date" | "title" | "views")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Urutkan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Tanggal</SelectItem>
                    {isArticleMode && (
                      <>
                        <SelectItem value="title">Judul</SelectItem>
                        <SelectItem value="views">Total View</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </Field>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() =>
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                }
                aria-label={
                  sortOrder === "asc" ? "Urutan naik" : "Urutan turun"
                }
              >
                <ArrowUp
                  className={`h-4 w-4 transition-transform duration-300 ${sortOrder === "desc" ? "rotate-180" : "rotate-0"
                    }`}
                />
              </Button>
            </FieldGroup>

            {/* ── Radio: Tipe Konten (Berita / Video) ── */}
            <Field className="w-full">
              <Collapsible>
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-semibold mb-2 block">
                    Tipe Konten
                  </span>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                      <ChevronsUpDown />
                      <span className="sr-only">Toggle details</span>
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <RadioGroup
                    value={selectedType}
                    onValueChange={handleTypeChange}
                    className="flex flex-col gap-1"
                  >
                    {TYPE_OPTIONS.map((type) => (
                      <div
                        key={type.value}
                        className="flex items-center gap-2 hover:bg-muted/30 p-1 rounded-md cursor-pointer"
                      >
                        <RadioGroupItem
                          value={type.value}
                          id={`type-${type.value}`}
                        />
                        <Label
                          htmlFor={`type-${type.value}`}
                          className="cursor-pointer font-normal text-sm w-full"
                        >
                          {type.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </CollapsibleContent>
              </Collapsible>
            </Field>

            {/* ── Filter khusus Mode Artikel ── */}
            {isArticleMode && (
              <>
                {/* Checkbox: Sorotan Khusus */}
                <Field className="w-full">
                  <Collapsible>
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm font-semibold mb-2 block">
                        Sorotan Khusus
                      </span>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <ChevronsUpDown />
                          <span className="sr-only">Toggle details</span>
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent>
                      <div className="flex flex-col gap-1">
                        {HIGHLIGHT_OPTIONS.map((hl) => (
                          <Field
                            key={hl.value}
                            orientation="horizontal"
                            className="hover:bg-muted/30 p-1 rounded-md cursor-pointer gap-2"
                          >
                            <Checkbox
                              id={`hl-${hl.value}`}
                              checked={selectedHighlights.includes(hl.value)}
                              onCheckedChange={(checked) =>
                                setSelectedHighlights((prev) =>
                                  toggleItem(prev, hl.value, checked),
                                )
                              }
                            />
                            <Label
                              htmlFor={`hl-${hl.value}`}
                              className="cursor-pointer font-normal text-sm w-full"
                            >
                              {hl.label}
                            </Label>
                          </Field>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Field>

                {/* ── Checkbox: Format Artikel (multi-select) ── */}
                <Field className="w-full">
                  <Collapsible>
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm font-semibold mb-2 block">
                        Format
                      </span>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <ChevronsUpDown />
                          <span className="sr-only">Toggle details</span>
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent>
                      <div className="flex flex-col gap-1">
                        {FORMAT_OPTIONS.map((fmt) => (
                          <Field
                            key={fmt.value}
                            orientation="horizontal"
                            className="hover:bg-muted/30 p-1 rounded-md cursor-pointer gap-2"
                          >
                            <Checkbox
                              id={`format-${fmt.value}`}
                              checked={selectedFormat.includes(fmt.value)}
                              onCheckedChange={(checked) =>
                                setSelectedFormat((prev) =>
                                  toggleItem(prev, fmt.value, checked),
                                )
                              }
                            />
                            <Label
                              htmlFor={`format-${fmt.value}`}
                              className="cursor-pointer font-normal text-sm w-full"
                            >
                              {fmt.label}
                            </Label>
                          </Field>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Field>
                {/* Checkbox: Kategori */}
                <Field className="w-full">
                  <Collapsible>
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm font-semibold mb-2 block">
                        Kategori
                      </span>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <ChevronsUpDown />
                          <span className="sr-only">Toggle details</span>
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent>
                      <div className="flex flex-wrap gap-2">
                        {loadingCategories ? (
                          <span className="text-sm text-muted-foreground">
                            Memuat kategori...
                          </span>
                        ) : (
                          categoryOptions.map((cat: any) => (
                            <Field
                              key={cat.value}
                              orientation="horizontal"
                              className="px-2 py-1 rounded-md border border-muted-foreground/20 hover:bg-muted/30 cursor-pointer gap-2 w-fit"
                            >
                              <Checkbox
                                id={`cat-${cat.value}`}
                                checked={selectedCategories.includes(cat.value)}
                                onCheckedChange={(checked) =>
                                  setSelectedCategories((prev) =>
                                    toggleItem(prev, cat.value, checked),
                                  )
                                }
                              />
                              <Label
                                htmlFor={`cat-${cat.value}`}
                                className="cursor-pointer font-normal text-sm w-full"
                              >
                                {cat.label}
                              </Label>
                            </Field>
                          ))
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Field>
              </>
            )}

            {/* ── Filter khusus Mode Video ── */}
            {isVideoMode && (
              <Field className="w-full">
                <Collapsible>
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm font-semibold mb-2 block">
                      Platform
                    </span>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <ChevronsUpDown />
                        <span className="sr-only">Toggle details</span>
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                    <div className="flex flex-col gap-1">
                      {PLATFORM_OPTIONS.map((platform) => (
                        <Field
                          key={platform.value}
                          orientation="horizontal"
                          className="hover:bg-muted/30 p-1 rounded-md cursor-pointer gap-2"
                        >
                          <Checkbox
                            id={`platform-${platform.value}`}
                            checked={selectedPlatform.includes(platform.value)}
                            onCheckedChange={(checked) =>
                              setSelectedPlatform((prev) =>
                                toggleItem(prev, platform.value, checked),
                              )
                            }
                          />
                          <Label
                            htmlFor={`platform-${platform.value}`}
                            className="cursor-pointer font-normal text-sm w-full"
                          >
                            {platform.label}
                          </Label>
                        </Field>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Field>
            )}

            {/* Checkbox: Tags */}
            {isArticleMode && (
              <Field className="w-full">
                <Collapsible>
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm font-semibold mb-2 block">Tags</span>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <ChevronsUpDown />
                        <span className="sr-only">Toggle details</span>
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                    <div className="flex flex-wrap gap-2">
                      {loadingTags ? (
                        <span className="text-xs text-muted-foreground py-2">Memuat tag...</span>
                      ) : tagOptions.length === 0 ? (
                        <span className="text-xs text-muted-foreground py-2">Tidak ada rekomendasi tag</span>
                      ) : (
                        tagOptions.map((tag) => (
                          <Field
                            key={tag.slug}
                            orientation="horizontal"
                            className="px-2 py-1 rounded-md border border-muted-foreground/20 hover:bg-muted/30 cursor-pointer gap-2 w-fit"
                          >
                            <Checkbox
                              id={`tag-${tag.slug}`}
                              checked={selectedTags.includes(tag.slug)}
                              onCheckedChange={(checked) =>
                                setSelectedTags((prev) =>
                                  toggleItem(prev, tag.slug, checked),
                                )
                              }
                            />
                            <Label
                              htmlFor={`tag-${tag.slug}`}
                              className="cursor-pointer font-normal text-sm w-full"
                            >
                              {tag.name}
                            </Label>
                          </Field>
                        ))
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Field>
            )}

            {/* ── Action Buttons ── */}
            <div className="grid grid-cols-2 gap-4 w-full">
              <Button
                type="reset"
                variant="outline"
                className="rounded-lg text-sm"
              >
                Reset
              </Button>
              <Button type="submit" className="rounded-lg text-sm">
                Cari
              </Button>
            </div>
          </FieldGroup>
        </FieldSet>
      </form>
    </aside>
  );
}
