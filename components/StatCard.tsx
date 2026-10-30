import type { ReactNode } from "react";
import { Paper, Typography } from "@mui/material";

export default function StatCard({
  label,
  value,
  caption,
  valueColor,
  children,
}: {
  label: string;
  value: ReactNode;
  caption: ReactNode;
  valueColor?: string;
  children?: ReactNode;
}) {
  return (
    <Paper sx={{ p: 2, flex: 1, minWidth: 0 }}>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h4" color={valueColor}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {caption}
      </Typography>
      {children}
    </Paper>
  );
}
