"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, IconButton, Paper, Stack, TextField, Tooltip, Typography } from "@mui/material";
import {
  removeAlert,
  removePlaybook,
  updatePlaybook,
  type Alert,
  type AlertTransition,
  type Playbook,
} from "@/lib/actions";
import { useAsyncAction, usePendingId } from "@/lib/hooks";
import { orderStepsByFlow } from "@/lib/playbookFlow";
import { formatAlertLabel, formatTimeAgo } from "@/lib/stockUtils";
import StepFlowGraph from "./StepFlowGraph";
import ButtonLink from "./ButtonLink";
import FormDialog from "./FormDialog";
import PlaybookProgress, { StepStatusChip } from "./PlaybookProgress";
import StepDialog, { type StepDialogTarget } from "./StepDialog";

function StepRow({
  step,
  index,
  selected,
  removing,
  onSelect,
  onEdit,
  onRemove,
}: {
  step: Alert;
  index: number;
  selected: boolean;
  removing: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const label = formatAlertLabel(step);

  return (
    <Box
      role="button"
      aria-pressed={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      sx={{
        p: 1,
        borderRadius: 1,
        border: 1,
        borderColor: selected ? "primary.main" : "divider",
        bgcolor: selected ? "action.selected" : "background.paper",
        cursor: "pointer",
        "&:hover": { bgcolor: selected ? "action.selected" : "action.hover" },
      }}
    >
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, minWidth: 14 }}>
          {index}
        </Typography>
        <Typography variant="body2" noWrap title={label} sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>
          {label}
        </Typography>
        <Stack direction="row" sx={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Edit step">
            <IconButton size="small" aria-label={`Edit ${label}`} onClick={onEdit} sx={{ fontSize: 14 }}>
              ✎
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete step">
            <span>
              <IconButton
                size="small"
                color="error"
                aria-label={`Delete ${label}`}
                onClick={onRemove}
                disabled={removing}
                sx={{ fontSize: 13 }}
              >
                ✕
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", mt: 0.25, pl: "18px" }}>
        <StepStatusChip step={step} />
        {step.triggered_at && (
          <Typography variant="caption" color="text.secondary">
            fired {formatTimeAgo(step.triggered_at)}
          </Typography>
        )}
      </Stack>
      {step.description && (
        <Typography
          variant="caption"
          color="text.secondary"
          title={step.description}
          sx={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            mt: 0.5,
            pl: "18px",
          }}
        >
          {step.description}
        </Typography>
      )}
    </Box>
  );
}

export default function PlaybookDetailView({
  playbook,
  linkedAlerts,
  transitions,
  initialEditStepId,
}: {
  playbook: Playbook;
  linkedAlerts: Alert[];
  transitions: AlertTransition[];
  initialEditStepId?: number;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(playbook.name ?? "");
  const [description, setDescription] = useState(playbook.description ?? "");
  // The step clicked in the Steps list; the next added step follows it.
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  const initialEditStep = linkedAlerts.find((step) => step.id === initialEditStepId);
  const [dialog, setDialog] = useState<StepDialogTarget | null>(
    initialEditStep ? { mode: "edit", step: initialEditStep } : null,
  );
  const savePlaybook = useAsyncAction();
  const deletePlaybook = useAsyncAction();
  const removingStep = usePendingId();

  const steps = orderStepsByFlow(linkedAlerts, transitions);
  const stepById = new Map(steps.map((step) => [step.id, step]));
  // Ignores a selection whose step has since been deleted.
  const selectedStep = selectedStepId != null ? stepById.get(selectedStepId) ?? null : null;
  // With nothing selected, a new step follows the last one in the flow.
  const defaultSource = selectedStep ?? steps[steps.length - 1] ?? null;

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
    if (!window.confirm(`Delete "${playbook.name}" and all its steps?`)) return;
    if (await deletePlaybook.run(() => removePlaybook(playbook.id))) {
      router.push("/playbooks");
    }
  }

  function handleRemoveStep(step: Alert) {
    return removingStep.run(step.id, async () => {
      await removeAlert(step.id);
      router.refresh();
    });
  }

  function handleStepSaved(step: Alert) {
    // A new step becomes the selection, so adding another one continues the chain from it.
    if (dialog?.mode === "add") setSelectedStepId(step.id);
    setDialog(null);
    router.refresh();
  }

  return (
    <Box
      sx={{
        display: "grid",
        // A slim steps list (about 15% of the width) next to a large step flow graph.
        gridTemplateColumns: { xs: "1fr", md: "minmax(210px, 15%) minmax(0, 1fr)" },
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
            {playbook.description && (
              <Typography variant="body1" sx={{ mt: 1.5, whiteSpace: "pre-wrap" }}>
                {playbook.description}
              </Typography>
            )}
            <Box sx={{ mt: 2, maxWidth: 360 }}>
              <PlaybookProgress steps={linkedAlerts} />
            </Box>
            {deletePlaybook.error && (
              <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                Couldn&apos;t delete the playbook: {deletePlaybook.error}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Button size="small" variant="outlined" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button size="small" color="error" onClick={handleDeletePlaybook} disabled={deletePlaybook.pending}>
              {deletePlaybook.pending ? "Deleting..." : "Delete"}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper component="section" elevation={1} sx={{ p: 1.5, minWidth: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Steps ({steps.length})
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          In run order. Select one to add the next step after it.
        </Typography>
        <Button
          variant="contained"
          size="small"
          fullWidth
          onClick={() => setDialog({ mode: "add", sourceStepId: defaultSource?.id ?? null })}
          sx={{ mb: 1.5 }}
        >
          {selectedStep ? `Add after ${formatAlertLabel(selectedStep)}` : "Add step"}
        </Button>

        {steps.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No steps yet.
          </Typography>
        ) : (
          <Stack spacing={0.75}>
            {steps.map((step, index) => (
              <StepRow
                key={step.id}
                step={step}
                index={index + 1}
                selected={selectedStep?.id === step.id}
                removing={removingStep.pendingId === step.id}
                onSelect={() => setSelectedStepId(selectedStep?.id === step.id ? null : step.id)}
                onEdit={() => setDialog({ mode: "edit", step })}
                onRemove={() => handleRemoveStep(step)}
              />
            ))}
          </Stack>
        )}

        {removingStep.error && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            Couldn&apos;t delete the step: {removingStep.error}
          </Typography>
        )}
        {selectedStep && (
          <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", mt: 1 }}>
            <ButtonLink href={`/playbooks/${playbook.id}/steps/${selectedStep.id}`} size="small">
              View chart
            </ButtonLink>
            <Button size="small" onClick={() => setSelectedStepId(null)}>
              Clear selection
            </Button>
          </Stack>
        )}
      </Paper>

      <StepFlowGraph playbookId={playbook.id} alerts={linkedAlerts} transitions={transitions} />

      {dialog && (
        <StepDialog
          key={dialog.mode === "edit" ? `edit-${dialog.step.id}` : `add-${dialog.sourceStepId}`}
          target={dialog}
          playbookId={playbook.id}
          email={playbook.email}
          steps={steps}
          transitions={transitions}
          onClose={() => setDialog(null)}
          onSaved={handleStepSaved}
        />
      )}

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
