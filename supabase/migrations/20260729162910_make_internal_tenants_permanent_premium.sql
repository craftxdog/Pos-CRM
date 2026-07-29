-- This deployment provisions tenants internally and does not sell access
-- through Stripe yet. Keep internally managed Premium access permanent while
-- leaving any Stripe-managed subscription lifecycle untouched.

create or replace function private.ensure_tenant_for_empresa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  tenant_uuid uuid;
  owner_uuid uuid;
begin
  insert into public.tenants (
    legacy_empresa_id,
    nombre,
    slug,
    estado,
    trial_ends_at
  )
  values (
    new.id,
    coalesce(nullif(new.nombre, ''), 'Organizacion'),
    'org-' || new.public_id::text,
    'active',
    null
  )
  on conflict (legacy_empresa_id) do update
    set nombre = excluded.nombre,
        updated_at = now()
  returning id into tenant_uuid;

  insert into public.tenant_subscriptions (
    tenant_id,
    plan_id,
    estado,
    current_period_start,
    current_period_end
  )
  select tenant_uuid, p.id, 'active', now(), null
  from public.saas_plans p
  where p.plan_key = 'premium'
    and not exists (
      select 1
      from public.tenant_subscriptions s
      where s.tenant_id = tenant_uuid
    );

  select u.id_auth::uuid into owner_uuid
  from public.usuarios u
  where u.id = new.id_usuario
    and u.id_auth ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

  if owner_uuid is not null then
    insert into public.tenant_memberships (tenant_id, user_id, role, estado)
    values (tenant_uuid, owner_uuid, 'owner', 'active')
    on conflict (tenant_id, user_id) do update
      set role = 'owner',
          estado = 'active',
          updated_at = now();
  end if;

  return new;
end;
$function$;

revoke all on function private.ensure_tenant_for_empresa() from public, anon, authenticated;

-- Repair tenants that were created by the legacy backfill after the original
-- subscription seed ran.
insert into public.tenant_subscriptions (
  tenant_id,
  plan_id,
  estado,
  current_period_start,
  current_period_end
)
select t.id, p.id, 'active', now(), null
from public.tenants t
cross join public.saas_plans p
where p.plan_key = 'premium'
  and not exists (
    select 1
    from public.tenant_subscriptions s
    where s.tenant_id = t.id
  )
on conflict do nothing;

-- Convert only locally managed trials. A Stripe subscription is deliberately
-- excluded so payment-provider states and billing periods remain authoritative.
update public.tenant_subscriptions
set estado = 'active',
    current_period_end = null,
    cancel_at_period_end = false,
    canceled_at = null,
    updated_at = now()
where stripe_subscription_id is null
  and estado = 'trialing';

update public.tenants t
set estado = 'active',
    trial_ends_at = null,
    updated_at = now()
where exists (
  select 1
  from public.tenant_subscriptions s
  where s.tenant_id = t.id
    and s.stripe_subscription_id is null
    and s.estado = 'active'
    and s.current_period_end is null
);

notify pgrst, 'reload schema';
