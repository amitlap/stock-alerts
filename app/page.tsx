"use client";

import { useState } from "react";
import {
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { TICKERS } from "./constants";
import StockHeader from "./StockHeader";

export default function Home() {

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <StockHeader />
      <Paper component="main" elevation={1} sx={{ width: "100%", maxWidth: 400, p: 4 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          Stock Order
        </Typography>
      </Paper>
    </div>
  );
}

