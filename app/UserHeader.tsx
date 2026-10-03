import { Paper, Typography } from "@mui/material";

export default function UserHeader({ userEmail }: { userEmail: string | null }) {
  return (
    <Paper elevation={1} sx={{ width: "100%", p: 1.5, mb: 2 }}>
      <Typography variant="body2">
        {userEmail ? `Connected email: ${userEmail}` : "Guest mode"}
      </Typography>
    </Paper>
  );
}
