-- ============================================================================
-- READ-ONLY database size diagnostic. Changes nothing, writes nothing.
-- Run in Supabase Dashboard -> SQL Editor. Send back the output of each block.
-- ============================================================================

-- 1) Total database size
select pg_size_pretty(pg_database_size(current_database())) as total_db_size;


-- 2) Biggest 25 tables across EVERY schema, not just public.
--    Operational logs (cron, net, auth, storage) are excluded from most
--    dashboards but still count against the quota.
select
  n.nspname                                              as schema,
  c.relname                                              as table,
  pg_size_pretty(pg_total_relation_size(c.oid))          as total,
  pg_size_pretty(pg_relation_size(c.oid))                as data,
  pg_size_pretty(pg_indexes_size(c.oid))                 as indexes,
  to_char(c.reltuples::bigint, 'FM999,999,999')          as est_rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p', 'm')
  and n.nspname not in ('pg_catalog', 'information_schema')
order by pg_total_relation_size(c.oid) desc
limit 25;


-- 3) Size per schema — shows at a glance whether the weight is your app
--    data (public) or background machinery (cron / net / realtime).
select
  n.nspname as schema,
  pg_size_pretty(sum(pg_total_relation_size(c.oid))) as total
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p', 'm')
  and n.nspname not in ('pg_catalog', 'information_schema')
group by n.nspname
order by sum(pg_total_relation_size(c.oid)) desc;


-- 4) pg_cron run history. One row per scheduled job run, kept forever unless
--    something prunes it. This project schedules ~12 job runs per minute.
select
  count(*)                                   as job_run_rows,
  min(start_time)                            as oldest,
  max(start_time)                            as newest,
  pg_size_pretty(pg_total_relation_size('cron.job_run_details')) as size
from cron.job_run_details;


-- 5) pg_net response bodies. Every cron -> edge-function call stores its
--    HTTP response here.
select
  count(*) as http_response_rows,
  pg_size_pretty(pg_total_relation_size('net._http_response')) as size
from net._http_response;


-- 6) Dead rows (bloat). High dead-tuple counts mean space is allocated but
--    unusable until vacuumed.
select
  schemaname || '.' || relname as table,
  n_live_tup  as live_rows,
  n_dead_tup  as dead_rows,
  last_autovacuum
from pg_stat_user_tables
where n_dead_tup > 10000
order by n_dead_tup desc
limit 15;


-- 7) What is actually scheduled right now, and how often.
select jobid, schedule, left(command, 60) as command, active
from cron.job
order by schedule, jobid;
