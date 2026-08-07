"use client";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useState, useEffect, useRef, useCallback } from "react";
import MediaFormModal from "@/components/media/MediaFormModal";
import CardMedia from "@/components/media/CardMedia";
import { SearchIcon } from "lucide-react";
import api from "@/lib/axios";
import type { Media } from "@/types/media";

type MediaListResponse = {
  success: boolean;
  media: Media[];
  nextCursor?: string;
};

const LIMIT = 20;

export default function MediaPage() {
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Build query params for API
  const buildQueryParams = (cursor?: string) => {
    const params = new URLSearchParams();
    params.set("limit", LIMIT.toString());
    if (cursor) params.set("cursor", cursor);
    if (filter && filter !== "all") params.set("filter", filter);
    if (debouncedSearch.trim() !== "")
      params.set("query", debouncedSearch.trim());
    return params.toString();
  };

  // Fetch media (initial or on filter/search change)
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    api
      .get<MediaListResponse>(`/media?${buildQueryParams()}`)
      .then(({ data }) => {
        if (!isMounted) return;
        setMedia(data.media);
        setNextCursor(data.nextCursor);
        setHasMore(!!data.nextCursor);
      })
      .catch(() => {
        if (isMounted) setError("Gagal memuat media");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, debouncedSearch]);

  // Load more via cursor (with filter/search)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const { data } = await api.get<MediaListResponse>(
        `/media?${buildQueryParams(nextCursor)}`,
      );
      setMedia((prev) => [...prev, ...data.media]);
      setNextCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    } catch {
      // silently fail, user can scroll again
    } finally {
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, hasMore, nextCursor, filter, debouncedSearch]);

  // IntersectionObserver to trigger loadMore
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  // Debounce search input
  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 1500);
    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [search]);

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Media</h1>
          <p className="text-muted-foreground">Manage all your media files</p>
        </div>
        {/* Tombol New Media */}
        <button
          className="inline-flex items-center px-4 py-2 bg-primary text-white rounded"
          onClick={() => setShowMediaModal(true)}
        >
          <span className="mr-2">+</span> New Media
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <InputGroup>
            <InputGroupInput
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
        </div>
        <Select value={filter} onValueChange={(val) => setFilter(val)}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Filter Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Media Grid */}
      <div className="bg-card rounded-lg border border-border p-4 overflow-hidden min-h-50 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 items-start gap-4 min-w-0">
        {loading ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            Loading media...
          </div>
        ) : error ? (
          <div className="col-span-full text-center py-8 text-destructive">
            {error}
          </div>
        ) : media.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            Belum ada media
          </div>
        ) : (
          media.map((item) => (
            <CardMedia
              key={item._id}
              media={item}
              onDeleted={(id) =>
                setMedia((prev) => prev.filter((m) => m._id !== id))
              }
            />
          ))
        )}
        {/* Infinite scroll sentinel */}
        {!loading && hasMore && (
          <div
            ref={sentinelRef}
            className="col-span-full flex justify-center py-4"
          >
            {loadingMore && (
              <span className="text-sm text-muted-foreground">
                Memuat lebih banyak...
              </span>
            )}
          </div>
        )}
      </div>

      {/* MediaFormModal */}
      {showMediaModal && (
        <MediaFormModal
          onClose={() => setShowMediaModal(false)}
          onSuccess={(newMedia) => setMedia((prev) => [newMedia, ...prev])}
        />
      )}
    </div>
  );
}
