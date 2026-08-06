-- The original participants UPDATE policy only checked which row a user could
-- target (auth.uid() = id), with no WITH CHECK on the resulting values. That
-- let any authenticated participant update their own row's `role` to 'Admin',
-- bypassing the restriction already enforced on INSERT. This closes that gap.

drop policy if exists "Participants can update own row, admins update all" on public.participants;

create policy "Participants can update own row, admins update all" on public.participants
  for update
  using (auth.uid() = id or public.is_admin())
  with check (public.is_admin() or (auth.uid() = id and role <> 'Admin'));
