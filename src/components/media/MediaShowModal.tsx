"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Badge } from "../ui/badge";
import { PencilLineIcon, X } from "lucide-react";
import type { Media } from "@/types/media";
import { Button } from "../ui/button";
import MediaEditForm from "./MediaEditForm";
import { toast } from "sonner";

interface MediaShowModalProps {
    open: boolean;
    media: Media;
    onClose: () => void;
}

/**
 * Hitung rata-rata luminance dari image element untuk menentukan warna gradient.
 * Menggunakan canvas untuk sampling pixel image.
 */
async function getImageLuminance(imageSrc: string): Promise<number> {
    return new Promise((resolve) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                resolve(128); // Default neutral
                return;
            }

            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            let total = 0;
            let count = 0;
            const sampleStep = 10; // Sample every 10th pixel untuk performa

            for (let i = 0; i < data.length; i += 4 * sampleStep) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                // Formula luminance standar (ITU-R BT.601)
                total += 0.299 * r + 0.587 * g + 0.114 * b;
                count++;
            }

            const luminance = count > 0 ? total / count : 128;
            resolve(luminance);
        };
        img.onerror = () => resolve(128); // Default jika gagal load
        img.src = imageSrc;
    });
}



const MediaShowModal = ({ open, media, onClose }: MediaShowModalProps) => {
    const [luminance, setLuminance] = useState(128); // Default: neutral gray
    const [showEditForm, setShowEditForm] = useState(false);
    const [mediaData, setMediaData] = useState<Media>(media);
    const imageRef = useRef<HTMLImageElement>(null);

    // Sync media prop to local state if modal reopened with different media
    useEffect(() => {
        setMediaData(media);
    }, [media]);

    // Hitung luminance saat modal dibuka atau media berubah
    useEffect(() => {
        if (!open) return;
        getImageLuminance(mediaData.url).then((lum) => {
            setLuminance(lum);
        });
    }, [open, mediaData.url]);

    // Tutup modal jika tekan ESC (kecuali sedang edit)
    useEffect(() => {
        if (!open || showEditForm) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, onClose, showEditForm]);

    // Gradient & style logic
    const isDarkImage = luminance <= 128;
    const gradientClass = isDarkImage
        ? "from-white/80 to-transparent"
        : "from-black/80 to-transparent";
    const textColorClass = isDarkImage ? "text-black" : "text-white";
    const badgeVariant = isDarkImage ? "default" : "secondary";

    const getMediaType = (): string => {
        if (mediaData.mimetype?.startsWith("image/")) return "Image";
        if (mediaData.mimetype?.startsWith("video/")) return "Video";
        return "File";
    };

    // Handler for edit success (optimistic update)
    const handleEditSuccess = (updated: Media) => {
        setMediaData(updated);
        setShowEditForm(false);
        toast.success("Media updated successfully");
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/25"
                onClick={onClose}
                aria-label="Close modal background"
            />
            {/* Modal Content */}
            <div className="relative w-full max-w-7xl mx-auto bg-black rounded-lg overflow-hidden z-10">
                {/* Close Button */}
                {!showEditForm && (
                    <Button
                        variant="outline"
                        type="button"
                        onClick={onClose}
                        className="absolute top-2 right-2 z-50 opacity-50"
                        aria-label="Close modal"
                    >
                        <X className="h-4 w-4 text-black" />
                    </Button>
                )}
                {/* Image */}
                <Image
                    ref={imageRef}
                    unoptimized
                    src={mediaData.url}
                    alt={mediaData.caption || "Media"}
                    width={1200}
                    height={800}
                    className="w-full h-auto object-cover"
                    priority
                />
                {/* Gradient Overlay + Info di bawah gambar */}
                <div
                    className={`absolute inset-x-0 bottom-0 bg-linear-to-t ${gradientClass} p-6`}
                >
                    <div className="flex flex-col md:flex-row md:justify-between md:gap-4 pt-4 md:pt-8 md:items-center w-full">
                        <div className="flex flex-col md:flex-row md:items-center md:gap-4 gap-2 ">
                            <Badge variant={badgeVariant} className="w-fit text-sm lg:text-base lg:px-3 py-1">
                                {getMediaType()}
                            </Badge>
                            {mediaData.credit && (
                                <p className={`lg:text-lg font-medium ${textColorClass}`}>
                                    Credit: {mediaData.credit}
                                </p>
                            )}
                            {mediaData.caption && (
                                <p className={`lg:text-lg ${textColorClass}`}>{mediaData.caption}</p>
                            )}
                        </div>
                        <Button
                            variant={badgeVariant}
                            size="lg"
                            onClick={() => setShowEditForm(true)}
                            disabled={showEditForm}
                        >
                            <PencilLineIcon />
                            Edit
                        </Button>
                    </div>
                </div>
                {/* Edit Form Overlay */}
                {showEditForm && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
                        <div className="relative w-full max-w-lg mx-auto bg-card rounded-lg shadow-lg p-6">
                            <MediaEditForm
                                media={mediaData}
                                onSuccess={handleEditSuccess}
                                onCancel={() => setShowEditForm(false)}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MediaShowModal;
