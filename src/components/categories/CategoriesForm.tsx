"use client";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { Controller, type UseFormReturn } from "react-hook-form";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { Loader2 } from "lucide-react";
import type { CategoryFormInput, CategoryFormValues } from "./categoryFormSchema";

export type CategoryParentOption = { label: string; value: string };

interface CategoriesFormProps {
  form: UseFormReturn<CategoryFormInput, unknown, CategoryFormValues>;
  parentOptions: CategoryParentOption[];
  submitting: boolean;
  onReset: () => void;
  onSubmit: (data: CategoryFormValues) => void;
  mode?: "create" | "edit";
  /** ID unik untuk menghindari bentrok aksesibilitas */
  formId?: string;
}

const CategoriesForm = ({
  form,
  parentOptions,
  submitting,
  onReset,
  onSubmit,
  mode = "create",
  formId = "category-form",
}: CategoriesFormProps) => {
  return (
    <form id={formId} onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Controller
          name="parentId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${formId}-parent`}>Kategori induk</FieldLabel>
              <SearchableSelect
                id={`${formId}-parent`}
                options={parentOptions}
                placeholder="Pilih kategori induk (opsional)…"
                value={field.value}
                onChange={field.onChange}
                isMulti={false}
                disabled={submitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${formId}-name`}>Nama kategori</FieldLabel>
              <Input
                {...field}
                id={`${formId}-name`}
                aria-invalid={fieldState.invalid}
                placeholder="Contoh: Teknologi, Olahraga"
                autoComplete="off"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="nickname"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${formId}-nickname`}>
                Nama panggilan (navbar)
              </FieldLabel>
              <Input
                {...field}
                id={`${formId}-nickname`}
                aria-invalid={fieldState.invalid}
                placeholder="Singkatan untuk masthead (opsional)"
                autoComplete="off"
                maxLength={48}
              />
              <FieldDescription>
                Jika diisi, teks pendek ini dipakai di navbar (maks. 48 karakter).
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="description"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field className="lg:col-span-2" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${formId}-desc`}>Deskripsi</FieldLabel>
              <InputGroup>
                <InputGroupTextarea
                  {...field}
                  id={`${formId}-desc`}
                  placeholder="Deskripsi singkat cakupan kanal ini…"
                  rows={4}
                  className="min-h-24 resize-none"
                  aria-invalid={fieldState.invalid}
                  maxLength={100}
                />
                <InputGroupAddon align="block-end">
                  <InputGroupText className="tabular-nums">
                    {field.value.length}/100 karakter
                  </InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>Panjang 10–100 karakter.</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <div className="lg:col-span-2 flex flex-row gap-4 justify-end">
          <Button
            className="w-fit"
            type="button"
            variant="outline"
            onClick={onReset}
            disabled={submitting}
          >
            Atur ulang
          </Button>
          <Button className="w-fit" type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {submitting
              ? mode === "edit"
                ? "Menyimpan…"
                : "Menambahkan…"
              : mode === "edit"
                ? "Simpan perubahan"
                : "Tambah kategori"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
};

export default CategoriesForm;
