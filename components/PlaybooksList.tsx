"use client";

import { useRouter } from "next/navigation";
import { Typography } from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { removePlaybook, type PlaybookWithSteps } from "@/lib/actions";
import { usePendingId } from "@/lib/hooks";
import { formatAlertLabel, getStepStatus } from "@/lib/stockUtils";
import PlaybookProgress from "./PlaybookProgress";
import RowActionButton from "./RowActionButton";

export default function PlaybooksList({ playbooks }: { playbooks: PlaybookWithSteps[] }) {
  const router = useRouter();
  const deleting = usePendingId();

  function handleDelete(playbook: PlaybookWithSteps) {
    if (!window.confirm(`Delete "${playbook.name}" and all its steps?`)) return;
    deleting.run(playbook.id, () => removePlaybook(playbook.id));
  }

  const columns: GridColDef<PlaybookWithSteps>[] = [
    { field: "name", headerName: "Name", flex: 1.2 },
    {
      field: "progress",
      headerName: "Progress",
      flex: 1,
      sortable: false,
      renderCell: ({ row }) => <PlaybookProgress steps={row.alerts} compact />,
    },
    {
      field: "watching",
      headerName: "Watching",
      flex: 1.2,
      valueGetter: (_value, row) =>
        row.alerts
          .filter((step) => getStepStatus(step) === "watching")
          .map(formatAlertLabel)
          .join(", ") || "—",
    },
    {
      field: "created_at",
      headerName: "Created",
      flex: 0.8,
      valueGetter: (_value, row) => new Date(row.created_at).toLocaleDateString(),
    },
    {
      field: "actions",
      headerName: "",
      sortable: false,
      filterable: false,
      align: "right",
      flex: 0.6,
      renderCell: ({ row }) => (
        <RowActionButton
          color="error"
          onClick={() => handleDelete(row)}
          pending={deleting.pendingId === row.id}
          pendingLabel="Deleting..."
        >
          Delete
        </RowActionButton>
      ),
    },
  ];

  return (
    <>
      {deleting.error && (
        <Typography color="error" variant="body2" sx={{ mb: 1 }}>
          Couldn&apos;t delete the playbook: {deleting.error}
        </Typography>
      )}
      <DataGrid
      autoHeight
      rows={playbooks}
      columns={columns}
      rowHeight={60}
      disableRowSelectionOnClick
      onRowClick={(params) => router.push(`/playbooks/${params.row.id}`)}
      sx={{
        "& .MuiDataGrid-row": { cursor: "pointer" },
        "& .MuiDataGrid-cell": { display: "flex", alignItems: "center" },
      }}
      />
    </>
  );
}
