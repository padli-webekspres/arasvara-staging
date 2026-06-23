"use client";

import * as React from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { option } from "@/types/general";


interface SearchableSelectProps {
  options: option[];
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  isMulti?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Optional callback triggered when user types in the search input */
  onInputChange?: (value: string) => void;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  isMulti = false,
  disabled = false,
  className,
  id,
  onInputChange,
}) => {
  const [open, setOpen] = React.useState(false);

  // Normalize value for easier handling
  const selectedValues = React.useMemo(
    () =>
      isMulti
        ? Array.isArray(value)
          ? value
          : []
        : typeof value === "string"
          ? [value]
          : [],
    [value, isMulti],
  );

  const handleSelect = (val: string) => {
    if (isMulti) {
      if (selectedValues.includes(val)) {
        onChange(selectedValues.filter((v) => v !== val));
      } else {
        onChange([...selectedValues, val]);
      }
      // Keep popover open for multi
    } else {
      onChange(val);
      setOpen(false);
    }
  };

  const handleRemove = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMulti) {
      onChange(selectedValues.filter((v) => v !== val));
    }
  };

  const displayLabel = () => {
    if (isMulti) return null;
    const selected = options.find((opt) => opt.value === selectedValues[0]);
    return selected ? selected.label : placeholder;
  };

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            role="combobox"
            variant={"outline"}
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between min-h-10",
              isMulti && "flex-wrap min-h-10 h-auto py-2",
            )}
          >
          {isMulti ? (
            <div className="flex flex-wrap gap-1 items-center flex-1">
              {selectedValues.length === 0 && (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
              {selectedValues.map((val) => {
                const opt = options.find((o) => o.value === val);
                if (!opt) return null;
                return (
                  <Badge
                    key={val}
                    variant="secondary"
                    className="pr-1 pl-2 flex items-center gap-1"
                  >
                    {opt.label}
                    <X
                      className="ml-1 h-3 w-3 cursor-pointer"
                      onClick={(e) => handleRemove(val, e)}
                      aria-label="Remove"
                    />
                  </Badge>
                );
              })}
            </div>
          ) : (
            <span className={cn(!selectedValues[0] && "text-muted-foreground")}>
              {displayLabel()}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-(--radix-popover-trigger-width) min-w-55">
        <Command>
          <CommandInput
            placeholder="Search..."
            onValueChange={(inputValue) => {
              // Trigger parent callback if provided (for async search support)
              onInputChange?.(inputValue);
            }}
          />
          <CommandEmpty>No option found.</CommandEmpty>
          <CommandGroup>
            {options.map((opt) => (
              <CommandItem
                key={opt.id || opt.value}
                /* Gabung label + value agar filter cmdk mencocokkan nama/teks tampilan */
                value={`${opt.label} ${opt.value}`}
                onSelect={() => handleSelect(opt.value)}
                disabled={disabled}
              >
                <span className="flex-1">{opt.label}</span>
                {selectedValues.includes(opt.value) && (
                  <Check className="ml-2 h-4 w-4 text-primary" />
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
    </div>
  );
};

export default SearchableSelect;
