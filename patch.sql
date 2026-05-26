-- ==========================================================
-- FounderTrack Supabase Corrective Security & Logic Patch
-- ==========================================================
-- This patch resolves two critical RLS/logic bugs identified during code audit:
-- 1. Settings Bootstrapping: Allows the first authenticated user to claim the admin spot.
-- 2. Brainstorm Board Upvotes: Allows regular employees to upvote brainstorm ideas securely.

-- ----------------------------------------------------------
-- 1. Fix Settings Bootstrapping Policy
-- ----------------------------------------------------------
drop policy if exists "Allow write access to settings for admins only" on public.settings;
drop policy if exists "Allow insert of admin sentinel or admin write access" on public.settings;
drop policy if exists "Allow update of settings for admins only" on public.settings;
drop policy if exists "Allow delete of settings for admins only" on public.settings;

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

-- ----------------------------------------------------------
-- 2. Fix Brainstorm Board Upvoting (Trigger & Policies)
-- ----------------------------------------------------------
-- Create trigger function to securely control content updates
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

-- Apply update trigger to the brainstorm_ideas table
drop trigger if exists check_brainstorm_idea_update_trigger on public.brainstorm_ideas;
create trigger check_brainstorm_idea_update_trigger
before update on public.brainstorm_ideas
for each row execute function public.check_brainstorm_idea_update();

-- Relax RLS update policy so any authenticated user can attempt the update (the trigger handles input safety)
drop policy if exists "Allow update access to brainstorm_ideas for own user or admins" on public.brainstorm_ideas;
drop policy if exists "Allow update access to brainstorm_ideas for authenticated" on public.brainstorm_ideas;

create policy "Allow update access to brainstorm_ideas for authenticated" on public.brainstorm_ideas
  for update using (
    auth.role() = 'authenticated'
  );
