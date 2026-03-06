create table if not exists public.campaign_stats (
  id int primary key default 1,
  total_raised numeric(12,2) not null default 0,
  heart_count int not null default 0,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

insert into public.campaign_stats (id, total_raised, heart_count)
values (1, 1498.00, 12)
on conflict (id) do nothing;

alter table public.campaign_stats enable row level security;

create policy "Allow public read" on public.campaign_stats for select using (true);
create policy "Service role can update" on public.campaign_stats for all using (auth.role() = 'service_role');

create or replace function public.increment_donation_total(amount_reais numeric default 0)
returns void language plpgsql security definer set search_path = public as $$
begin
  if amount_reais is null or amount_reais <= 0 then return; end if;
  update public.campaign_stats set total_raised = total_raised + amount_reais, updated_at = now() where id = 1;
  if not found then
    insert into public.campaign_stats (id, total_raised, heart_count, updated_at)
    values (1, amount_reais, 0, now())
    on conflict (id) do update set total_raised = campaign_stats.total_raised + amount_reais, updated_at = now();
  end if;
end;
$$;

grant execute on function public.increment_donation_total(numeric) to service_role;
