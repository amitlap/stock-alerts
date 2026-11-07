"use client";

import { useState } from "react";
import { Box, Button, Chip, Stack, SvgIcon, TextField, Tooltip, Typography } from "@mui/material";
import FormDialog from "./FormDialog";
import { ConditionFields } from "./StepFields";
import {
  isPlanTemplate,
  levelKind,
  MAX_LADDER_STEPS,
  PLAYBOOK_TEMPLATES,
  type PlanDraft,
  type PlanTemplate,
  type PlaybookTemplate,
  useNewPlaybook,
} from "./useNewPlaybook";

type Draft = ReturnType<typeof useNewPlaybook>;

// The playbook types as chips on the Playbooks page, the one place playbooks are created: a click opens
// the dialog for that type, and the new playbook opens once it's saved. Each chip's "i" explains the type.
export default function NewPlaybookChips({ userEmail }: { userEmail: string }) {
  const [open, setOpen] = useState<PlaybookTemplate | null>(null);

  return (
    <>
      <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", alignItems: "center", gap: 1 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mr: 0.5 }}>
          New playbook:
        </Typography>
        {PLAYBOOK_TEMPLATES.map((t) => (
          <Chip
            key={t.value}
            size="small"
            clickable
            variant="outlined"
            color="primary"
            onClick={() => setOpen(t.value)}
            sx={{ fontSize: "0.75rem", height: 24, fontWeight: 600, color: "grey.800" }}
            label={
              <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                {t.label}
                <InfoTip label={t.label} about={t.about} size={14} />
              </Box>
            }
          />
        ))}
      </Stack>
      {/* Mounted only while open, so each time it opens with an empty form. */}
      {open && <NewPlaybookDialog userEmail={userEmail} templateValue={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function NewPlaybookDialog({
  userEmail,
  templateValue,
  onClose,
}: {
  userEmail: string;
  templateValue: PlaybookTemplate;
  onClose: () => void;
}) {
  const draft = useNewPlaybook(userEmail, templateValue);
  const template = PLAYBOOK_TEMPLATES.find((t) => t.value === templateValue)!;

  return (
    <FormDialog
      open
      title={`New playbook: ${template.label}`}
      onClose={onClose}
      onSave={draft.create}
      saving={draft.save.pending}
      canSave={draft.canSave}
      error={draft.save.error}
      maxWidth="sm"
    >
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "flex-start" }}>
        <Typography variant="body2" color="text.secondary">
          {template.hint}
        </Typography>
        <InfoTip label={template.label} about={template.about} />
      </Stack>

      {isPlanTemplate(templateValue) ? (
        <PlanFields draft={draft} template={templateValue} />
      ) : (
        <Stack spacing={1}>
          {templateValue === "custom" && <Typography variant="subtitle2">First step — start watching when</Typography>}
          <ConditionFields value={draft.condition} onChange={draft.setCondition} />
        </Stack>
      )}

      <TextField
        label={templateValue === "custom" ? "Playbook name" : "Playbook name (optional)"}
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

// An "i" icon that explains a playbook type on hover (or a long press on touch screens).
function InfoTip({ label, about, size = 20 }: { label: string; about: string; size?: number }) {
  return (
    <Tooltip
      title={
        <>
          <Typography variant="subtitle2" component="span" sx={{ display: "block", mb: 0.5, fontSize: "0.95rem", fontWeight: 700 }}>
            {label}
          </Typography>
          {about}
        </>
      }
      placement="right"
      arrow
      enterTouchDelay={0}
      slotProps={{ tooltip: { sx: { fontSize: "0.875rem", lineHeight: 1.5, maxWidth: 360, p: 1.5 } } }}
    >
      <SvgIcon aria-label={`About ${label}`} color="action" sx={{ flexShrink: 0, fontSize: size }}>
        {/* Material "info outlined" */}
        <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8" />
      </SvgIcon>
    </Tooltip>
  );
}

// A number field bound to one field of the plan draft.
function PlanNumberField({
  draft,
  field,
  label,
  min,
  step,
  max,
}: {
  draft: Draft;
  field: keyof PlanDraft;
  label: string;
  min: number;
  step: number;
  max?: number;
}) {
  return (
    <TextField
      label={label}
      size="small"
      type="number"
      fullWidth
      value={draft.plan[field]}
      onChange={(e) => draft.setPlan({ ...draft.plan, [field]: e.target.value })}
      slotProps={{ htmlInput: { min, max, step } }}
    />
  );
}

// Stock and start price (or the live one), the template's own numbers, and the steps they make.
function PlanFields({ draft, template }: { draft: Draft; template: PlanTemplate }) {
  const { plan, setPlan, steps } = draft;
  const ladder = template === "stepUp" || template === "dip";
  // Breakout and support start from a resistance or support level found from 3 months of prices.
  const level = levelKind(template);
  const parallel = steps?.every((step) => step.after === null);

  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField
          label={template === "crash" ? "Index or stock" : "Stock"}
          size="small"
          fullWidth
          value={plan.stock}
          onChange={(e) => setPlan({ ...plan, stock: e.target.value })}
        />
        <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
          <TextField
            label={level ? `${level === "resistance" ? "Resistance" : "Support"} level` : template === "bracket" ? "Entry price" : "Start price"}
            size="small"
            type="number"
            fullWidth
            value={plan.startPrice}
            onChange={(e) => setPlan({ ...plan, startPrice: e.target.value })}
          />
          <Button
            size="small"
            onClick={draft.fillStartPrice}
            disabled={!plan.stock.trim() || draft.lookup.pending}
            sx={{ whiteSpace: "nowrap", flexShrink: 0 }}
          >
            {draft.lookup.pending ? "Loading..." : level ? "Find level" : "Use current"}
          </Button>
        </Stack>
      </Stack>

      {ladder && (
        <Stack direction="row" spacing={1.5}>
          <PlanNumberField draft={draft} field="count" label="Steps" min={1} max={MAX_LADDER_STEPS} step={1} />
          <PlanNumberField
            draft={draft}
            field="percent"
            label={template === "stepUp" ? "Rise between steps (%)" : "Drop between steps (%)"}
            min={0.1}
            step={0.5}
          />
        </Stack>
      )}
      {template === "bracket" && (
        <Stack direction="row" spacing={1.5}>
          <PlanNumberField draft={draft} field="stopPercent" label="Stop loss below (%)" min={0.1} max={99} step={0.5} />
          <PlanNumberField draft={draft} field="targetPercent" label="Take profit above (%)" min={0.1} step={0.5} />
        </Stack>
      )}

      {draft.lookup.error && (
        <Typography variant="caption" color="error">
          {draft.lookup.error}
        </Typography>
      )}

      {steps ? (
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            {steps.length} {steps.length === 1 ? "alert" : "alerts"},{" "}
            {parallel ? "all watching from the start" : "each starting when the one before fires"}
          </Typography>
          <Box component="ol" sx={{ m: 0, mt: 0.5, pl: 3, columns: steps.length > 6 ? 2 : 1 }}>
            {steps.map((step, i) => (
              <Typography component="li" variant="body2" key={i}>
                {step.stock} {step.operator} ${step.price}
                {!ladder && (
                  <Typography component="span" variant="body2" color="text.secondary">
                    {" "}
                    — {step.description}
                  </Typography>
                )}
              </Typography>
            ))}
          </Box>
        </Box>
      ) : (
        <Typography variant="caption" color="text.secondary">
          {ladder
            ? `Fill in the stock, a start price, 1–${MAX_LADDER_STEPS} steps and a % to see the prices.`
            : level
              ? `Fill in the stock, then Find level for its 3-month ${level} (or type your own).`
              : "Fill in the stock and a price to see the alerts."}
        </Typography>
      )}
    </Stack>
  );
}
