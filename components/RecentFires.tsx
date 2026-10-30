"use client";

import Link from "next/link";
import { List, ListItemButton, ListItemText, Typography } from "@mui/material";

export type RecentFireItem = {
  id: number;
  label: string;
  playbookId: number;
  playbookName: string;
  firedAgo: string;
};

export default function RecentFires({ items }: { items: RecentFireItem[] }) {
  if (items.length === 0) {
    return <Typography color="text.secondary">No steps have fired yet.</Typography>;
  }

  return (
    <List disablePadding>
      {items.map((item) => (
        <ListItemButton
          key={item.id}
          component={Link}
          href={`/playbooks/${item.playbookId}/steps/${item.id}`}
          divider
          sx={{ px: 1 }}
        >
          <ListItemText
            primary={item.label}
            secondary={`${item.playbookName} · ${item.firedAgo}`}
            slotProps={{ secondary: { noWrap: true } }}
          />
        </ListItemButton>
      ))}
    </List>
  );
}
