import { ArticleStatus } from "@/types/article";

export const CATEGORIES = [
  { id: "international", name: "International", slug: "international" },
  { id: "business", name: "Business", slug: "business" },
  { id: "tech", name: "Tech", slug: "tech" },
  { id: "sports", name: "Sports", slug: "sports" },
  { id: "weather", name: "Weather", slug: "weather" },
  { id: "entertainment", name: "Entertainment", slug: "entertainment" },
  { id: "lifestyle", name: "Lifestyle", slug: "lifestyle" },
  { id: "automotive", name: "Automotive", slug: "automotive" },
  { id: "health", name: "Health", slug: "health" },
  { id: "food", name: "Food", slug: "food" },
];

// allowedRoles: array of role value (string) yang boleh memilih status ini
export const ARTICLE_STATUS: {
  status: ArticleStatus;
  label: string;
  allowedRoles: string[];
}[] = [
  {
    status: ArticleStatus.DRAFT,
    label: "Waiting",
    allowedRoles: [
      "admin",
      "editor-in-chief",
      "managing-editor",
      "head-of",
      "editor",
      "reporter",
      "writer",
      "contributor",
    ],
  },
  {
    status: ArticleStatus.PENDING_REVIEW,
    label: "Pending Review",
    allowedRoles: [
      "admin",
      "editor-in-chief",
      "managing-editor",
      "head-of",
      "editor",
      "reporter",
      "writer",
      "contributor",
    ],
  },
  {
    status: ArticleStatus.PUBLISHED,
    label: "Published",
    allowedRoles: [
      "admin",
      "editor-in-chief",
      "managing-editor",
      "head-of",
      "editor",
    ],
  },
  {
    status: ArticleStatus.SCHEDULED,
    label: "Scheduled",
    allowedRoles: [
      "admin",
      "editor-in-chief",
      "managing-editor",
      "head-of",
      "editor",
    ],
  },
  {
    status: ArticleStatus.REJECTED,
    label: "Rejected",
    allowedRoles: [
      "admin",
      "editor-in-chief",
      "managing-editor",
      "head-of",
      "editor",
    ],
  },
  {
    status: ArticleStatus.TAKEN_DOWN,
    label: "Taken Down",
    allowedRoles: ["admin", "editor-in-chief", "editor"],
  },
  {
    status: ArticleStatus.DELETED,
    label: "Deleted",
    allowedRoles: ["editor-in-chief", "admin"],
  },
];

export const NAV_LINKS = [
  { name: "Home", href: "/" },
  { name: "International", href: "/category/international" },
  { name: "Business", href: "/category/business" },
  { name: "Tech", href: "/category/tech" },
  { name: "Sports", href: "/category/sports" },
  { name: "Weather", href: "/category/weather" },
  { name: "Entertainment", href: "/category/entertainment" },
  { name: "Lifestyle", href: "/category/lifestyle" },
  { name: "Automotive", href: "/category/automotive" },
  { name: "Health", href: "/category/health" },
  { name: "Food", href: "/category/food" },
];

export const FOOTER_SECTION_LINKS = [
  {
    name: "Populer",
    href: "/search?type=ARTICLES&flags=popular",
  },
  {
    name: "Pilihan editor",
    href: "/search?type=ARTICLES&flags=editor_choice",
  },
  {
    name: "Headline",
    href: "/search?type=ARTICLES&flags=headline",
  },
  {
    name: "Arah Lensa",
    href: "/search?type=ARTICLES&format=GALLERY",
  },
  {
    name: "Social media",
    href: "/search?type=VIDEO",
  },
] as const;

export const FOOTER_MORE = [
  { name: "Indeks Berita", href: "/indeks" },
  { name: "About us", href: "/about-us" },
  { name: "Disclaimer", href: "/disclaimer" },
  { name: "Pedoman media siber", href: "/pedoman-media-siber" },
  { name: "Redaksi", href: "/about-us#struktur-redaksi" },
];

export const SOCIAL_LINKS = [
  {
    name: "Instagram",
    href: "https://instagram.com/arasvara",
    icon: "instagram",
  },
  { name: "Threads", href: "https://threads.net/@arasvara", icon: "threads" },
  {
    name: "LinkedIn",
    href: "https://linkedin.com/company/arasvara",
    icon: "linkedin",
  },
  { name: "X", href: "https://x.com/arasvara", icon: "x" },
];

export const SAMPLE_IMAGES = {
  news: [
    "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=800",
    "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800",
    "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800",
  ],
  business: [
    "https://images.unsplash.com/photo-1709715357520-5e1047a2b691?w=800",
    "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=800",
    "https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?w=800",
  ],
  city: [
    "https://images.unsplash.com/photo-1518242007602-8d2524b53ddd?w=800",
    "https://images.unsplash.com/photo-1515963665762-77ef90e624fa?w=800",
    "https://images.unsplash.com/photo-1538516960-a49f0bdd7452?w=800",
  ],
  sports: [
    "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800",
    "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800",
  ],
  technology: [
    "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800",
    "https://images.pexels.com/photos/546819/pexels-photo-546819.jpeg?w=800",
  ],
  entertainment: [
    "https://images.unsplash.com/photo-1603190287605-e6ade32fa852?w=800",
    "https://images.unsplash.com/photo-1499364615650-ec38552f4f34?w=800",
  ],
  politics: [
    "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800",
    "https://images.unsplash.com/photo-1523995462485-3d171b5c8fa9?w=800",
  ],
  health: [
    "https://images.unsplash.com/photo-1477332552946-cfb384aeaf1c?w=800",
    "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=800",
  ],
  food: [
    "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=800",
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800",
  ],
  automotive: [
    "https://images.unsplash.com/photo-1567789884554-0b844b597180?w=800",
    "https://images.unsplash.com/photo-1676288176903-a68732722cce?w=800",
  ],
};

export const ROLES = [
  // Level 1: Super Admin
  { value: "admin", label: "Super Admin", color: "bg-primary" },

  // Level 2: Top Level Management (Redaksi)
  {
    value: "editor-in-chief",
    label: "Pemimpin Redaksi (Pemred)",
    color: "bg-purple-600",
  },

  // Level 5: Gatekeeper
  { value: "editor", label: "Editor", color: "bg-blue-500" },

  // Level 6: Content Creators
  { value: "writer", label: "Content Writer", color: "bg-green-400" },

  // --- TIM BISNIS (Baru) ---
  {
    value: "account-executive",
    label: "Account Executive (Iklan)",
    color: "bg-teal-600", // Warna pembeda (Teal = Bisnis/Uang)
  },
];
