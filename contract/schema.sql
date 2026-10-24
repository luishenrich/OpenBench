-- BIY schema for Supabase Postgres. Run once in the Supabase SQL editor.
-- Shapes mirror contract/schemas.py; JSONB holds the flexible parts.
--
-- The API connects as the postgres role, which bypasses RLS. RLS is enabled on every
-- table with NO policies, so the anon/authenticated keys (PostgREST) can't read or
-- write anything. The frontend only talks to our API, never to these tables directly.

create extension if not exists pgcrypto;

create table if not exists workspace (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  default_profile jsonb not null default '{"weights": {"quality": 60, "speed": 20, "cost": 20}, "targets": {}}',
  default_judge   jsonb not null default '{"mode": "rubric"}',  -- JudgeConfig; no "judges" = the default jury
  mcp_key_hash    text unique,          -- sha256 of the "biy_…" key
  mcp_key_last4   text,
  created_at      timestamptz not null default now()
);

create table if not exists workspace_member (
  workspace_id uuid not null references workspace(id) on delete cascade,
  user_id      uuid not null,           -- auth.users.id from Supabase Auth
  email        text,
  primary key (workspace_id, user_id)
);
create index if not exists workspace_member_user on workspace_member(user_id);

create table if not exists use_case (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  name          text not null,
  kind          text not null check (kind in ('chat','batch','extraction','agent','classification','rag','summarization','generation','other')),
  description   text not null default '',
  source_refs   jsonb not null default '[]',
  current_model jsonb,                  -- ModelRef
  profile       jsonb,                  -- Profile; null → workspace default
  gates         jsonb not null default '[]',
  metrics       jsonb not null default '[]',
  judge         jsonb,                  -- JudgeConfig; null → workspace default
  io_spec       jsonb not null default '{}',
  created_by    text not null default 'dashboard' check (created_by in ('mcp','dashboard')),
  created_at    timestamptz not null default now()
);
create index if not exists use_case_ws on use_case(workspace_id);

create table if not exists test_case (    -- "case" is a reserved word
  id          uuid primary key default gen_random_uuid(),
  use_case_id uuid not null references use_case(id) on delete cascade,
  input       jsonb not null,            -- {"vars": …, "messages": …, "images": [url]}
  reference   jsonb,
  tags        text[] not null default '{}',
  source      text not null default 'repo' check (source in ('repo','synthetic','upload','trace','public')),
  created_at  timestamptz not null default now()
);
create index if not exists test_case_uc on test_case(use_case_id);

create table if not exists run (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspace(id) on delete cascade,
  use_case_id     uuid not null references use_case(id) on delete cascade,
  status          text not null default 'queued' check (status in ('queued','running','scoring','done','failed','cancelled')),
  candidates      jsonb not null,        -- ModelRef[] (baseline appended with is_baseline in config_snapshot)
  repeats         int not null default 3,
  include_baseline boolean not null default true,
  config_snapshot jsonb not null,        -- use case (profile, gates, metrics, judge, io_spec) at start
  est_cost_usd    numeric(12,6) not null default 0,
  actual_cost_usd numeric(12,6) not null default 0,
  total_jobs      int not null default 0,
  summary         jsonb,                 -- {leaderboard, pareto_points, recommendation} once done
  error           text,
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  finished_at     timestamptz
);
create index if not exists run_uc on run(use_case_id, created_at desc);

create table if not exists result (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid not null references run(id) on delete cascade,
  candidate_key text not null,           -- "nebius:zai-org/GLM-5.3-Flash"
  is_baseline   boolean not null default false,
  case_id       uuid not null references test_case(id) on delete cascade,
  repeat_idx    int not null,
  output        jsonb not null default '{}',   -- {text, json, tool_calls}
  timing        jsonb not null default '{}',   -- {ttft_ms, e2e_ms, tokens_per_s}
  usage         jsonb not null default '{}',
  cost_usd      numeric(12,8),
  error         text,
  scores        jsonb not null default '{}',   -- {metric_id: value in [0, 1]}
  judge         jsonb,                         -- {mode, score, reasoning, winner}
  created_at    timestamptz not null default now(),
  unique (run_id, candidate_key, case_id, repeat_idx)   -- makes retries idempotent
);
create index if not exists result_run on result(run_id, candidate_key);

alter table workspace        enable row level security;
alter table workspace_member enable row level security;
alter table use_case         enable row level security;
alter table test_case        enable row level security;
alter table run              enable row level security;
alter table result           enable row level security;

-- 2026-10-24: pins, "recently changed", case edits (additive, idempotent; safe to re-run)
alter table use_case  add column if not exists pinned     boolean     not null default false;
alter table use_case  add column if not exists pinned_at  timestamptz;
alter table use_case  add column if not exists setup_state text not null default 'complete';  -- 'in_progress' while the agent fills it in
alter table use_case  add column if not exists updated_at timestamptz not null default now();
alter table test_case add column if not exists updated_at timestamptz not null default now();

-- 2026-10-24: workspace defaults that use cases and runs inherit (additive, idempotent)
alter table workspace add column if not exists default_references jsonb;            -- ModelRef[]; null = built-in (Sol, Luna)
alter table workspace add column if not exists candidate_pool     jsonb not null default '{}';  -- CandidatePool
alter table workspace add column if not exists default_repeats    int   not null default 3;
alter table workspace add column if not exists max_run_cost_usd   numeric(12,4);    -- null = no cap
