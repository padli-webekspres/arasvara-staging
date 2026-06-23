
"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, Eye, Edit, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/axios";
import { ListTable, type ListTableColumn } from "@/components/table/ListTable";
import CreateTeamDialog from "@/components/teams/CreateTeamDialog";
import EditTeamDialog from "@/components/teams/EditTeamDialog";
import DeleteTeamDialog from "@/components/teams/DeleteTeamDialog";
import TeamDetailDialog from "@/components/teams/TeamDetailDialog";
import type { Team } from "@/types/team";

const LIMIT = 10;

const TeamsPage = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [deleteTeamOpen, setDeleteTeamOpen] = useState(false);
  const [viewTeamOpen, setViewTeamOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const search = searchParams.get("search") || "";
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

  // Debounce search input (500ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== search) {
        updateParams({ search: searchInput, page: 1 });
      }
    }, 500);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Fetch teams
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["teams", search, page],
    queryFn: async () => {
      let url = `/teams?limit=${LIMIT}&page=${page}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const { data } = await api.get(url);
      return data as {
        teams: Team[];
        total?: number;
        nextCursor?: string | null;
      };
    },
    placeholderData: (prev) => prev,
  });

  const teams = data?.teams ?? [];
  const total = data?.total ?? 0;

  // Dummy handlers
  const handleView = (team: Team) => {
    setSelectedTeamId(team._id as string);
    setSelectedTeam(team);
    setViewTeamOpen(true);
  };

  const handleEdit = (team: Team) => {
    setSelectedTeam(team);
    setEditTeamOpen(true);
  };

  const handleDelete = (team: Team) => {
    setSelectedTeam(team);
    setDeleteTeamOpen(true);
  };

  const columns: ListTableColumn<Team>[] = [
    {
      key: "name",
      header: "Nama Tim",
      render: (row) => <p className="font-medium">{row.name}</p>,
    },
    {
      key: "actions",
      header: <span className="float-right">Aksi</span>,
      className: "text-right p-4 font-medium",
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleView(row)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(row)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(row)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tim</h1>
          <p className="text-muted-foreground">
            Kelola semua tim ({total} total)
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Tim
        </Button>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari berdasarkan nama..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Teams Table */}
      <div className="bg-card rounded-lg border border-border overflow-x-auto min-w-0">
        <ListTable
          columns={columns}
          data={teams}
          loading={isFetching}
          emptyText="Tidak ada tim"
          rowKey={(row) => (row._id as string)}
        />
      </div>

      {/* Create Team Dialog */}
      <CreateTeamDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => refetch()}
      />

      {/* Edit and Delete Dialogs */}
      {selectedTeam && (
        <>
          <EditTeamDialog
            open={editTeamOpen}
            onOpenChange={setEditTeamOpen}
            team={selectedTeam}
            onUpdated={() => refetch()}
          />
          <DeleteTeamDialog
            open={deleteTeamOpen}
            onOpenChange={setDeleteTeamOpen}
            team={selectedTeam}
            onDeleted={() => refetch()}
          />
        </>
      )}

      {/* Team Detail Dialog */}
      <TeamDetailDialog
        open={viewTeamOpen}
        onOpenChange={setViewTeamOpen}
        teamId={selectedTeamId}
        teamName={selectedTeam?.name || ""}
      />
    </div>
  );
};

export default TeamsPage;
