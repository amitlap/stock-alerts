import { List, ListItem, ListItemText, Typography } from "@mui/material";

export type TelegramMessageItem = { id: number; text: string; receivedAgo: string };

// The latest texts the user sent the Telegram bot.
export default function TelegramMessages({ items }: { items: TelegramMessageItem[] }) {
  if (items.length === 0) {
    return <Typography color="text.secondary">No messages yet. Send the bot a text and it shows up here.</Typography>;
  }

  return (
    <List disablePadding>
      {items.map((item) => (
        <ListItem key={item.id} divider sx={{ px: 1 }}>
          <ListItemText
            primary={item.text}
            secondary={item.receivedAgo}
            slotProps={{ primary: { sx: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" } } }}
          />
        </ListItem>
      ))}
    </List>
  );
}
