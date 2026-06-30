create table if not exists questions (
  id text primary key,
  sort_order integer not null default 0,
  category text not null,
  question text not null,
  options jsonb not null,
  status text not null default 'ready',
  winner text not null,
  explanation text not null,
  model_results jsonb not null,
  generated_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists questions_status_sort_idx
  on questions (status, sort_order, id);

create table if not exists question_runs (
  id text primary key,
  deck jsonb not null,
  current_index integer not null default 0,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 hours'
);

create index if not exists question_runs_expires_idx
  on question_runs (expires_at);
