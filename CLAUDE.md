# Project conventions for Claude Code

## Sponsor outreach workflow

When the `sponsor-blitz` subagent finishes a run, **paste its full card output verbatim into the chat**. Do not summarize, condense, or replace the cards with a "saved to file" note. The user reads and sends from the chat, not from a file they have to open.

The agent also saves the cards to `sponsor-outreach/YYYY-MM-DD-[batch].md` as a backup, but the chat output is the primary surface.

If the output is long, paste it all anyway. A long scrollable chat beats a buried file.

Do NOT assume a specific outreach channel. Sponsors and community owners are different audiences reached different ways — local businesses are not reached the same way as alumni chapter officers. Each card should say which channel to use and give the exact link to open.

## Sponsors tracker

Single source of truth for the sponsor pipeline lives at `sponsors-tracker.md`. When the user asks status questions ("who haven't I followed up with?", "pipeline value?", "everyone in Drafted?"), read the tracker directly and answer.

When the user reports outreach activity in plain English ("mark X as Sent", "Y replied — booking Thursday"), update the relevant row's `Status` and `Last Touch`, and append a dated entry under the company's heading in `## Prospect log`.
