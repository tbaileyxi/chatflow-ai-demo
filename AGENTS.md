# Project conventions for Codex

## Sponsor outreach workflow

When the `sponsor-blitz` subagent finishes a run, **paste its full card output verbatim into the chat**. Do not summarize, condense, or replace the cards with a "saved to file" note. The user works by scrolling the chat and copying each card into LinkedIn — they need the cards in chat, not in a file they have to open.

The agent will also save the cards to `sponsor-outreach/YYYY-MM-DD-[batch].md` as a backup, but the chat output is the primary surface.

If the agent's output is very long, paste it all anyway. The user prefers a long, scrollable chat to a buried file.

## Sponsors tracker

Single source of truth for the sponsor pipeline lives at `sponsors-tracker.md`. When the user asks status questions ("who haven't I followed up with?", "pipeline value?", "everyone in Drafted?"), read the tracker directly and answer.

When the user reports outreach activity in plain English ("mark X as Sent", "Y replied — booking Thursday"), update the relevant row's `Status` and `Last Touch`, and append a dated entry under the company's heading in `## Prospect log`.
