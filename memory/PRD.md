# ARASVARA News Website - Product Requirements Document

## Overview

ARASVARA adalah platform berita modern yang dibangun dengan Next.js, MongoDB, dan TailwindCSS. Platform ini menyediakan pengalaman membaca berita yang responsif dengan sistem manajemen konten (CMS) yang lengkap.

## Domain

- Domain: arasvara.id
- Preview URL: arasvara-news.preview.emergentagent.com

## Technology Stack

- **Frontend**: Next.js 16, React, TailwindCSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: MongoDB
- **Editor**: TipTap WYSIWYG
- **Auth**: JWT Token-based authentication

## Features Implemented & Improvements (2026)

### Frontend (Public)

#### Improvements (2026)

- **Editorial Workflow**: Status artikel sudah enum (DRAFT, PENDING_REVIEW, APPROVED, PUBLISHED, SCHEDULED, REJECTED, TAKEN_DOWN) dan konsisten di seluruh sistem. Alur editorial mengikuti best practice newsroom.
- **Category Page**: Sudah menggunakan React Query (useInfiniteQuery), loading state, dan grid responsif. Pola fetching konsisten dengan homepage.
- **UI/UX**: Key prop di NewsCard sudah benar (tidak ada warning React). Next.js Image Optimization sudah support Unsplash. Loading skeleton diterapkan di homepage & kategori.
- **TypeScript & Type Safety**: Semua status, permission, dan form data sudah type-safe. Tidak ada error TypeScript pada form, autosave, dan permission.

1. **Homepage**
   - Headline slider dengan auto-rotate
   - Featured articles grid
   - "In the News" section
   - Earlier stories dengan load more
   - Responsive design

2. **News Detail Page**
   - Full-width hero image
   - Article content dengan typography yang bagus
   - Social share buttons (Facebook, Twitter, LinkedIn)
   - Related articles section
   - View count tracking
   - JSON-LD Schema markup

3. **Category Pages**
   - Filter berita berdasarkan kategori
   - Pagination dengan load more

4. **Navigation**
   - Fixed header dengan kategori navigation
   - Hamburger menu untuk mobile
   - Footer dengan links dan social media

5. **Authentication**
   - Login page dengan demo credentials
   - Register page
   - OAuth placeholders (Google, Facebook, X)

### Admin Dashboard

#### Improvements (2026)

- **Roles & Permissions**: Sistem permission sudah granular, konsisten, dan mudah di-maintain. ALL_PERMISSIONS & ROLE_PERMISSIONS sudah di-refactor. Penamaan permission jelas dan mudah dipahami.
- **Editorial Workflow**: Status artikel type-safe, enum, dan konsisten di seluruh dashboard/admin.

1. **Dashboard Overview**
   - Stats cards (total articles, published, views, users)
   - Top performing articles
   - Quick actions

2. **Article Management**
   - Articles list dengan filtering dan search
   - Status badges (published, draft, pending)
   - Edit dan delete actions

3. **Article Editor**
   - TipTap WYSIWYG editor
   - Toolbar: Bold, Italic, Underline, Strikethrough, Highlight
   - Headings (H1, H2, H3)
   - Text alignment
   - Lists (bullet, numbered)
   - Blockquote, Code
   - Link, Image, YouTube embedding
   - Featured image upload (URL-based, MOCK for S3)
   - Category dan tags
   - Publishing options (Featured, Headline, Schedule)
   - Auto-save setiap 30 detik

4. **User Management**
   - User list dengan roles
   - Create, edit, delete users
   - Role assignment (Admin, Editor-in-Chief, Editor, Writer, Subscriber)
   - Active/Inactive status

5. **Analytics**
   - Overview stats
   - User KPIs (articles written, published, views)
   - Articles by category chart
   - Top performing articles

### Backend APIs

1. **Authentication**
   - POST /api/auth/register
   - POST /api/auth/login
   - GET /api/auth/me

2. **Articles**
   - GET /api/articles (with pagination, filters)
   - GET /api/articles/headlines
   - GET /api/articles/featured
   - GET /api/articles/slug/:slug
   - GET /api/articles/:id
   - POST /api/articles
   - PUT /api/articles/:id
   - DELETE /api/articles/:id
   - POST /api/articles/autosave

3. **Categories**
   - GET /api/categories

4. **Users**
   - GET /api/users
   - POST /api/users
   - PUT /api/users/:id
   - DELETE /api/users/:id

5. **Analytics**
   - GET /api/analytics/dashboard
   - GET /api/analytics/user-kpi
   - POST /api/analytics/pageview

6. **SEO**
   - GET /sitemap.xml
   - GET /robots.txt
   - GET /api/sitemap

## Integration Placeholders (MOCKED)

### AWS S3 (Media Upload)

- Environment variables prepared in .env:
  - AWS_ACCESS_KEY_ID
  - AWS_SECRET_ACCESS_KEY
  - AWS_REGION
  - AWS_S3_BUCKET
- Currently using URL-based image upload (mock)

### Firebase Cloud Messaging

- Environment variables prepared:
  - FIREBASE_API_KEY
  - FIREBASE_AUTH_DOMAIN
  - FIREBASE_PROJECT_ID
  - FIREBASE_STORAGE_BUCKET
  - FIREBASE_MESSAGING_SENDER_ID
  - FIREBASE_APP_ID
  - FIREBASE_MEASUREMENT_ID

### Google Analytics 4

- Environment variable: NEXT_PUBLIC_GA_MEASUREMENT_ID
- Auto-injects GA script when configured

### Google Search Console

- Environment variable: GOOGLE_SITE_VERIFICATION
- Auto-adds verification meta tag when configured

### OAuth Providers

- Environment variables prepared for Google, Facebook, X (Twitter)
- UI placeholders shown on login page

## Demo Credentials

- **Email**: admin@arasvara.id
- **Password**: admin123

## Roles & Permissions

### Improvements (2026)

- Permissions sudah granular, maintainable, dan type-safe. Sudah di-refactor agar mudah dikembangkan.
  | Role | Permissions |
  |------|-------------|
  | Admin | All access |
  | Editor-in-Chief | Publish, takedown, edit, create, view, manage users |
  | Editor | Publish, edit, create, view |
  | Writer | Create, edit own articles, view |
  | Subscriber | View only |

## Categories

- International
- Business
- Tech
- Sports
- Weather
- Entertainment
- Lifestyle
- Automotive
- Health
- Food
- Career

## Color Scheme

- Background: Cream/Beige (#f5f0e8)
- Primary: Dark (#1a1a1a)
- Accent: Orange (#d97706)
- Supporting: Light grays and whites

## Technical Improvements (2026)

- Editorial workflow sudah best practice, status enum, type-safe.
- Roles & permissions sudah granular, maintainable, dan type-safe.
- Category page sudah pakai React Query infinite scroll & loading state.
- Semua error TypeScript pada form, autosave, dan permission sudah diatasi.
- UI/UX: key prop, image optimization, skeleton loading sudah diperbaiki.

## Next Steps (Enhancement Ideas)

1. Implement actual AWS S3 integration for media upload
2. Configure OAuth providers (Google, Facebook, X)
3. Setup Firebase for push notifications
4. Add Google Analytics tracking
5. Implement comment system
6. Add newsletter subscription
7. Implement search functionality
8. Add social media embed support (Instagram, TikTok embeds)
9. Create export to PDF/Excel for reports
10. Build Looker Studio dashboard integration
