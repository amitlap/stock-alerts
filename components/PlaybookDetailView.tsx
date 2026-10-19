"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { removePlaybook, setAlertPlaybook, updatePlaybook, type Playbook } from "@/lib/actions";
import type { AlertOperator } from "@/lib/stockUtils";
import AddAlertForm from "./AddAlertForm";

type PlaybookAlert = {
  id: number;
  stock: string;
  email: string;
  price?: number | null;
  operator?: AlertOperator | null;
  isActive?: boolean | null;
};

export default function PlaybookDetailView({
  playbook,
  linkedAlerts,
  availableAlerts,
}: {
  playbook: Playbook;
  linkedAlerts: PlaybookAlert[];
  availableAlerts: PlaybookAlert[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(playbook.name ?? "");
  const [description, setDescription] = useState(playbook.description ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null);
  const [selectedAlertId, setSelectedAlertId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSaveDescription() {
    setSaving(true);
    setError(null);
    try {
      await updatePlaybook(playbook.id, {
        name: name.trim(),
        description: description.trim(),
        email: playbook.email,
      });
      setEditOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePlaybook() {
    setDeleting(true);
    try {
      await removePlaybook(playbook.id);
      router.push("/playbooks");
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddAlert() {
    if (!selectedAlertId) return;
    setLinking(true);
    try {
      await setAlertPlaybook(Number(selectedAlertId), playbook.id);
      setSelectedAlertId("");
      router.refresh();
    } finally {
      setLinking(false);
    }
  }

  async function handleRemoveAlert(alertId: number) {
    setUnlinkingId(alertId);
    try {
      await setAlertPlaybook(alertId, null);
      router.refresh();
    } finally {
      setUnlinkingId(null);
    }
  }

  const columns: GridColDef<PlaybookAlert>[] = [
    { field: "stock", headerName: "Stock", flex: 1 },
    {
      field: "condition",
      headerName: "Condition",
      flex: 1,
      valueGetter: (_value, row) => `${row.operator ?? ">"} ${row.price ?? "?"}`,
    },
    { field: "isActive", headerName: "Active", type: "boolean", flex: 0.75 },
    {
      field: "actions",
      headerName: "",
      sortable: false,
      filterable: false,
      align: "right",
      flex: 1,
      renderCell: (params) => (
        <Button
          size="small"
          color="error"
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveAlert(params.row.id);
          }}
          disabled={unlinkingId === params.row.id}
        >
          {unlinkingId === params.row.id ? "Removing..." : "Remove"}
        </Button>
      ),
    },
  ];

  return (
    <Stack spacing={3} sx={{ mt: 2 }}>
      <Paper component="section" elevation={1} sx={{ p: 4 }}>
        <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="h5" component="h1">
              {playbook.name || `Playbook #${playbook.id}`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              created {new Date(playbook.created_at).toLocaleString()} · {playbook.email}
            </Typography>
            <Typography variant="body1" sx={{ mt: 2, whiteSpace: "pre-wrap" }}>
              {playbook.description || "No description yet."}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button size="small" color="error" onClick={handleDeletePlaybook} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper component="section" elevation={1} sx={{ p: 4 }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Typography variant="h6">Alerts in this playbook</Typography>
          <Stack direction="row" spacing={1}>
            {availableAlerts.length > 0 && (
              <>
                <TextField
                  select
                  size="small"
                  label="Add alert"
                  value={selectedAlertId}
                  onChange={(e) => setSelectedAlertId(e.target.value)}
                  sx={{ minWidth: 200 }}
                >
                  {availableAlerts.map((alert) => (
                    <MenuItem key={alert.id} value={alert.id}>
                      {alert.stock} {alert.operator ?? ">"} {alert.price}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleAddAlert}
                  disabled={!selectedAlertId || linking}
                >
                  Add
                </Button>
              </>
            )}
            <AddAlertForm
              buttonLabel="Create Alert"
              defaultEmail={playbook.email}
              playbookId={playbook.id}
              onCreated={() => router.refresh()}
            />
          </Stack>
        </Stack>
        {linkedAlerts.length === 0 ? (
          <Typography color="text.secondary">No alerts linked yet.</Typography>
        ) : (
          <DataGrid
            autoHeight
            rows={linkedAlerts}
            columns={columns}
            density="compact"
            disableRowSelectionOnClick
            onRowClick={(params) => router.push(`/alerts/${params.row.id}`)}
            sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
          />
        )}
      </Paper>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Playbook</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              size="small"
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <TextField
              label="Description"
              size="small"
              fullWidth
              multiline
              minRows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {error && <Typography color="error">{error}</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveDescription} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
