"use client";

import { useState } from "react";
import { Box, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import FormDialog from "./FormDialog";
import { ConditionFields } from "./StepFields";
import { MAX_STEP_UP_STEPS, PLAYBOOK_TEMPLATES, type PlaybookTemplate, useNewPlaybook } from "./useNewPlaybook";

type Draft = ReturnType<typeof useNewPlaybook>;

// "New playbook" on the Playbooks page, the one place playbooks are created: opens a dialog to pick a
// template and fill in its fields, and the new playbook opens once it's saved.
export default function NewPlaybookButton({ userEmail }: { userEmail: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="contained" onClick={() => setOpen(true)}>
        New playbook
      </Button>
      {/* Mounted only while open, so each time it opens with an empty form. */}
      {open && <NewPlaybookDialog userEmail={userEmail} onClose={() => setOpen(false)} />}
    </>
  );
}

function NewPlaybookDialog({ userEmail, onClose }: { userEmail: string; onClose: () => void }) {
  const draft = useNewPlaybook(userEmail);
  const template = PLAYBOOK_TEMPLATES.find((t) => t.value === draft.template)!;

  return (
    <FormDialog
      open
      title="New playbook"
      onClose={onClose}
      onSave={draft.create}
      saving={draft.save.pending}
      canSave={draft.canSave}
      error={draft.save.error}
      maxWidth="sm"
    >
      <TextField
        label="Playbook type"
        size="small"
        select
        fullWidth
        value={draft.template}
        onChange={(e) => draft.setTemplate(e.target.value as PlaybookTemplate)}
        helperText={template.hint}
      >
        {PLAYBOOK_TEMPLATES.map((t) => (
          <MenuItem key={t.value} value={t.value}>
            {t.label}
          </MenuItem>
        ))}
      </TextField>

      {draft.template === "stepUp" ? (
        <StepUpFields draft={draft} />
      ) : (
        <Stack spacing={1}>
          {draft.template === "custom" && <Typography variant="subtitle2">First step — start watching when</Typography>}
          <ConditionFields value={draft.condition} onChange={draft.setCondition} />
        </Stack>
      )}

      <TextField
        label={draft.template === "custom" ? "Playbook name" : "Playbook name (optional)"}
        placeholder={draft.defaultName || "e.g. QQQ step-up buying"}
        slotProps={{ inputLabel: { shrink: true } }}
        size="small"
        fullWidth
        value={draft.name}
        onChange={(e) => draft.setName(e.target.value)}
      />
      <TextField
        label="Description (optional)"
        size="small"
        fullWidth
        multiline
        minRows={2}
        value={draft.description}
        onChange={(e) => draft.setDescription(e.target.value)}
      />
    </FormDialog>
  );
}

// Stock, start price (or the live one), number of steps and the % between them, with the resulting prices.
function StepUpFields({ draft }: { draft: Draft }) {
  const { stepUp, setStepUp, steps } = draft;

  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField
          label="Stock"
          size="small"
          fullWidth
          value={stepUp.stock}
          onChange={(e) => setStepUp({ ...stepUp, stock: e.target.value })}
        />
        <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
          <TextField
            label="Start price"
            size="small"
            type="number"
            fullWidth
            value={stepUp.startPrice}
            onChange={(e) => setStepUp({ ...stepUp, startPrice: e.target.value })}
          />
          <Button
            size="small"
            onClick={draft.fillCurrentPrice}
            disabled={!stepUp.stock.trim() || draft.lookup.pending}
            sx={{ whiteSpace: "nowrap", flexShrink: 0 }}
          >
            {draft.lookup.pending ? "Loading..." : "Use current"}
          </Button>
        </Stack>
      </Stack>
      <Stack direction="row" spacing={1.5}>
        <TextField
          label="Steps"
          size="small"
          type="number"
          fullWidth
          value={stepUp.count}
          onChange={(e) => setStepUp({ ...stepUp, count: e.target.value })}
          slotProps={{ htmlInput: { min: 1, max: MAX_STEP_UP_STEPS, step: 1 } }}
        />
        <TextField
          label="Rise between steps (%)"
          size="small"
          type="number"
          fullWidth
          value={stepUp.percent}
          onChange={(e) => setStepUp({ ...stepUp, percent: e.target.value })}
          slotProps={{ htmlInput: { min: 0.1, step: 0.5 } }}
        />
      </Stack>
      {draft.lookup.error && (
        <Typography variant="caption" color="error">
          {draft.lookup.error}
        </Typography>
      )}

      {steps ? (
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            {steps.length} buy {steps.length === 1 ? "alert" : "alerts"}, each starting when the one before fires
          </Typography>
          <Box component="ol" sx={{ m: 0, mt: 0.5, pl: 3, columns: steps.length > 6 ? 2 : 1 }}>
            {steps.map((step, i) => (
              <Typography component="li" variant="body2" key={i}>
                {step.stock} &gt; ${step.price}
              </Typography>
            ))}
          </Box>
        </Box>
      ) : (
        <Typography variant="caption" color="text.secondary">
          Fill in the stock, a start price, 1–{MAX_STEP_UP_STEPS} steps and a % to see the prices.
        </Typography>
      )}
    </Stack>
  );
}
