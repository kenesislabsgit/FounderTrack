-- ==========================================
-- FounderTrack PostgreSQL / Supabase Schema
-- ==========================================

-- Clean up existing tables if they exist
drop table if exists public.ballots cascade;
drop table if exists public.review_cycles cascade;
drop table if exists public.brainstorm_ideas cascade;
drop table if exists public.leave_requests cascade;
drop table if exists public.daily_reports cascade;
drop table if exists public.attendance cascade;
drop table if exists public.settings cascade;
drop table if exists public.users cascade;

-- 1. Users Table
-- uid references auth.users(id) in Supabase.
create table public.users (
  uid uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  email text not null unique,
  role text not null check (role in ('founder', 'admin', 'employee', 'intern')),
  photo_url text,
  preferences jsonb default '{"emailNotifications": false, "pushNotifications": false}'::jsonb
);

-- 2. Attendance Table
create table public.attendance (
  id uuid default gen_random_uuid() primary key,
  uid uuid references public.users(uid) on delete cascade not null,
  date date not null,
  check_in_time timestamptz,
  check_out_time timestamptz,
  check_in_location jsonb, -- {lat: number, lng: number}
  check_out_location jsonb, -- {lat: number, lng: number}
  check_in_photo text,
  check_out_photo text,
  total_hours numeric,
  status text not null check (status in ('present', 'wfh', 'leave')),
  unique (uid, date)
);

-- 3. Daily Reports Table
create table public.daily_reports (
  id uuid default gen_random_uuid() primary key,
  uid uuid references public.users(uid) on delete cascade not null,
  date date not null,
  attendance_id uuid references public.attendance(id) on delete set null,
  report_url text,
  todo_list jsonb default '[]'::jsonb, -- array of {task: string, completed: boolean}
  unique (uid, date)
);

-- 4. Leave Requests Table
create table public.leave_requests (
  id uuid default gen_random_uuid() primary key,
  uid uuid references public.users(uid) on delete cascade not null,
  start_date date not null,
  end_date date not null,
  reason text not null,
  type text not null check (type in ('leave', 'wfh')),
  status text not null check (status in ('pending', 'approved', 'rejected')) default 'pending'
);

-- 5. Brainstorm Ideas Table
create table public.brainstorm_ideas (
  id uuid default gen_random_uuid() primary key,
  uid uuid references public.users(uid) on delete cascade not null,
  author_name text not null,
  title text not null,
  description text not null,
  category text not null check (category in ('idea', 'todo', 'discussion')),
  status text not null check (status in ('open', 'in-progress', 'completed', 'archived')) default 'open',
  created_at timestamptz default now() not null,
  upvotes uuid[] default '{}'::uuid[] -- array of user uids
);

-- 6. Review Cycles Table
create table public.review_cycles (
  id uuid default gen_random_uuid() primary key,
  start_date timestamptz default now() not null,
  end_date timestamptz not null,
  status text not null check (status in ('active', 'voting', 'completed')) default 'active',
  underperformer_uid uuid references public.users(uid) on delete set null,
  is_tie boolean default false,
  tie_breaker_uid uuid references public.users(uid) on delete set null,
  results jsonb -- map of uid -> average rank (number)
);

-- 7. Ballots Table
create table public.ballots (
  id uuid default gen_random_uuid() primary key,
  cycle_id uuid references public.review_cycles(id) on delete cascade not null,
  voter_uid uuid references public.users(uid) on delete cascade not null,
  rankings jsonb not null, -- array of {targetUid: string, rank: number, reason: string}
  created_at timestamptz default now() not null,
  unique (cycle_id, voter_uid)
);

-- 8. Settings Table
create table public.settings (
  id text primary key,
  value jsonb not null
);

-- ==========================================
-- Security & RLS Helper Functions
-- ==========================================

create or replace function public.is_admin(user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.users
    where uid = user_id and (role = 'admin' or role = 'founder')
  );
end;
$$ language plpgsql security definer;

create or replace function public.is_founder(user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.users
    where uid = user_id and role = 'founder'
  );
end;
$$ language plpgsql security definer;

create or replace function public.check_brainstorm_idea_update()
returns trigger as $$
begin
  -- Admins and the original author can modify everything
  if is_admin(auth.uid()) or auth.uid() = OLD.uid then
    return NEW;
  end if;

  -- Standard authenticated users can ONLY modify the upvotes column
  if NEW.id <> OLD.id or
     NEW.uid <> OLD.uid or
     NEW.author_name <> OLD.author_name or
     NEW.title <> OLD.title or
     NEW.description <> OLD.description or
     NEW.category <> OLD.category or
     NEW.status <> OLD.status or
     NEW.created_at <> OLD.created_at then
    raise exception 'Permission denied: You can only update the upvotes on this brainstorm idea.';
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

-- ==========================================
-- Row-Level Security (RLS) Configuration
-- ==========================================

-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.attendance enable row level security;
alter table public.daily_reports enable row level security;
alter table public.leave_requests enable row level security;
alter table public.brainstorm_ideas enable row level security;
alter table public.review_cycles enable row level security;
alter table public.ballots enable row level security;
alter table public.settings enable row level security;

-- 1. Users Policies
create policy "Allow read access to users for authenticated" on public.users
  for select using (auth.role() = 'authenticated');

create policy "Allow insert access to users for own profile or admins" on public.users
  for insert with check (
    auth.uid() = uid or is_admin(auth.uid())
  );

create policy "Allow update access to users for own profile or admins" on public.users
  for update using (
    auth.uid() = uid or is_admin(auth.uid())
  );

-- 2. Attendance Policies
create policy "Allow read access to attendance for owner or admins" on public.attendance
  for select using (
    auth.uid() = uid or is_admin(auth.uid())
  );

create policy "Allow insert access to attendance for owner" on public.attendance
  for insert with check (
    auth.uid() = uid
  );

create policy "Allow update access to attendance for owner or admins" on public.attendance
  for update using (
    auth.uid() = uid or is_admin(auth.uid())
  );

create policy "Allow delete access to attendance for admins only" on public.attendance
  for delete using (
    is_admin(auth.uid())
  );

-- 3. Daily Reports Policies
create policy "Allow read access to daily_reports for owner or admins" on public.daily_reports
  for select using (
    auth.uid() = uid or is_admin(auth.uid())
  );

create policy "Allow insert access to daily_reports for owner" on public.daily_reports
  for insert with check (
    auth.uid() = uid
  );

create policy "Allow update access to daily_reports for owner or admins" on public.daily_reports
  for update using (
    auth.uid() = uid or is_admin(auth.uid())
  );

create policy "Allow delete access to daily_reports for admins only" on public.daily_reports
  for delete using (
    is_admin(auth.uid())
  );

-- 4. Leave Requests Policies
create policy "Allow read access to leave_requests for owner or admins" on public.leave_requests
  for select using (
    auth.uid() = uid or is_admin(auth.uid())
  );

create policy "Allow insert access to leave_requests for owner" on public.leave_requests
  for insert with check (
    auth.uid() = uid
  );

create policy "Allow update access to leave_requests for owner or admins" on public.leave_requests
  for update using (
    auth.uid() = uid or is_admin(auth.uid())
  );

create policy "Allow delete access to leave_requests for admins only" on public.leave_requests
  for delete using (
    is_admin(auth.uid())
  );

-- 5. Brainstorm Ideas Policies
create policy "Allow read access to brainstorm_ideas for authenticated" on public.brainstorm_ideas
  for select using (
    auth.role() = 'authenticated'
  );

create policy "Allow insert access to brainstorm_ideas for own user" on public.brainstorm_ideas
  for insert with check (
    auth.uid() = uid
  );

create policy "Allow update access to brainstorm_ideas for authenticated" on public.brainstorm_ideas
  for update using (
    auth.role() = 'authenticated'
  );

-- Securely guard brainstorm updates with a before-update trigger
drop trigger if exists check_brainstorm_idea_update_trigger on public.brainstorm_ideas;
create trigger check_brainstorm_idea_update_trigger
before update on public.brainstorm_ideas
for each row execute function public.check_brainstorm_idea_update();

create policy "Allow delete access to brainstorm_ideas for own user or admins" on public.brainstorm_ideas
  for delete using (
    auth.uid() = uid or is_admin(auth.uid())
  );

-- 6. Review Cycles Policies
create policy "Allow read access to review_cycles for admins only" on public.review_cycles
  for select using (
    is_admin(auth.uid())
  );

create policy "Allow write access to review_cycles for admins only" on public.review_cycles
  for all using (
    is_admin(auth.uid())
  );

-- 7. Ballots Policies
create policy "Allow read access to ballots for admins only" on public.ballots
  for select using (
    is_admin(auth.uid())
  );

create policy "Allow insert access to ballots for admins or voters" on public.ballots
  for insert with check (
    auth.uid() = voter_uid or is_admin(auth.uid())
  );

create policy "Allow update/delete access to ballots for admins only" on public.ballots
  for all using (
    is_admin(auth.uid())
  );

-- 8. Settings Policies
create policy "Allow read access to settings for authenticated" on public.settings
  for select using (
    auth.role() = 'authenticated'
  );

create policy "Allow insert of admin sentinel or admin write access" on public.settings
  for insert with check (
    id = 'admin-assigned' or is_admin(auth.uid())
  );

create policy "Allow update of settings for admins only" on public.settings
  for update using (
    is_admin(auth.uid())
  );

create policy "Allow delete of settings for admins only" on public.settings
  for delete using (
    is_admin(auth.uid())
  );

-- ==========================================
-- Storage Setup Advice (Supabase Storage Buckets)
-- ==========================================
-- Make sure to create a storage bucket named "check-in-photos" in Supabase,
-- and enable Row-Level Security (RLS) on it with policies allowing:
--   - Read: auth.role() == 'authenticated' and (photo owner uid or public.is_admin(auth.uid()))
--   - Insert/Update: auth.role() == 'authenticated' and auth.uid() == owner uid
