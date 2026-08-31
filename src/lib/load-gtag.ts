export const GTAG_SCRIPT_ID = "ga-gtag";

/** ID GA4 resmi: G- diikuti huruf/angka. */
export function isGaMeasurementId(id: string): boolean {
  return /^G-[A-Z0-9]+$/i.test(id.trim());
}

/** Pasang stub gtag agar event mengantre di dataLayer sebelum gtag.js diunduh. */
export function installGtagStub(
  measurementId: string,
  win: {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  },
): void {
  const dataLayer = (win.dataLayer || []) as unknown[];
  win.dataLayer = dataLayer;
  win.gtag = function gtag() {
    // Samakan snippet resmi: Arguments object, bukan rest array.
    // eslint-disable-next-line prefer-rest-params
    dataLayer.push(arguments as unknown as never);
  };
  win.gtag("js", new Date());
  win.gtag("config", measurementId, { send_page_view: false });
}

/** Unduh gtag.js sekali. onerror dibiarkan — stub tetap menampung event. */
export function injectGtagScript(measurementId: string, doc: Document): void {
  if (doc.getElementById(GTAG_SCRIPT_ID)) return;
  const script = doc.createElement("script");
  script.id = GTAG_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.onerror = () => {
    // ponytail: biarkan stub; sama seperti adblock.
  };
  doc.head.appendChild(script);
}
