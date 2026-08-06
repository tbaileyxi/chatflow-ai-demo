-- Nightly pruning of tables that grow forever and are never read by the app.
--
-- Background: the database hit 1,006 MB against a 500 MB limit on 2026-07-29.
-- 776 MB of that was cron.job_run_details (458 MB) and net._http_response
-- (318 MB) — receipts written after each of ~4,800 scheduled job runs per day.
-- Both were truncated; these jobs stop them growing back.
--
-- seen_news is the news bot's dedup ledger (~3,400 rows/day). The app never
-- reads it: what users see is huddle_messages. Old rows only prevent an old
-- article being reposted, and computeCluster() looks back 24 hours, so a
-- 30-day window is a wide margin.

-- Operational logs: cron receipts + pg_net response bodies.
select cron.schedule('prune-logs', '0 4 * * *', $job$
  delete from cron.job_run_details where end_time < now() - interval '3 days';
  delete from net._http_response  where created  < now() - interval '6 hours';
$job$);

-- News dedup ledger: hold at 30 days so it stops creeping.
select cron.schedule('prune-seen-news', '30 4 * * *', $job$
  delete from public.seen_news where created_at < now() - interval '30 days';
$job$);
