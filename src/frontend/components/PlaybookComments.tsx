"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, IconButton, Paper, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { addComment, removeComment } from "@/backend/actions";
import { useAsyncAction, usePendingId } from "@/frontend/hooks";
import { formatTimeAgo } from "@/shared/format";
import { MAX_COMMENT_LENGTH, type PlaybookComment } from "@/shared/types";

// The messages on a playbook, shared between its owner and its viewers.
export default function PlaybookComments({
  playbookId,
  comments,
  currentEmail,
  isOwner,
  isPublic,
}: {
  playbookId: number;
  comments: PlaybookComment[];
  currentEmail: string | undefined;
  isOwner: boolean;
  isPublic: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const posting = useAsyncAction();
  const removing = usePendingId();

  async function handlePost() {
    if (await posting.run(() => addComment(playbookId, body))) {
      setBody("");
      router.refresh();
    }
  }

  function handleRemove(id: number) {
    return removing.run(id, async () => {
      await removeComment(id);
      router.refresh();
    });
  }

  return (
    <Paper component="section" elevation={1} sx={{ p: 2, gridColumn: "1 / -1" }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        Comments ({comments.length})
      </Typography>
      {isOwner && !isPublic && (
        <Typography variant="caption" color="text.secondary">
          This playbook is private, so only you can see these.
        </Typography>
      )}

      <Stack spacing={1.5} sx={{ mt: 1.5 }}>
        {comments.map((comment) => (
          <Box key={comment.id} sx={{ borderBottom: 1, borderColor: "divider", pb: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 600, minWidth: 0 }}>
                {comment.author_email === currentEmail ? "You" : comment.author_email}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                title={new Date(comment.created_at).toLocaleString()}
                sx={{ flexShrink: 0 }}
              >
                {formatTimeAgo(comment.created_at)}
              </Typography>
              <Box sx={{ flex: 1 }} />
              {(isOwner || comment.author_email === currentEmail) && (
                <Tooltip title="Delete comment">
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      aria-label="Delete comment"
                      disabled={removing.pendingId === comment.id}
                      onClick={() => handleRemove(comment.id)}
                      sx={{ fontSize: 13 }}
                    >
                      ✕
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Stack>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {comment.body}
            </Typography>
          </Box>
        ))}
      </Stack>
      {removing.error && (
        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
          Couldn&apos;t delete the comment: {removing.error}
        </Typography>
      )}

      <Stack spacing={1} sx={{ mt: 2, alignItems: "flex-end" }}>
        <TextField
          label="Write a comment"
          size="small"
          fullWidth
          multiline
          minRows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          slotProps={{ htmlInput: { maxLength: MAX_COMMENT_LENGTH } }}
        />
        {posting.error && (
          <Typography color="error" variant="body2" sx={{ alignSelf: "flex-start" }}>
            Couldn&apos;t post the comment: {posting.error}
          </Typography>
        )}
        <Button size="small" variant="contained" onClick={handlePost} disabled={posting.pending || !body.trim()}>
          {posting.pending ? "Posting..." : "Post"}
        </Button>
      </Stack>
    </Paper>
  );
}
