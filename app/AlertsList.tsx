"use client";

import { useState } from "react";
import { Button, List, ListItem, ListItemText } from "@mui/material";
import { removeAlert } from "./actions";

type AlertListItem = {
  id: number;
  stock: string;
  email: string;
};

export default function AlertsList({ alerts }: { alerts: AlertListItem[] }) {
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await removeAlert(id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <List disablePadding>
      {alerts.map((alert) => (
        <ListItem
          key={alert.id}
          disableGutters
          secondaryAction={
            <Button
              size="small"
              color="error"
              onClick={() => handleDelete(alert.id)}
              disabled={deletingId === alert.id}
            >
              {deletingId === alert.id ? "Deleting..." : "Delete"}
            </Button>
          }
        >
          <ListItemText primary={`${alert.stock} — ${alert.email}`} />
        </ListItem>
      ))}
    </List>
  );
}
