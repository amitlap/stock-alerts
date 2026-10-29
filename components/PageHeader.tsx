import type { ReactNode } from "react";
import { Stack, Typography } from "@mui/material";

// Page title on the left, actions on the right.
export default function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
      <Typography variant="h5" component="h1">
        {title}
      </Typography>
      {children}
    </Stack>
  );
}
