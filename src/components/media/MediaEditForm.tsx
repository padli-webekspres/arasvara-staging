"use client";

import { useForm } from "react-hook-form";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import api from "@/lib/axios";
import type { Media } from "@/types/media";

// ─── Types ────────────────────────────────────────────────────────────────────


export interface MediaEditFormProps {
  media: Media;
  onSuccess: (media: Media) => void;
  onCancel?: () => void;
}

// ─── Schema ───────────────────────────────────────────────────────────────────


const schema = z.object({
  caption: z.string().max(200).optional(),
  credit: z.string().max(100).optional(),
});
type FormValues = z.infer<typeof schema>;

// ─── Component ────────────────────────────────────────────────────────────────


export default function MediaEditForm({ media, onSuccess, onCancel }: MediaEditFormProps) {
  const [loading, setLoading] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      caption: media.caption || "",
      credit: media.credit || "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      // Dummy PATCH endpoint
      console.log("Submitting update for media", media._id);
      const res = await api.patch<{ success: boolean; media: Media }>(
        `/media/${media._id}`,
        {
          caption: values.caption,
          credit: values.credit,
        }
      );
      if (!res.data?.media) throw new Error("Invalid response from server");
      toast.success("Media updated successfully");
      onSuccess(res.data.media);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err instanceof Error ? err.message : "Update failed");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-4">
          <div className="flex-1 flex flex-col gap-3">
            <FormField
              control={form.control}
              name="caption"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Caption</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Caption (optional)" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="credit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credit</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Photographer (optional)" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
