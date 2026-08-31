export type FooterNap = {
  address?: string;
  phone?: string;
  phoneHref?: string;
};

/** Parse nomor simpanan (62xxx / 0xxx / +62xxx) ke tampilan `+62 …`. */
export function formatPhoneDisplay(rawPhone: string): string {
  if (!rawPhone) return "";
  let digits = rawPhone.trim();
  if (digits.startsWith("+62")) {
    digits = digits.slice(3);
  } else if (digits.startsWith("62")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  const rest = digits.trim();
  if (!rest) return "";
  return `+62 ${rest}`;
}

/** `tel:` href dari nomor simpanan atau tampilan. */
export function phoneTelHref(rawOrDisplay: string): string {
  const digits = rawOrDisplay.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) return `tel:+${digits}`;
  if (digits.startsWith("0")) return `tel:+62${digits.slice(1)}`;
  return `tel:+62${digits}`;
}

/** NAP Footer: null jika alamat dan telepon sama-sama kosong. */
export function buildFooterNap(
  address?: string | null,
  phoneRaw?: string | null,
): FooterNap | null {
  const trimmedAddress = address?.trim() ?? "";
  const trimmedPhone = phoneRaw?.trim() ?? "";
  const phone = trimmedPhone ? formatPhoneDisplay(trimmedPhone) : "";
  const phoneHref = trimmedPhone ? phoneTelHref(trimmedPhone) : "";
  if (!trimmedAddress && !phone) return null;
  return {
    ...(trimmedAddress ? { address: trimmedAddress } : {}),
    ...(phone ? { phone, phoneHref } : {}),
  };
}
