import { useCurrentUser } from "@/hooks/useCurrentUser";
import { adminPanelHref } from "@/lib/admin-panel-path";
import { ROLES } from "@/lib/auth-client";
import { UserProfile } from "@/types/user";
import Link from "next/link";

interface PageNavbarProps {
  pathname: string;
}

const PageNavbar = ({ pathname }: PageNavbarProps) => {
  // cek sudah login atau belum
  const { data: user } = useCurrentUser();
  return (
    <div className="flex items-center gap-4">
      {user?.role.includes(
        ROLES.ADMIN,
        ROLES.EDITOR_IN_CHIEF,
        ROLES.MANAGING_EDITOR,
        ROLES.HEAD_OF,
        ROLES.EDITOR,
        ROLES.REPORTER,
        ROLES.WRITER,
        ROLES.CONTRIBUTOR,
        ROLES.ACCOUNT_EXECUTIVE,
      ) && (
        <Link
          href={adminPanelHref("")}
          className={`text-sm font-medium capitalize tracking-wider ${
            pathname === adminPanelHref()
              ? "text-hijauSawah"
              : "text-foreground/80"
          } hover:text-hijauSawah transition-colors`}
        >
          Dashboard
        </Link>
      )}
    </div>
  );
};

export default PageNavbar;
