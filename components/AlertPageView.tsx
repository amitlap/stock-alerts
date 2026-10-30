"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import ButtonLink from "@/components/ButtonLink";
import StockChart from "@/components/StockChart";
import { StepStatusChip } from "@/components/PlaybookProgress";
import type { Alert, AlertTransition, Playbook } from "@/lib/actions";
import {
  distanceToTrigger,
  formatAlertCondition,
  formatAlertLabel,
  formatTimeAgo,
  priceChangeColor,
  type Candle,
  type StockPrice,
} from "@/lib/stockUtils";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.5 }}>
        {label}
      </Typography>
      <Typography variant="body2">{children}</Typography>
    </Box>
  );
}

function StepLinks({ playbookId, steps }: { playbookId: number; steps: Alert[] }) {
  return (
    <>
      {steps.map((step, index) => (
        <span key={step.id}>
          {index > 0 && ", "}
          <Link href={`/playbooks/${playbookId}/steps/${step.id}`} className="hover:underline">
            {formatAlertLabel(step)}
          </Link>
        </span>
      ))}
    </>
  );
}

// Read-only view of one playbook step: its chart and where it sits in the playbook.
// Steps are edited from the playbook page.
export default function AlertPageView({
  alert,
  stock,
  candles,
  playbook,
  steps,
  transitions,
}: {
  alert: Alert;
  stock?: StockPrice;
  candles: Candle[];
  playbook: Playbook;
  steps: Alert[];
  transitions: AlertTransition[];
}) {
  const isUp = (stock?.change ?? 0) >= 0;
  const changeColor = priceChangeColor(stock?.change);
  const stepById = new Map(steps.map((step) => [step.id, step]));
  const incoming = transitions.filter((t) => t.target_alert_id === alert.id);
  const sources = incoming.flatMap((t) => stepById.get(t.source_alert_id) ?? []);
  const targets = transitions
    .filter((t) => t.source_alert_id === alert.id)
    .flatMap((t) => stepById.get(t.target_alert_id) ?? []);
  const why = incoming.find((t) => t.explanation)?.explanation;
  const distance = stock?.price != null ? distanceToTrigger(alert, stock.price) : null;

  return (
    <>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap", mt: 2, mb: 1.5 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          {alert.stock}
        </Typography>
        {stock?.price != null && (
          <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
            <Typography variant="h5" sx={{ color: changeColor }}>
              ${stock.price.toFixed(2)}
            </Typography>
            {stock.changePercent != null && (
              <Typography variant="body1" sx={{ color: changeColor }}>
                {isUp ? "+" : ""}
                {stock.changePercent.toFixed(2)}%
              </Typography>
            )}
          </Stack>
        )}
        <StepStatusChip step={alert} />
        <Chip
          component={Link}
          href={`/playbooks/${playbook.id}`}
          clickable
          label={`Playbook: ${playbook.name || `#${playbook.id}`}`}
          color="primary"
          variant="outlined"
          size="small"
        />
        <Box sx={{ flex: 1 }} />
        <ButtonLink href={`/playbooks/${playbook.id}?edit=${alert.id}`} variant="outlined" size="small">
          Edit in playbook
        </ButtonLink>
      </Stack>

      <Paper component="section" elevation={1} sx={{ p: 2, mb: 2 }}>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(0, 1fr))" },
          }}
        >
          <Fact label="Fires when">
            price {formatAlertCondition(alert)}
            {distance != null && (
              <Typography component="span" variant="body2" color="text.secondary">
                {" "}
                · {distance === 0 ? "at trigger now" : `${distance.toFixed(1)}% away`}
              </Typography>
            )}
          </Fact>
          <Fact label="Starts after">
            {sources.length > 0 ? <StepLinks playbookId={playbook.id} steps={sources} /> : "Nothing — starts first"}
          </Fact>
          <Fact label="Then starts">
            {targets.length > 0 ? <StepLinks playbookId={playbook.id} steps={targets} /> : "Nothing — last step"}
          </Fact>
          <Fact label="Last fired">
            {alert.triggered_at
              ? `${formatTimeAgo(alert.triggered_at)} (${new Date(alert.triggered_at).toLocaleString()})`
              : "Not yet"}
          </Fact>
          {(alert.description || why) && (
            <Box sx={{ gridColumn: "1 / -1" }}>
              {alert.description && <Fact label="Note">{alert.description}</Fact>}
              {why && <Fact label="Why it follows">{why}</Fact>}
            </Box>
          )}
        </Box>
      </Paper>

      <Paper component="section" elevation={1} sx={{ p: 2, height: 600 }}>
        <StockChart data={candles} />
      </Paper>
    </>
  );
}
