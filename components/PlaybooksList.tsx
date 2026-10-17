"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Stack } from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { removePlaybook, type Playbook } from "@/lib/actions";

export default function PlaybooksList({ playbooks }: { playbooks: Playbook[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await removePlaybook(id);
    } finally {
      setDeletingId(null);
    }
  }

  const columns: GridColDef<Playbook>[] = [
    { field: "name", headerName: "Name", flex: 1 },
    { field: "description", headerName: "Description", flex: 2 },
    {
      field: "created_at",
      headerName: "Created",
      flex: 1,
      valueGetter: (_value, row) => new Date(row.created_at).toLocaleString(),
    },
    {
      field: "actions",
      headerName: "",
      sortable: false,
      filterable: false,
      align: "right",
      flex: 1,
      renderCell: (params) => (
        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
          <Button
            size="small"
            color="error"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(params.row.id);
            }}
            disabled={deletingId === params.row.id}
          >
            {deletingId === params.row.id ? "Deleting..." : "Delete"}
          </Button>
        </Stack>
      ),
    },
  ];

  return (
    <DataGrid
      autoHeight
      rows={playbooks}
      columns={columns}
      density="compact"
      disableRowSelectionOnClick
      onRowClick={(params) => router.push(`/playbooks/${params.row.id}`)}
      sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
    />
  );
}
