"use client";

import Link from "next/link";
import UserAvatar from "@/components/users/AvatarUser";
import { Badge } from "@/components/ui/badge";
import { Article } from "@/types/article";
import { User } from "@/types/user";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import EditUserDialog from "@/components/users/EditUserDialog";
import ChangePasswordDialog from "./ChangePasswordDialog";
import NewsCard from "../news/NewsCard";
import { ROLES } from "@/lib/auth-client";

interface ProfileUiProps {
    user: User;
    articles: Article[];
    totalArticles: number;
}

function formatDate(value?: Date | string): string {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    }).format(date);
}

function prettifyRole(role?: string): string {
    if (!role) return "-";
    return role
        .toLowerCase()
        .split("-")
        .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
        .join(" ");
}

export default function ProfileUi({
    user,
    articles,
    totalArticles,
}: ProfileUiProps) {
    const router = useRouter();
    const { data: currentUser } = useCurrentUser();
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const isOwnProfile = useMemo(() => {
        if (!currentUser) return false;
        return currentUser._id === user._id || currentUser.email === user.email;
    }, [currentUser, user._id, user.email]);

    const isInternalUser = useMemo(() => {
        if (!currentUser) return false;
        const allowedRoles = [
            ROLES.ADMIN,
            ROLES.EDITOR_IN_CHIEF,
            ROLES.MANAGING_EDITOR,
            ROLES.HEAD_OF,
            ROLES.EDITOR,

            // Level Penulis
            ROLES.REPORTER,
            ROLES.WRITER,
            ROLES.CONTRIBUTOR,

            // Level Bisnis
            ROLES.ACCOUNT_EXECUTIVE,
        ]
        return allowedRoles.includes(currentUser.role);
    }, [currentUser]);

    return (
        <main className="container mx-auto px-4 py-10 space-y-10">
            <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                    <div>
                        <div className="flex items-start gap-4">
                            <UserAvatar
                                avatar={user.avatar}
                                name={user.name || user.email || "User"}
                                className="h-20 w-20 shrink-0 border border-border"
                            />
                            <div className="space-y-2">
                                <h1 className="text-2xl font-bold leading-tight md:text-3xl">
                                    {user.name}
                                </h1>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                        </div>
                        {user.bio ? (
                            <p className="mt-6 text-sm leading-relaxed text-foreground/90">{user.bio}</p>
                        ) : (
                            <p className="mt-6 text-sm text-muted-foreground">
                                Pengguna ini belum menambahkan bio.
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-background p-4 text-sm md:min-w-[220px]">
                        <div>
                            <p className="text-muted-foreground">Total Artikel</p>
                            <p className="text-lg font-semibold">{totalArticles}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Bergabung</p>
                            <p className="text-lg font-semibold">{formatDate(user.createdAt)}</p>
                        </div>

                        {/* current user adalah writer keatas */}
                        {isInternalUser && (
                            <>
                                <div>
                                    <p className="text-muted-foreground">Role</p>
                                    <p className="text-lg font-semibold">{prettifyRole(user.role)}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Team</p>
                                    <p className="text-lg font-semibold">{user.team?.name || "-"}</p>
                                </div>
                            </>
                        )}
                        {isOwnProfile && (
                            <Button
                                variant="outline"
                                className="col-span-2 mt-2 w-full"
                                type="button"
                                onClick={() => setIsEditDialogOpen(true)}
                            >
                                Edit Profil
                            </Button>
                        )}
                        {(isOwnProfile || currentUser?.role?.toLowerCase() === "admin") && (
                            <Button
                                variant="outline"
                                className="col-span-2 mt-2 w-full"
                                type="button"
                                onClick={() => setIsChangePasswordOpen(true)}
                            >
                                Change Password
                            </Button>
                        )}
                    </div>
                </div>
            </section>

            {isOwnProfile && (
                <EditUserDialog
                    open={isEditDialogOpen}
                    onOpenChange={setIsEditDialogOpen}
                    user={user}
                    onUpdated={() => {
                        router.refresh();
                    }}
                />
            )}
            {(isOwnProfile || currentUser?.role?.toLowerCase() === "admin") && (
                <ChangePasswordDialog
                    open={isChangePasswordOpen}
                    onOpenChange={setIsChangePasswordOpen}
                    targetUserId={isOwnProfile ? undefined : user._id.toString()}
                />
            )}

            <section className="space-y-4">
                <div className="flex items-end justify-between">
                    <div>
                        <h2 className="text-xl font-semibold md:text-2xl">Artikel Ditulis</h2>
                        <p className="text-sm text-muted-foreground">
                            Daftar artikel yang dipublikasikan oleh penulis ini.
                        </p>
                    </div>
                </div>

                {articles.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                        Belum ada artikel yang dapat ditampilkan.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {articles.map((article) => (
                            <NewsCard key={article._id} article={article} />
                        ))}
                    </div>
                )}
            </section>
        </main >
    );
}