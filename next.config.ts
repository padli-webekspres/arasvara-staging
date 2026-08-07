import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** Hostname LAN dari NEXT_PUBLIC_BASE_URL (tanpa port), untuk MinIO image patterns. */
const getDevLanHost = (): string | null => {
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (!base) return null;
  try {
    const hostname = new URL(base).hostname;
    if (hostname && !LOCAL_HOSTS.has(hostname)) return hostname;
  } catch {
    // Abaikan jika bukan URL valid
  }
  return null;
};

/** Origin dev (host:port) dari NEXT_PUBLIC_BASE_URL, untuk allowedDevOrigins. */
const getDevLanOrigin = (): string | null => {
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (!base) return null;
  try {
    const url = new URL(base);
    if (!url.hostname || LOCAL_HOSTS.has(url.hostname)) return null;
    return url.port ? `${url.hostname}:${url.port}` : url.hostname;
  } catch {
    // Abaikan jika bukan URL valid
  }
  return null;
};

/** localhost + port yang sama dengan NEXT_PUBLIC_BASE_URL (mis. localhost:3030). */
const getLocalDevOrigins = (): string[] => {
  const origins = ["localhost", "127.0.0.1", "localhost:3000", "localhost:3001"];
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (!base) return origins;
  try {
    const url = new URL(base);
    if (url.port) {
      origins.push(`localhost:${url.port}`, `127.0.0.1:${url.port}`);
    }
  } catch {
    // Abaikan jika bukan URL valid
  }
  return origins;
};

const devLanHost = getDevLanHost();
const devLanOrigin = getDevLanOrigin();

const remotePatterns: Exclude<NonNullable<NextConfig["images"]>["remotePatterns"], undefined> = [
  {
    protocol: "https",
    hostname: "www.dentika.net",
  },
  {
    protocol: "https",
    hostname: "images.unsplash.com",
  },
  {
    protocol: "http",
    hostname: "localhost",
    port: "9000",
    pathname: "/**",
  },
  {
    protocol: "http",
    hostname: "localhost",
    port: "9001",
    pathname: "/**",
  },
];

if (devLanHost) {
  remotePatterns.push(
    {
      protocol: "http",
      hostname: devLanHost,
      port: "9000",
      pathname: "/**",
    },
    {
      protocol: "http",
      hostname: devLanHost,
      port: "9001",
      pathname: "/**",
    },
  );
}

// Tambahkan hostname dinamis dari env jika ada
const parseAndAddEnvHost = (envUrl?: string) => {
  if (!envUrl) return;
  try {
    const url = new URL(envUrl);
    const hostname = url.hostname;
    const protocol = url.protocol.replace(":", "");
    const port = url.port;

    if (protocol !== "http" && protocol !== "https") return;

    if (hostname && !LOCAL_HOSTS.has(hostname) && hostname !== devLanHost) {
      remotePatterns.push({
        protocol,
        hostname,
        port: port || undefined,
        pathname: "/**",
      });
    }
  } catch {
    // Abaikan jika bukan URL valid
  }
};

parseAndAddEnvHost(process.env.S3_ENDPOINT);
parseAndAddEnvHost(process.env.NEXT_PUBLIC_STORAGE_CONFIGURATION);
parseAndAddEnvHost(process.env.NEXT_PUBLIC_STORAGE_MEDIA);
parseAndAddEnvHost(process.env.NEXT_PUBLIC_STORAGE_BASE_URL);

const allowedDevOrigins = [
  ...new Set([
    ...(devLanOrigin ? [devLanOrigin] : []),
    ...(devLanHost ? [devLanHost] : []),
    ...getLocalDevOrigins(),
    "192.168.0.193",
    "192.168.0.193:3000",
    "192.168.0.193:3001",
    "192.168.0.193:9000",
    "192.168.0.245",
    "192.168.0.245:3000",
    "192.168.0.245:3001",
    "arasvara.id",
    "*.arasvara.id",
    "staging-arasvara.vercel.app",
    "https://staging-arasvara.vercel.app",
    "https://demoarasvara.vercel.app",
  ]),
];

const nextConfig: NextConfig = {
  output: "standalone",
  /** Izinkan akses dev dari LAN (host dari NEXT_PUBLIC_BASE_URL). */
  allowedDevOrigins,
  images: {
    remotePatterns,
    /** Dev: izinkan next/image fetch dari MinIO LAN (192.168.x.x). Prod CDN publik tidak perlu ini. */
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
    localPatterns: [
      {
        pathname: "/api/media/view",
      },
      {
        pathname: "/media/view",
      },
      { pathname: "/placeholder.jpg" },
      { pathname: "/logo-arasvara/**" },
      { pathname: "/og/**" },
      { pathname: "/ads-banner/**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/logo-arasvara/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
          {
            key: "Access-Control-Allow-Origin",
            value: process.env.CORS_ORIGINS || "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          { key: "Access-Control-Allow-Headers", value: "*" },
        ],
      },
    ];
  },
  reactCompiler: true,
};

export default withBundleAnalyzer(nextConfig);
