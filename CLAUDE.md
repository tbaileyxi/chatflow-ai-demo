# Project conventions for Claude Code

## Sponsor outreach workflow

When the `sponsor-blitz` subagent finishes a run, **paste its full card output verbatim into the chat**. Do not summarize, condense, or replace the cards with a "saved to file" note. The user reads and sends from the chat, not from a file they have to open.

The agent also saves the cards to `sponsor-outreach/YYYY-MM-DD-[batch].md` as a backup, but the chat output is the primary surface.

If the output is long, paste it all anyway. A long scrollable chat beats a buried file.

Do NOT assume a specific outreach channel. Sponsors and community owners are different audiences reached different ways — local businesses are not reached the same way as alumni chapter officers. Each card should say which channel to use and give the exact link to open.

## Sponsor + chapter pipeline

**`sponsor_leads` and `chapter_leads` in Supabase are the source of truth**, surfaced on
the `/outreach` dashboard. Read those when the user asks status questions ("who haven't I
followed up with?", "pipeline value?", "everyone in Drafted?"), and write status changes
there.

`sponsors-tracker.md` is **archived and must not be trusted or updated**. It was the
original tracker, maintained by editing markdown, and it has diverged from the table that
`outreach-send` actually reads — statuses in the file do not reflect what has been sent.
Two sources that silently disagree is worse than one that is occasionally stale, so the
file stays only as history. If the user asks to update it, tell them it is archived and
update the table instead.
