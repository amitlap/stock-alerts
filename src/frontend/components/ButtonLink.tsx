"use client";

import Link from "next/link";
import { Button, type ButtonProps } from "@mui/material";

// Keeps the Link function reference on the client side, so server components can render it as JSX.
export default function ButtonLink({ href, ...props }: ButtonProps & { href: string }) {
  return <Button component={Link} href={href} {...props} />;
}
