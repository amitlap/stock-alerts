"use client";

import { useState } from "react";
import { Button, Stack, Typography } from "@mui/material";
import AddAlertForm from "./AddAlertForm";
import AlertsList from "./AlertsList";
import AllAlertsTable from "./AllAlertsTable";
import { getAllAlerts, type Alert } from "@/lib/actions";

export default function AlertsPanel({ initialAlerts }: { initialAlerts: Alert[] }) {
  const [allAlerts, setAllAlerts] = useState<Alert[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleShowAll() {
    setLoading(true);
    setError(null);
    try {
      setAllAlerts(await getAllAlerts());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleHideAll() {
    setAllAlerts(null);
    setError(null);
  }

  return (
    <>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h5" component="h1">
          My Alerts
        </Typography>
        <Stack direction="row" spacing={1}>
          {allAlerts ? (
            <Button size="small" variant="outlined" onClick={handleHideAll}>
              Hide all alerts
            </Button>
          ) : (
            <Button size="small" variant="outlined" onClick={handleShowAll} disabled={loading}>
              {loading ? "Loading..." : "Show all alerts"}
            </Button>
          )}
          <AddAlertForm />
        </Stack>
      </Stack>
      <AlertsList alerts={initialAlerts} />
      {error && (
        <Typography color="error" variant="body2" sx={{ mt: 2 }}>
          Failed to load alerts: {error}
        </Typography>
      )}
      {allAlerts && (
        <>
          <Typography variant="h6" component="h2" sx={{ mt: 3, mb: 1 }}>
            All Alerts
          </Typography>
          <AllAlertsTable alerts={allAlerts} />
        </>
      )}
    </>
  );
}

