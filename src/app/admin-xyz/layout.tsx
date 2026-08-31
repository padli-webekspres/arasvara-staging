import { redirect } from "next/navigation";
import { getAccessTokenFromCookieStore, getUserFromToken } from "@/lib/auth";
import { ROLES } from "@/lib/auth-client";
import AdminLayoutClient from "@/components/layout/AdminLayoutClient";
import { ArticleContentPaginationProvider } from "@/components/admin/ArticleContentPaginationFlag";
import { isArticleContentPaginationEnabled } from "@/lib/article-content-pagination";
import { ThemeProvider } from "next-themes";

// Next.js 16: Use server component for layout, do auth check on server
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get token from cookies (server-side)
  const token = await getAccessTokenFromCookieStore();
  if (!token) {
    redirect("/login");
  }

  const user = await getUserFromToken(token);
  if (
    !user ||
    ![
      ROLES.ADMIN,
      ROLES.EDITOR_IN_CHIEF,
      ROLES.MANAGING_EDITOR,
      ROLES.EDITOR,
      ROLES.WRITER,
    ]
      .map((role) => role.toLowerCase())
      .includes(user.role?.toLowerCase())
  ) {
    redirect("/");
  }

  // Sidebar state must be client-side
  // Use a Client Component for sidebar toggling
  // We'll wrap the sidebar/main in a ClientWrapper
  return (
    // <ThemeProvider
    //   attribute="class"
    //   defaultTheme="light"
    //   enableSystem
    //   disableTransitionOnChange
    // >
    // </ThemeProvider>
    <ArticleContentPaginationProvider
      enabled={isArticleContentPaginationEnabled()}
    >
      <AdminLayoutClient user={user}>{children}</AdminLayoutClient>
    </ArticleContentPaginationProvider>
  );
}
