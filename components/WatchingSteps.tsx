"use client";

import Link from "next/link";
import { Box, Chip, LinearProgress, List, ListItemButton, Stack, Typography } from "@mui/material";
import { formatAlertCondition, NEAR_TRIGGER_PERCENT, priceChangeColor } from "@/lib/stockUtils";

export type WatchingStepItem = {
  id: number;
  stock: string;
  operator: string | null;
  price: number | null;
  playbookId: number;
  playbookName: string;
  currentPrice: number | null;
  change: number | null;
  distance: number | null;
};

// Bar fills as the price closes in on the trigger; anything 10%+ away shows as empty.
function closeness(distance: number) {
  return Math.max(0, 100 - distance * 10);
}

export default function WatchingSteps({ items }: { items: WatchingStepItem[] }) {
  if (items.length === 0) {
    return (
      <Typography color="text.secondary">
        No steps are watching right now. Create a playbook, or switch on a step in one of yours.
      </Typography>
    );
  }

  return (
    <List disablePadding>
      {items.map((item) => {
        const atTrigger = item.distance === 0;
        const near = item.distance != null && item.distance <= NEAR_TRIGGER_PERCENT;
        return (
          <ListItemButton
            key={item.id}
            component={Link}
            href={`/playbooks/${item.playbookId}/steps/${item.id}`}
            divider
            sx={{ px: 1, py: 1.25, alignItems: "flex-start" }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", flexWrap: "wrap" }}>
                <Typography sx={{ fontWeight: 600 }}>{item.stock}</Typography>
                <Typography variant="body2" color="text.secondary">
                  fires at {formatAlertCondition(item)}
                </Typography>
                {atTrigger ? (
                  <Chip size="small" color="error" label="At trigger" />
                ) : near ? (
                  <Chip size="small" color="warning" label="Near" />
                ) : null}
              </Stack>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                {item.playbookName}
              </Typography>
              {item.distance != null && (
                <LinearProgress
                  variant="determinate"
                  value={closeness(item.distance)}
                  color={atTrigger ? "error" : near ? "warning" : "primary"}
                  sx={{ mt: 0.75, height: 4, borderRadius: 2, maxWidth: 260 }}
                />
              )}
            </Box>
            <Box sx={{ textAlign: "right", ml: 2, flexShrink: 0 }}>
              <Typography sx={{ color: priceChangeColor(item.change), fontWeight: 500 }}>
                {item.currentPrice != null ? `$${item.currentPrice.toFixed(2)}` : "—"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {item.distance == null ? "no price" : atTrigger ? "triggered" : `${item.distance.toFixed(1)}% away`}
              </Typography>
            </Box>
          </ListItemButton>
        );
      })}
    </List>
  );
}
