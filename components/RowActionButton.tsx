"use client";

import { Button, type ButtonProps } from "@mui/material";

// A small button for DataGrid cells: doesn't trigger the row click, and shows `pendingLabel` while busy.
export default function RowActionButton({
  onClick,
  pending = false,
  pendingLabel,
  children,
  ...props
}: Omit<ButtonProps, "onClick"> & {
  onClick: () => void;
  pending?: boolean;
  pendingLabel?: string;
}) {
  return (
    <Button
      size="small"
      {...props}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={pending}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
