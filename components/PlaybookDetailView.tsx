"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, Chip, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
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
import { useAsyncAction, usePendingId } from "@/lib/hooks";
import { formatAlertLabel, getErrorMessage, type AlertRow } from "@/lib/stockUtils";
import AddAlertForm from "./AddAlertForm";
import AlertRelationshipGraph from "./AlertRelationshipGraph";
import FormDialog from "./FormDialog";
import RowActionButton from "./RowActionButton";

type PlaybookAlert = AlertRow & { created_at: string };

function alertMenuItems(alerts: PlaybookAlert[]) {
  return alerts.map((alert) => (
    <MenuItem key={alert.id} value={alert.id}>
      {formatAlertLabel(alert)}
    </MenuItem>
  ));
}

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
  const [deleting, setDeleting] = useState(false);
  const [linking, setLinking] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState("");
  const [sourceAlertId, setSourceAlertId] = useState("");
  const [targetAlertId, setTargetAlertId] = useState("");
  const [condition, setCondition] = useState("");
  const [explanation, setExplanation] = useState("");
  const savePlaybook = useAsyncAction();
  // Also holds errors from inline grid edits, so both show in the same place.
  const addTransition = useAsyncAction();
  const unlinking = usePendingId();
  const removingTransition = usePendingId();

  async function handleSaveDescription() {
    const saved = await savePlaybook.run(() =>
      updatePlaybook(playbook.id, {
        name: name.trim(),
        description: description.trim(),
        email: playbook.email,
      }),
    );
    if (saved) {
      setEditOpen(false);
      router.refresh();
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

  function handleRemoveAlert(alertId: number) {
    return unlinking.run(alertId, async () => {
      await setAlertPlaybook(alertId, null);
      router.refresh();
    });
  }

  async function handleAddTransition() {
    if (!sourceAlertId || !targetAlertId) return;
    const added = await addTransition.run(() =>
      addAlertTransition({
        playbook_id: playbook.id,
        source_alert_id: Number(sourceAlertId),
        target_alert_id: Number(targetAlertId),
        condition,
        explanation,
      }),
    );
    if (added) {
      setSourceAlertId("");
      setTargetAlertId("");
      setCondition("");
      setExplanation("");
      router.refresh();
    }
  }

  function handleRemoveTransition(transitionId: number) {
    return removingTransition.run(transitionId, async () => {
      await removeAlertTransition(transitionId, playbook.id);
      router.refresh();
    });
  }

  // Called by the grid after an inline edit; saves the whole edited row.
  async function handleTransitionRowUpdate(row: AlertTransition): Promise<AlertTransition> {
    addTransition.setError(null);
    const updated = await updateAlertTransition(row.id, row);
    router.refresh();
    return updated;
  }

  const alertOptions = linkedAlerts.map((alert) => ({
    value: alert.id,
    label: formatAlertLabel(alert),
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
      renderCell: ({ row }) => (
        <RowActionButton
          color="error"
          onClick={() => handleRemoveTransition(row.id)}
          pending={removingTransition.pendingId === row.id}
          pendingLabel="Removing..."
        >
          Remove
        </RowActionButton>
      ),
    },
  ];

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 50vw" },
        gap: 2,
        alignItems: "start",
        mt: 1.5,
      }}
    >
      <Paper component="section" elevation={1} sx={{ p: 2.5, gridColumn: "1 / -1" }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" component="h1">
              {playbook.name || `Playbook #${playbook.id}`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              created {new Date(playbook.created_at).toLocaleString()} · {playbook.email}
            </Typography>
            <Typography variant="body1" sx={{ mt: 1.5, whiteSpace: "pre-wrap" }}>
              {playbook.description || "No description yet."}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Button size="small" variant="outlined" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button size="small" color="error" onClick={handleDeletePlaybook} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Stack spacing={2} sx={{ minWidth: 0 }}>
        <Paper component="section" elevation={1} sx={{ p: 2.5 }}>
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 2 }}
          >
            <Typography variant="h6">Alerts ({linkedAlerts.length})</Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              {availableAlerts.length > 0 && (
                <>
                  <TextField
                    select
                    size="small"
                    label="Add existing alert"
                    value={selectedAlertId}
                    onChange={(e) => setSelectedAlertId(e.target.value)}
                    sx={{ minWidth: 200 }}
                  >
                    {alertMenuItems(availableAlerts)}
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
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
              {linkedAlerts.map((alert) => (
                <Chip
                  key={alert.id}
                  label={formatAlertLabel(alert)}
                  color={alert.isActive ? "primary" : "default"}
                  variant="outlined"
                  onClick={() => router.push(`/alerts/${alert.id}`)}
                  onDelete={unlinking.pendingId === alert.id ? undefined : () => handleRemoveAlert(alert.id)}
                />
              ))}
            </Stack>
          )}
        </Paper>

        <Paper component="section" elevation={1} sx={{ p: 2.5 }}>
          <Typography variant="h6">Transitions</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
            When the &quot;From&quot; alert fires, the &quot;To&quot; alert is activated. Double-click a cell to edit.
          </Typography>

          {linkedAlerts.length < 2 ? (
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Add at least two alerts to create a transition.
            </Typography>
          ) : (
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", rowGap: 1.5 }}>
                <TextField
                  select
                  size="small"
                  label="From alert"
                  value={sourceAlertId}
                  onChange={(e) => setSourceAlertId(e.target.value)}
                  sx={{ flex: 1, minWidth: 160 }}
                >
                  {alertMenuItems(linkedAlerts)}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="To alert"
                  value={targetAlertId}
                  onChange={(e) => setTargetAlertId(e.target.value)}
                  sx={{ flex: 1, minWidth: 160 }}
                >
                  {alertMenuItems(linkedAlerts.filter((alert) => String(alert.id) !== sourceAlertId))}
                </TextField>
              </Stack>
              <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", rowGap: 1.5 }}>
                <TextField
                  size="small"
                  label="Condition"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  sx={{ flex: 1, minWidth: 160 }}
                />
                <TextField
                  size="small"
                  label="Explanation"
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  sx={{ flex: 2, minWidth: 200 }}
                />
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleAddTransition}
                  disabled={!sourceAlertId || !targetAlertId || addTransition.pending}
                >
                  {addTransition.pending ? "Adding..." : "Add transition"}
                </Button>
              </Stack>
            </Stack>
          )}

          {addTransition.error && (
            <Typography color="error" sx={{ mb: 2 }}>
              {addTransition.error}
            </Typography>
          )}

          {transitions.length === 0 ? (
            <Typography color="text.secondary">No transitions yet.</Typography>
          ) : (
            <DataGrid
              autoHeight
              rows={transitions}
              columns={transitionColumns}
              density="compact"
              disableRowSelectionOnClick
              processRowUpdate={handleTransitionRowUpdate}
              onProcessRowUpdateError={(err) => addTransition.setError(getErrorMessage(err))}
            />
          )}
        </Paper>
      </Stack>

      <AlertRelationshipGraph alerts={linkedAlerts} transitions={transitions} />

      <FormDialog
        open={editOpen}
        title="Edit Playbook"
        onClose={() => setEditOpen(false)}
        onSave={handleSaveDescription}
        saving={savePlaybook.pending}
        error={savePlaybook.error}
        maxWidth="sm"
      >
        <TextField label="Name" size="small" fullWidth value={name} onChange={(e) => setName(e.target.value)} />
        <TextField
          label="Description"
          size="small"
          fullWidth
          multiline
          minRows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </FormDialog>
    </Box>
  );
}
