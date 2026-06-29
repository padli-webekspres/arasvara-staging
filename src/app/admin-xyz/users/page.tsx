
"use client";
import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  Search,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Plus,
  MoreVertical,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// Remove AlertDialog imports, use DialogConfirmInputDelete instead
import DialogConfirmInputDelete from "@/components/ui/DialogConfirmInputDelete";
import UserDetailDialog from "@/components/users/UserDetailDialog";
import CreateUserDialog from "@/components/users/CreateUserDialog";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import UserAvatar from "@/components/users/AvatarUser";
import { User } from "@/types/user";
import { ROLES } from "@/lib/constants";
import { getPageNumbers } from "@/lib/utils";
import { ADMIN_PAGINATION_WRAP } from "@/lib/admin-ui";
import { ListTable, ListTableColumn } from "@/components/table/ListTable";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import ChangePasswordDialog from "@/components/profile/ChangePasswordDialog";

const LIMIT = 10;

import EditUserDialog from "@/components/users/EditUserDialog";

const UsersPage = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [passwordResetUser, setPasswordResetUser] = useState<User | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState<string>("");
  const [deleteEmail, setDeleteEmail] = useState<string>("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const search = searchParams.get("search") || "";
  const [searchInput, setSearchInput] = useState(search);
  const role = searchParams.get("role") || "all";
  const page = parseInt(searchParams.get("page") || "1", 10);

  const updateParams = (params: Record<string, string | number>) => {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (v === "" || v === "all") sp.delete(k);
      else sp.set(k, String(v));
    });
    startTransition(() => {
      router.push(`?${sp.toString()}`);
    });
  };

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== search) {
        updateParams({ search: searchInput, page: 1 });
      }
    }, 500);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["users", search, role, page],
    queryFn: async () => {
      let url = `/users?limit=${LIMIT}&page=${page}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (role && role !== "all") url += `&role=${encodeURIComponent(role)}`;
      const { data } = await api.get(url);
      return data as { users: User[]; total: number; totalPages: number };
    },
    placeholderData: (prev) => prev,
  });

  const users = data?.users ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  const getRoleLabel = (roleValue: string) => {
    return ROLES.find((r) => r.value === roleValue)?.label || roleValue;
  };

  const getRoleColor = (roleValue: string) => {
    return ROLES.find((r) => r.value === roleValue)?.color || "bg-gray-400";
  };

  // Dummy handlers — akan diimplementasikan nanti
  const handleView = (user: User) => {
    setViewUserId(user._id);
  };

  const handleEdit = (user: User) => {
    setEditUser(user);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await api.delete(`/users/${deleteId}`);
      if (res.status >= 400 || res.data?.error) {
        toast.error(res.data?.error || "Gagal menghapus user");
      } else {
        toast.success(`User "${deleteName}" deleted successfully`);
        setDeleteId(null);
        setDeleteName("");
        setDeleteEmail("");
        refetch();
      }
    } catch (error: unknown) {
      let errorMessage = "Gagal menghapus user";
      if (typeof error === "object" && error !== null) {
        // Check for AxiosError shape
        type ErrorWithResponse = { response?: { data?: { error?: string } } };
        const err = error as Partial<ErrorWithResponse> & { message?: string };
        if (err.response?.data?.error && typeof err.response.data.error === "string") {
          errorMessage = err.response.data.error;
        } else if (err.message && typeof err.message === "string") {
          errorMessage = err.message;
        }
      }
      toast.error(errorMessage);
      setDeleteId(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: ListTableColumn<User>[] = [
    {
      key: "name",
      header: "User",
      render: (row) => (
        <div className="flex items-center gap-3">
          <UserAvatar
            avatar={row.avatar}
            name={row.name || row.email || "User"}
            className="h-9 w-9 shrink-0"
          />
          <div className="min-w-0">
            <p className="font-medium line-clamp-1">{row.name}</p>
            <p className="text-sm text-muted-foreground line-clamp-1">
              {row.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (row) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs text-white font-medium ${getRoleColor(row.role)}`}
        >
          {getRoleLabel(row.role)}
        </span>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      render: (row) =>
        row.isActive !== false ? (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Active
          </Badge>
        ) : (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Inactive
          </Badge>
        ),
    },
    {
      key: "team",
      header: <span className="hidden lg:inline">Tim</span>,
      className: "p-4 hidden lg:table-cell",
      render: (row) => row.team?.name || "-",
    },
    {
      key: "actions",
      header: <span className="float-right">Actions</span>,
      className: "text-right p-4 font-medium",
      render: (row) => (
        <div className="flex items-center justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => handleView(row)}>
                <Eye className="h-4 w-4 mr-2" />
                <span>Detail</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEdit(row)}>
                <Edit className="h-4 w-4 mr-2" />
                <span>Edit</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPasswordResetUser(row)}>
                <Key className="h-4 w-4 mr-2" />
                <span>Ganti Password</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setDeleteId(row._id);
                  setDeleteName(row.name);
                  setDeleteEmail(row.email);
                }}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];
  console.log("User 1 joined:", users[0]?.createdAt);

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground">
            Manage all users ({total} total)
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={role}
          onValueChange={(v) => updateParams({ role: v, page: 1 })}
        >
          <SelectTrigger className="w-full md:w-52">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <div className="bg-card rounded-lg border border-border overflow-x-auto min-w-0">
        <ListTable
          columns={columns}
          data={users}
          loading={isFetching}
          emptyText="No users found"
          rowKey={(row) => row._id}
        />

        {totalPages > 1 && (
          <Pagination className="my-4 flex-wrap justify-center">
            <PaginationContent className={ADMIN_PAGINATION_WRAP}>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page > 1) updateParams({ page: page - 1 });
                  }}
                  className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              {getPageNumbers(page, totalPages).map((num, idx) =>
                num === "..." ? (
                  <PaginationItem key={`ellipsis-${idx}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={num}>
                    <PaginationLink
                      href="#"
                      isActive={page === num}
                      onClick={(e) => {
                        e.preventDefault();
                        if (page !== num) updateParams({ page: num as number });
                      }}
                    >
                      {num}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page < totalPages) updateParams({ page: page + 1 });
                  }}
                  className={
                    page >= totalPages ? "pointer-events-none opacity-50" : ""
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>


      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => refetch()}
      />

      {editUser && (
        <EditUserDialog
          open={!!editUser}
          onOpenChange={(open) => {
            if (!open) setEditUser(null);
          }}
          user={editUser}
          onUpdated={() => {
            setEditUser(null);
            refetch();
          }}
        />
      )}

      <UserDetailDialog
        userId={viewUserId}
        onOpenChange={(open) => !open && setViewUserId(null)}
      />

      {passwordResetUser && (
        <ChangePasswordDialog
          open={!!passwordResetUser}
          onOpenChange={(open) => {
            if (!open) setPasswordResetUser(null);
          }}
          targetUserId={passwordResetUser._id}
          isAdminPageReset={true}
        />
      )}

      {/* Delete Confirmation Dialog with email input */}
      <DialogConfirmInputDelete
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
            setDeleteName("");
            setDeleteEmail("");
            setDeleteLoading(false);
          }
        }}
        email={deleteEmail}
        loading={deleteLoading}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};

export default UsersPage;
