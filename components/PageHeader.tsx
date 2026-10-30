import type { ReactNode } from "react";
import { Stack, Typography } from "@mui/material";

// A title on the left with actions on the right: the page title by default, or a section title.
export default function PageHeader({
  title,
  section = false,
  children,
}: {
  title: string;
  section?: boolean;
  children?: ReactNode;
}) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, mb: section ? 1.5 : 2 }}>
      <Typography variant={section ? "h6" : "h5"} component={section ? "h2" : "h1"}>
        {title}
      </Typography>
      {children}
    </Stack>
  );
}
