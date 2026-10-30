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
import { formatAlertLabel, formatTimeAgo, getStepStatus, type StockPrice } from "@/lib/stockUtils";
import StepFlowGraph from "./StepFlowGraph";
import { SELECTED_STEP_STYLE } from "./stepSelection";
import TickerChart from "./TickerChart";
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
  stocks,
  initialEditStepId,
}: {
  playbook: Playbook;
  linkedAlerts: Alert[];
  transitions: AlertTransition[];
  stocks: StockPrice[];
  initialEditStepId?: number;
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
  const removingStep = usePendingId();

  const steps = orderStepsByFlow(linkedAlerts, transitions);
  const stepById = new Map(steps.map((step) => [step.id, step]));
  // Ignores a selection whose step has since been deleted.
  const selectedStep = selectedStepId != null ? stepById.get(selectedStepId) ?? null : null;
  // With nothing selected, a new step follows the last one in the flow.
  const defaultSource = selectedStep ?? steps[steps.length - 1] ?? null;
  // The chart follows the selected step's stock (or a chip the user picked), starting on the
  // stock of the first watching step.
  const chartSymbol =
    chosenSymbol ?? steps.find((step) => getStepStatus(step) === "watching")?.stock ?? steps[0]?.stock;

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
    if (dialog?.mode === "add") {
      setSelectedStepId(step.id);
      setChosenSymbol(step.stock);
    }
    setDialog(null);
    router.refresh();
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
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Button size="small" variant="outlined" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button size="small" color="error" onClick={handleDeletePlaybook} disabled={deletePlaybook.pending}>
              {deletePlaybook.pending ? "Deleting..." : "Delete"}
            </Button>
          </Stack>
        </Stack>
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
                onSelect={() => toggleStep(step)}
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
          <Paper component="section" elevation={1} sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Price chart
            </Typography>
            <TickerChart stocks={stocks} symbol={chartSymbol} onSymbolChange={setChosenSymbol} height={420} />
          </Paper>
        )}
      </Stack>

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
