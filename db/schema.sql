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
