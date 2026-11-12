"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import type { Alert, AlertTransition, Playbook } from "@/shared/types";
import { removeAlert, removePlaybook, setPlaybookPublic, updatePlaybook } from "@/backend/actions";
import { useAsyncAction, usePendingId } from "@/frontend/hooks";
import { orderStepsByFlow } from "@/frontend/playbookFlow";
import { formatTimeAgo } from "@/shared/format";
import { formatAlertLabel, getStepStatus } from "@/shared/steps";
import StepFlowGraph from "./StepFlowGraph";
import { SELECTED_STEP_STYLE } from "./stepSelection";
import TradingViewWidget from "./TradingViewWidget";
import ButtonLink from "./ButtonLink";
import FormDialog from "./FormDialog";
import PlaybookProgress, { StepStatusChip } from "./PlaybookProgress";
import StepDialog, { type StepDialogTarget } from "./StepDialog";
import { PLAYBOOK_TEMPLATES } from "./useNewPlaybook";

function StepRow({
  step,
  index,
  selected,
  removing,
  readOnly,
  onSelect,
  onEdit,
  onRemove,
}: {
  step: Alert;
  index: number;
  selected: boolean;
  removing: boolean;
  readOnly: boolean;
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
        borderColor: "divider",
        bgcolor: "background.paper",
        cursor: "pointer",
        transition: "background-color 120ms, box-shadow 120ms",
        "&:hover": { bgcolor: "action.hover" },
        ...(selected && { ...SELECTED_STEP_STYLE, "&:hover": { bgcolor: SELECTED_STEP_STYLE.backgroundColor } }),
      }}
    >
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, minWidth: 14 }}>
          {index}
        </Typography>
        <Typography variant="body2" noWrap title={label} sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>
          {label}
        </Typography>
        {!readOnly && (
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
        )}
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
  isOwner,
  initialEditStepId,
  comments,
}: {
  playbook: Playbook;
  linkedAlerts: Alert[];
  transitions: AlertTransition[];
  isOwner: boolean;
  initialEditStepId?: number;
  comments: ReactNode;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(playbook.name ?? "");
  const [description, setDescription] = useState(playbook.description ?? "");
  // The step clicked in the Steps list; the next added step follows it.
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  const [chosenSymbol, setChosenSymbol] = useState<string | null>(null);
  const initialEditStep = linkedAlerts.find((step) => step.id === initialEditStepId);
  const [dialog, setDialog] = useState<StepDialogTarget | null>(
    initialEditStep ? { mode: "edit", step: initialEditStep } : null,
  );
  const savePlaybook = useAsyncAction();
  const deletePlaybook = useAsyncAction();
  const changeVisibility = useAsyncAction();
  const removingStep = usePendingId();

  const steps = orderStepsByFlow(linkedAlerts, transitions);
  const stepById = new Map(steps.map((step) => [step.id, step]));
  // Ignores a selection whose step has since been deleted.
  const selectedStep = selectedStepId != null ? stepById.get(selectedStepId) ?? null : null;
  // With nothing selected, a new step follows the last one in the flow.
  const defaultSource = selectedStep ?? steps[steps.length - 1] ?? null;
  // The chart follows the selected step's stock, starting on the stock of the first watching step.
  const chartSymbol =
    chosenSymbol ?? steps.find((step) => getStepStatus(step) === "watching")?.stock ?? steps[0]?.stock;
  // The same indicators as this playbook's type has in the new-playbook dialog.
  const chart = PLAYBOOK_TEMPLATES.find((t) => t.value === playbook.type) ?? PLAYBOOK_TEMPLATES[0];

  // Selecting a step (in the list or the graph) also shows its stock in the price chart;
  // selecting the selected step again clears the selection.
  function toggleStep(step: Alert) {
    if (selectedStep?.id === step.id) {
      setSelectedStepId(null);
    } else {
      setSelectedStepId(step.id);
      setChosenSymbol(step.stock);
    }
  }

  async function handleSaveDescription() {
    if (await savePlaybook.run(() => updatePlaybook(playbook.id, { name, description, email: playbook.email }))) {
      setEditOpen(false);
    }
  }

  async function handleDeletePlaybook() {
    if (!window.confirm(`Delete "${playbook.name}" and all its steps?`)) return;
    if (await deletePlaybook.run(() => removePlaybook(playbook.id))) {
      router.push("/playbooks");
    }
  }

  // Opened via ?edit=<stepId> (e.g. "Edit in playbook"): drop the parameter on close, so a reload
  // doesn't open the editor again.
  function closeDialog() {
    setDialog(null);
    if (initialEditStepId != null) router.replace(`/playbooks/${playbook.id}`, { scroll: false });
  }

  function handleStepSaved(step: Alert) {
    // A new step becomes the selection, so adding another one continues the chain from it.
    if (dialog?.mode === "add") {
      setSelectedStepId(step.id);
      setChosenSymbol(step.stock);
    }
    closeDialog();
  }

  return (
    <Box
      sx={{
        display: "grid",
        // A slim steps list (about 15% of the width) next to the step flow and the price chart.
        gridTemplateColumns: { xs: "1fr", md: "minmax(210px, 15%) minmax(0, 1fr)" },
        gap: 2,
        alignItems: "start",
        mt: 1.5,
      }}
    >
      <Paper component="section" elevation={1} sx={{ px: 2, py: 1.25, gridColumn: "1 / -1" }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: { xs: "wrap", md: "nowrap" } }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="h6"
              component="h1"
              noWrap
              title={`Created ${new Date(playbook.created_at).toLocaleString()}`}
              sx={{ fontWeight: 600, lineHeight: 1.3 }}
            >
              {playbook.name || `Playbook #${playbook.id}`}
            </Typography>
            {playbook.description && (
              <Typography variant="body2" color="text.secondary" noWrap title={playbook.description}>
                {playbook.description}
              </Typography>
            )}
          </Box>
          <Box sx={{ width: 220, flexShrink: 0 }}>
            <PlaybookProgress steps={linkedAlerts} compact />
          </Box>
          {isOwner ? (
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0, alignItems: "center" }}>
              <Tooltip title="Public playbooks are visible to the viewers you add on the Playbooks page">
                <FormControlLabel
                  label="Public"
                  control={
                    <Switch
                      size="small"
                      checked={playbook.is_public}
                      disabled={changeVisibility.pending}
                      onChange={(e) => changeVisibility.run(() => setPlaybookPublic(playbook.id, e.target.checked))}
                    />
                  }
                />
              </Tooltip>
              <Button size="small" variant="outlined" onClick={() => setEditOpen(true)}>
                Edit
              </Button>
              <Button size="small" color="error" onClick={handleDeletePlaybook} disabled={deletePlaybook.pending}>
                {deletePlaybook.pending ? "Deleting..." : "Delete"}
              </Button>
            </Stack>
          ) : (
            <Chip size="small" variant="outlined" label={`Shared by ${playbook.email} · view only`} />
          )}
        </Stack>
        {changeVisibility.error && (
          <Typography color="error" variant="body2" sx={{ mt: 0.5 }}>
            Couldn&apos;t change the visibility: {changeVisibility.error}
          </Typography>
        )}
        {deletePlaybook.error && (
          <Typography color="error" variant="body2" sx={{ mt: 0.5 }}>
            Couldn&apos;t delete the playbook: {deletePlaybook.error}
          </Typography>
        )}
      </Paper>

      <Paper component="section" elevation={1} sx={{ p: 1.5, minWidth: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Steps ({steps.length})
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          {isOwner ? "In run order. Select one to add the next step after it." : "In run order."}
        </Typography>
        {isOwner && (
          <Button
            variant="contained"
            size="small"
            fullWidth
            onClick={() => setDialog({ mode: "add", sourceStepId: defaultSource?.id ?? null })}
            sx={{ mb: 1.5 }}
          >
            {selectedStep ? `Add after ${formatAlertLabel(selectedStep)}` : "Add step"}
          </Button>
        )}

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
                readOnly={!isOwner}
                onSelect={() => toggleStep(step)}
                onEdit={() => setDialog({ mode: "edit", step })}
                onRemove={() => removingStep.run(step.id, () => removeAlert(step.id))}
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

      <Stack spacing={2} sx={{ minWidth: 0 }}>
        <StepFlowGraph
          alerts={linkedAlerts}
          transitions={transitions}
          selectedStepId={selectedStep?.id ?? null}
          onSelectStep={(stepId) => {
            const step = stepById.get(stepId);
            if (step) toggleStep(step);
          }}
        />
        {chartSymbol && (
          <Paper component="section" elevation={1} sx={{ p: 1, height: 480 }} aria-label={`${chartSymbol} price chart`}>
            <TradingViewWidget ticker={chartSymbol} studies={chart.studies} interval={chart.interval} />
          </Paper>
        )}
      </Stack>

      {comments}

      {dialog && (
        <StepDialog
          key={dialog.mode === "edit" ? `edit-${dialog.step.id}` : `add-${dialog.sourceStepId}`}
          target={dialog}
          playbookId={playbook.id}
          steps={steps}
          transitions={transitions}
          onClose={closeDialog}
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
