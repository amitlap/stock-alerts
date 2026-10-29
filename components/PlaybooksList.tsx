"use client";

import { useRouter } from "next/navigation";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { removePlaybook, type Playbook } from "@/lib/actions";
import { usePendingId } from "@/lib/hooks";
import { clickableRowsSx } from "./alertGrid";
import RowActionButton from "./RowActionButton";

export default function PlaybooksList({ playbooks }: { playbooks: Playbook[] }) {
  const router = useRouter();
  const deleting = usePendingId();

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
      renderCell: ({ row }) => (
        <RowActionButton
          color="error"
          onClick={() => deleting.run(row.id, () => removePlaybook(row.id))}
          pending={deleting.pendingId === row.id}
          pendingLabel="Deleting..."
        >
          Delete
        </RowActionButton>
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
      sx={clickableRowsSx}
    />
  );
}
