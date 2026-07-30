-- The route guard must be able to distinguish a disabled feature from an
-- expired tenant subscription. Keep this lookup independent from legacy POS
-- tables so an expired plan can render a recovery screen instead of waiting
-- forever for a profile hidden by the feature-gate policies.
create or replace function public.get_current_tenant_access()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  with current_tenant as (
    select t.*
    from public.tenants t
    where t.id = (select private.current_tenant_id())
  ), current_subscription as (
    select
      s.estado,
      s.current_period_start,
      s.current_period_end,
      s.cancel_at_period_end,
      p.plan_key,
      p.nombre as plan_name
    from public.tenant_subscriptions s
    join public.saas_plans p on p.id = s.plan_id
    where s.tenant_id = (select id from current_tenant)
    order by
      case
        when s.estado in ('trialing', 'active', 'past_due', 'unpaid', 'incomplete', 'paused')
          then 0
        else 1
      end,
      s.created_at desc
    limit 1
  ), feature_access as (
    select
      f.feature_key,
      (select private.tenant_has_feature(
        (select id from current_tenant),
        f.feature_key
      )) as enabled
    from public.saas_features f
  )
  select jsonb_build_object(
    'tenant_id', t.id,
    'name', t.nombre,
    'status', t.estado,
    'subscription', (
      select jsonb_build_object(
        'status', cs.estado,
        'plan_key', cs.plan_key,
        'plan_name', cs.plan_name,
        'current_period_start', cs.current_period_start,
        'current_period_end', cs.current_period_end,
        'cancel_at_period_end', cs.cancel_at_period_end
      )
      from current_subscription cs
    ),
    'features', coalesce(
      (select jsonb_object_agg(feature_key, enabled) from feature_access),
      '{}'::jsonb
    )
  )
  from current_tenant t;
$function$;

revoke all on function public.get_current_tenant_access() from public, anon;
grant execute on function public.get_current_tenant_access() to authenticated;

notify pgrst, 'reload schema';
