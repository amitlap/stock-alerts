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
import {
  addAlertTransition,
  removeAlertTransition,
  removePlaybook,
  setAlertPlaybook,
  updateAlertTransition,
  updatePlaybook,
  type AlertTransition,
  type Playbook,
} from "@/lib/actions";
import type { AlertOperator } from "@/lib/stockUtils";
import AddAlertForm from "./AddAlertForm";
import AlertRelationshipGraph from "./AlertRelationshipGraph";

type PlaybookAlert = {
  id: number;
  stock: string;
  email: string;
  price?: number | null;
  operator?: AlertOperator | null;
  isActive?: boolean | null;
  created_at: string;
};

export default function PlaybookDetailView({
  playbook,
  linkedAlerts,
  availableAlerts,
  transitions,
}: {
  playbook: Playbook;
  linkedAlerts: PlaybookAlert[];
  availableAlerts: PlaybookAlert[];
  transitions: AlertTransition[];
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
  const [sourceAlertId, setSourceAlertId] = useState("");
  const [targetAlertId, setTargetAlertId] = useState("");
  const [condition, setCondition] = useState("");
  const [explanation, setExplanation] = useState("");
  const [addingTransition, setAddingTransition] = useState(false);
  const [removingTransitionId, setRemovingTransitionId] = useState<number | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  function alertLabel(alert: PlaybookAlert, fallbackId: number): string {
    if (!alert) return `#${fallbackId}`;
    return `${alert.stock} ${alert.operator ?? ">"} ${alert.price ?? "?"}`;
  }


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

  async function handleAddTransition() {
    if (!sourceAlertId || !targetAlertId) return;
    setTransitionError(null);
    setAddingTransition(true);
    try {
      await addAlertTransition({
        playbook_id: playbook.id,
        source_alert_id: Number(sourceAlertId),
        target_alert_id: Number(targetAlertId),
        condition: condition.trim() || null,
        explanation: explanation.trim() || null,
      });
      setSourceAlertId("");
      setTargetAlertId("");
      setCondition("");
      setExplanation("");
      router.refresh();
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : String(err));
    } finally {
      setAddingTransition(false);
    }
  }

  async function handleRemoveTransition(transitionId: number) {
    setRemovingTransitionId(transitionId);
    try {
      await removeAlertTransition(transitionId, playbook.id);
      router.refresh();
    } finally {
      setRemovingTransitionId(null);
    }
  }

  // Called by the grid after an inline edit; persists only the fields that actually changed.
  async function handleTransitionRowUpdate(
    newRow: AlertTransition,
    oldRow: AlertTransition
  ): Promise<AlertTransition> {
    if (newRow.source_alert_id === newRow.target_alert_id) {
      throw new Error("Source and target alerts must be different");
    }

    const updates: Parameters<typeof updateAlertTransition>[2] = {};
    if (newRow.source_alert_id !== oldRow.source_alert_id) {
      updates.source_alert_id = newRow.source_alert_id;
    }
    if (newRow.target_alert_id !== oldRow.target_alert_id) {
      updates.target_alert_id = newRow.target_alert_id;
    }
    if (newRow.condition !== oldRow.condition) {
      updates.condition = newRow.condition ?? null;
    }
    if (newRow.explanation !== oldRow.explanation) {
      updates.explanation = newRow.explanation ?? null;
    }

    if (Object.keys(updates).length === 0) {
      return oldRow;
    }

    const updated = await updateAlertTransition(newRow.id, playbook.id, updates);
    router.refresh();
    return updated;
  }

  const alertOptions = linkedAlerts.map((alert) => ({
    value: alert.id,
    label: alertLabel(alert, alert.id),
  }));

  const transitionColumns: GridColDef<AlertTransition>[] = [
    {
      field: "source_alert_id",
      headerName: "From",
      flex: 1,
      type: "singleSelect",
      valueOptions: alertOptions,
      editable: true,
    },
    {
      field: "target_alert_id",
      headerName: "To",
      flex: 1,
      type: "singleSelect",
      valueOptions: (params) =>
        alertOptions.filter((option) => option.value !== params.row?.source_alert_id),
      editable: true,
    },
    { field: "condition", headerName: "Condition", flex: 1, editable: true },
    { field: "explanation", headerName: "Explanation", flex: 1.5, editable: true },
    {
      field: "actions",
      headerName: "",
      sortable: false,
      filterable: false,
      align: "right",
      flex: 0.6,
      renderCell: (params) => (
        <Button
          size="small"
          color="error"
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveTransition(params.row.id);
          }}
          disabled={removingTransitionId === params.row.id}
        >
          {removingTransitionId === params.row.id ? "Removing..." : "Remove"}
        </Button>
      ),
    },
  ];

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
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 420px" },
        gap: 2,
        alignItems: "start",
        mt: 1.5,
      }}
    >
      <Stack spacing={2}>
        <Paper component="section" elevation={1} sx={{ p: 2.5 }}>
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

        <Paper component="section" elevation={1} sx={{ p: 2.5 }}>
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

        <Paper component="section" elevation={1} sx={{ p: 2.5 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Alert flow
          </Typography>

          {transitions.length === 0 ? (
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              No transitions recorded yet.
            </Typography>
          ) : (
            <DataGrid
              autoHeight
              rows={transitions}
              columns={transitionColumns}
              density="compact"
              disableRowSelectionOnClick
              processRowUpdate={handleTransitionRowUpdate}
              onProcessRowUpdateError={(err) =>
                setTransitionError(err instanceof Error ? err.message : String(err))
              }
              sx={{ mb: 2 }}
            />
          )}


          {linkedAlerts.length >= 2 && (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
                <TextField
                  select
                  size="small"
                  label="From alert"
                  value={sourceAlertId}
                  onChange={(e) => setSourceAlertId(e.target.value)}
                  sx={{ minWidth: 180 }}
                >
                  {linkedAlerts.map((alert) => (
                    <MenuItem key={alert.id} value={alert.id}>
                      {alert.stock} {alert.operator ?? ">"} {alert.price}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="To alert"
                  value={targetAlertId}
                  onChange={(e) => setTargetAlertId(e.target.value)}
                  sx={{ minWidth: 180 }}
                >
                  {linkedAlerts
                    .filter((alert) => String(alert.id) !== sourceAlertId)
                    .map((alert) => (
                      <MenuItem key={alert.id} value={alert.id}>
                        {alert.stock} {alert.operator ?? ">"} {alert.price}
                      </MenuItem>
                    ))}
                </TextField>
              </Stack>
              <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
                <TextField
                  size="small"
                  label="Condition"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  sx={{ minWidth: 200 }}
                />
                <TextField
                  size="small"
                  label="Explanation"
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  sx={{ flex: 1, minWidth: 200 }}
                />
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleAddTransition}
                  disabled={!sourceAlertId || !targetAlertId || addingTransition}
                >
                  {addingTransition ? "Adding..." : "Add"}
                </Button>
              </Stack>
              {transitionError && <Typography color="error">{transitionError}</Typography>}
            </Stack>
          )}
        </Paper>
      </Stack>

      <AlertRelationshipGraph alerts={linkedAlerts} transitions={transitions} />

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
    </Box>
  );
}
