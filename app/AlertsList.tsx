"use client";

import { useState } from "react";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import { removeAlert } from "./actions";
import type { AlertOperator } from "./stockUtils";

type AlertListItem = {
  id: number;
  stock: string;
  email: string;
  price?: number | null;
  operator?: AlertOperator | null;
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
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Stock</TableCell>
          <TableCell>Condition</TableCell>
          <TableCell>Email</TableCell>
          <TableCell align="right" />
        </TableRow>
      </TableHead>
      <TableBody>
        {alerts.map((alert) => (
          <TableRow key={alert.id}>
            <TableCell>{alert.stock}</TableCell>
            <TableCell>{`${alert.operator ?? "="} ${alert.price ?? "?"}`}</TableCell>
            <TableCell>{alert.email}</TableCell>
            <TableCell align="right">
              <Button
                size="small"
                color="error"
                onClick={() => handleDelete(alert.id)}
                disabled={deletingId === alert.id}
              >
                {deletingId === alert.id ? "Deleting..." : "Delete"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
