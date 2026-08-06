-- =============================================
-- Sales CRM — HeroTec
-- شغّل الكود ده في Supabase SQL Editor
-- =============================================

-- 1. جدول العملاء
create table if not exists leads (
  id          bigserial primary key,
  name        text not null,
  phone       text not null,
  job         text,
  stage       text not null default 'lead',
  comment     text,
  alert_text  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 2. جدول مكتبة الرسائل
create table if not exists messages (
  id         bigserial primary key,
  title      text not null,
  tag        text not null default 'عام',
  body       text not null,
  created_at timestamptz default now()
);

-- 3. جدول تاريخ تحرك العميل بين المراحل
create table if not exists lead_history (
  id         bigserial primary key,
  lead_id    bigint references leads(id) on delete cascade,
  stage      text not null,
  comment    text,
  created_at timestamptz default now()
);

-- =============================================
-- Row Level Security (RLS)
-- بيسمح بالوصول بدون login — لأنك المستخدم الوحيد
-- =============================================
alter table leads        enable row level security;
alter table messages     enable row level security;
alter table lead_history enable row level security;

-- سياسة: السماح بكل العمليات (anon key كافي)
create policy "allow all leads"        on leads        for all using (true) with check (true);
create policy "allow all messages"     on messages     for all using (true) with check (true);
create policy "allow all lead_history" on lead_history for all using (true) with check (true);

-- =============================================
-- Index للأداء
-- =============================================
create index if not exists idx_leads_stage      on leads(stage);
create index if not exists idx_history_lead_id  on lead_history(lead_id);
