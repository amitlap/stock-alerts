"use client";

import { useState } from "react";
import { Button, Stack, Typography } from "@mui/material";
import AddAlertForm from "./AddAlertForm";
import AlertsList from "./AlertsList";
import AllAlertsTable from "./AllAlertsTable";
import PageHeader from "./PageHeader";
import { getAllAlerts, type Alert, type Playbook } from "@/lib/actions";
import { useAsyncAction } from "@/lib/hooks";

export default function AlertsPanel({
  initialAlerts,
  playbooks = [],
}: {
  initialAlerts: Alert[];
  playbooks?: Playbook[];
}) {
  const [allAlerts, setAllAlerts] = useState<Alert[] | null>(null);
  const loadAll = useAsyncAction();

  function handleHideAll() {
    setAllAlerts(null);
    loadAll.setError(null);
  }

  return (
    <>
      <PageHeader title="My Alerts">
        <Stack direction="row" spacing={1}>
          {allAlerts ? (
            <Button size="small" variant="outlined" onClick={handleHideAll}>
              Hide all alerts
            </Button>
          ) : (
            <Button
              size="small"
              variant="outlined"
              onClick={() => loadAll.run(async () => setAllAlerts(await getAllAlerts()))}
              disabled={loadAll.pending}
            >
              {loadAll.pending ? "Loading..." : "Show all alerts"}
            </Button>
          )}
          <AddAlertForm />
        </Stack>
      </PageHeader>
      <AlertsList alerts={initialAlerts} playbooks={playbooks} />
      {loadAll.error && (
        <Typography color="error" variant="body2" sx={{ mt: 2 }}>
          Failed to load alerts: {loadAll.error}
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
