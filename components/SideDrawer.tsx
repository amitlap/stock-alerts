"use client";

import type { ReactNode } from "react";
import { Box, Divider, Drawer, IconButton, Stack, Typography } from "@mui/material";

// Right-hand drawer with a titled header and a close button.
export default function SideDrawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: 420, display: "flex", flexDirection: "column", height: "100%" }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", p: 2 }}>
          <Typography variant="h6">{title}</Typography>
          <IconButton size="small" onClick={onClose} aria-label="Close">
            ✕
          </IconButton>
        </Stack>
        <Divider />
        <Box sx={{ p: 2, flex: 1, overflowY: "auto" }}>{children}</Box>
      </Box>
    </Drawer>
  );
}
