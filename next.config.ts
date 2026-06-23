import type { NextConfig } from "next";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

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

const devLanHost = getDevLanHost();

const remotePatterns: any[] = [
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
  ...(devLanHost ? [devLanHost] : []),
  "https://demoarasvara.vercel.app",
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

export default nextConfig;
