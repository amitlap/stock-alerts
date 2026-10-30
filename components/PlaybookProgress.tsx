"use client";

import { Chip, LinearProgress, Stack, Typography, type ChipProps } from "@mui/material";
import {
  getPlaybookProgress,
  getStepStatus,
  STEP_STATUS_LABELS,
  type Alert,
  type StepStatus,
} from "@/lib/stockUtils";

const STEP_STATUS_COLORS: Record<StepStatus, ChipProps["color"]> = {
  waiting: "default",
  watching: "primary",
  done: "success",
};

type Step = Pick<Alert, "isActive" | "triggered_at">;

// "2 of 4 steps done · 1 watching" with a bar.
export default function PlaybookProgress({ steps, compact = false }: { steps: Step[]; compact?: boolean }) {
  const { done, watching, total } = getPlaybookProgress(steps);
  const summary = `${done} of ${total} done${watching > 0 ? ` · ${watching} watching` : ""}`;

  return (
    <Stack spacing={0.5} sx={{ minWidth: compact ? 120 : 200, width: "100%" }}>
      <LinearProgress
        variant="determinate"
        color={total > 0 && done === total ? "success" : "primary"}
        value={total === 0 ? 0 : (done / total) * 100}
        sx={{ height: compact ? 4 : 6, borderRadius: 3 }}
      />
      <Typography variant={compact ? "caption" : "body2"} color="text.secondary">
        {summary}
      </Typography>
    </Stack>
  );
}

export function StepStatusChip({ step, ...props }: { step: Step } & Omit<ChipProps, "label" | "color">) {
  const status = getStepStatus(step);
  return <Chip size="small" label={STEP_STATUS_LABELS[status]} color={STEP_STATUS_COLORS[status]} {...props} />;
}
