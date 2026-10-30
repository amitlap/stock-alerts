"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import {
  removeAlert,
  removePlaybook,
  updateAlert,
  updatePlaybook,
  type Alert,
  type AlertTransition,
  type Playbook,
} from "@/lib/actions";
import { useAsyncAction, usePendingId } from "@/lib/hooks";
import { getStepWithDescendants, orderStepsByFlow } from "@/lib/playbookFlow";
import { formatAlertLabel, formatTimeAgo } from "@/lib/stockUtils";
import { stepMenuItems } from "./AlertFields";
import AlertRelationshipGraph from "./AlertRelationshipGraph";
import ButtonLink from "./ButtonLink";
import FormDialog from "./FormDialog";
import PlaybookProgress, { StepStatusChip } from "./PlaybookProgress";
import StepDialog, { type StepDialogTarget } from "./StepDialog";

const STARTS_FIRST = "none";

function StepRow({
  step,
  index,
  sourceId,
  sourceOptions,
  targets,
  why,
  selected,
  removing,
  relinking,
  onSelect,
  onEdit,
  onRemove,
  onRelink,
}: {
  step: Alert;
  index: number;
  sourceId: number | null;
  sourceOptions: Alert[];
  targets: Alert[];
  why: string | null;
  selected: boolean;
  removing: boolean;
  relinking: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onRelink: (sourceId: number | null) => void;
}) {
  const facts = [
    targets.length > 0 && `Then starts ${targets.map(formatAlertLabel).join(", ")}`,
    step.triggered_at && `Fired ${formatTimeAgo(step.triggered_at)}`,
  ].filter(Boolean);

  return (
    <Stack
      direction="row"
      spacing={1.5}
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
        p: 1.25,
        borderRadius: 1,
        border: 1,
        borderColor: selected ? "primary.main" : "divider",
        bgcolor: selected ? "action.selected" : "background.paper",
        cursor: "pointer",
        alignItems: "flex-start",
        "&:hover": { bgcolor: selected ? "action.selected" : "action.hover" },
      }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ width: 20, flexShrink: 0, textAlign: "right", fontWeight: 600, pt: 0.25 }}
      >
        {index}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Typography sx={{ fontWeight: 600 }}>{formatAlertLabel(step)}</Typography>
          <StepStatusChip step={step} />
        </Stack>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ alignItems: "center", flexWrap: "wrap", color: "text.secondary" }}
          // The picker is its own control; don't let it toggle the row's selection.
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Typography variant="caption">Starts after</Typography>
          <TextField
            select
            variant="standard"
            size="small"
            value={sourceId != null ? String(sourceId) : STARTS_FIRST}
            onChange={(e) => onRelink(e.target.value === STARTS_FIRST ? null : Number(e.target.value))}
            disabled={relinking}
            slotProps={{ htmlInput: { "aria-label": `Step ${formatAlertLabel(step)} starts after` } }}
            sx={{ minWidth: 130, "& .MuiInputBase-input": { fontSize: 12, py: 0.25 } }}
          >
            <MenuItem value={STARTS_FIRST}>nothing (starts first)</MenuItem>
            {stepMenuItems(sourceOptions)}
          </TextField>
          {relinking && <Typography variant="caption">Saving...</Typography>}
          {facts.length > 0 && <Typography variant="caption">· {facts.join(" · ")}</Typography>}
        </Stack>
        {(step.description || why) && (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {step.description}
            {step.description && why && " — "}
            {why && (
              <Box component="span" sx={{ color: "text.secondary", fontStyle: "italic" }}>
                {why}
              </Box>
            )}
          </Typography>
        )}
      </Box>
      <Stack direction="row" sx={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        <Button size="small" onClick={onEdit}>
          Edit
        </Button>
        <Button size="small" color="error" onClick={onRemove} disabled={removing}>
          {removing ? "Deleting..." : "Delete"}
        </Button>
      </Stack>
    </Stack>
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
  const relinking = usePendingId();

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

  // Re-links a step from the list: it now starts after `sourceId` (or first, for null).
  function handleRelink(step: Alert, sourceId: number | null) {
    const existing = transitions.find(
      (t) => t.target_alert_id === step.id && t.source_alert_id === sourceId,
    );
    return relinking.run(step.id, async () => {
      await updateAlert(
        step.id,
        step,
        sourceId == null ? null : { sourceAlertId: sourceId, explanation: existing?.explanation ?? null },
      );
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
        gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(0, 1fr)" },
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

      <Paper component="section" elevation={1} sx={{ p: 2.5, minWidth: 0 }}>
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 0.5 }}
        >
          <Typography variant="h6">Steps ({steps.length})</Typography>
          <Button
            variant="contained"
            size="small"
            onClick={() => setDialog({ mode: "add", sourceStepId: defaultSource?.id ?? null })}
          >
            {selectedStep ? `Add step after ${formatAlertLabel(selectedStep)}` : "Add step"}
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
          Steps run top to bottom: each one starts watching when the step it follows fires. Change a step&apos;s
          &quot;Starts after&quot; to re-link it, or click a step to add the next one after it.
        </Typography>

        {steps.length === 0 ? (
          <Typography color="text.secondary">No steps yet.</Typography>
        ) : (
          <Stack spacing={1}>
            {steps.map((step, index) => {
              const incoming = transitions.filter((t) => t.target_alert_id === step.id);
              // A step can't start after itself or anything that comes after it.
              const excluded = getStepWithDescendants(step.id, transitions);
              return (
                <StepRow
                  key={step.id}
                  step={step}
                  index={index + 1}
                  sourceId={incoming[0]?.source_alert_id ?? null}
                  sourceOptions={steps.filter((option) => !excluded.has(option.id))}
                  targets={transitions
                    .filter((t) => t.source_alert_id === step.id)
                    .flatMap((t) => stepById.get(t.target_alert_id) ?? [])}
                  why={incoming.find((t) => t.explanation)?.explanation ?? null}
                  selected={selectedStep?.id === step.id}
                  removing={removingStep.pendingId === step.id}
                  relinking={relinking.pendingId === step.id}
                  onSelect={() => setSelectedStepId(selectedStep?.id === step.id ? null : step.id)}
                  onEdit={() => setDialog({ mode: "edit", step })}
                  onRemove={() => handleRemoveStep(step)}
                  onRelink={(sourceId) => handleRelink(step, sourceId)}
                />
              );
            })}
          </Stack>
        )}

        {removingStep.error && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            Couldn&apos;t delete the step: {removingStep.error}
          </Typography>
        )}
        {relinking.error && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            Couldn&apos;t change what the step starts after: {relinking.error}
          </Typography>
        )}
        {selectedStep && (
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap", mt: 1.5, p: 1, borderRadius: 1, bgcolor: "action.hover" }}
          >
            <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
              Selected <strong>{formatAlertLabel(selectedStep)}</strong> — new steps will start after it.
            </Typography>
            <ButtonLink href={`/playbooks/${playbook.id}/steps/${selectedStep.id}`} size="small">
              View chart
            </ButtonLink>
            <Button size="small" onClick={() => setSelectedStepId(null)}>
              Clear
            </Button>
          </Stack>
        )}
      </Paper>

      <AlertRelationshipGraph playbookId={playbook.id} alerts={linkedAlerts} transitions={transitions} />

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
