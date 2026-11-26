-- Cache for Gemini agent outputs (key = sha256(agent + system + input)).
create table if not exists ai_cache (
  key text primary key,
  output jsonb not null,
  created_at timestamptz default now()
);
