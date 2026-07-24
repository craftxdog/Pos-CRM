-- ActiveSelfControl: authoritative POS money calculations and SaaS tenancy.
-- Numeric legacy keys remain internal for backwards compatibility. Every
-- existing business table receives an immutable UUID for external references;
-- all new SaaS aggregates use UUID primary and foreign keys exclusively.

do $migration$
declare
  target record;
begin
  for target in
    select c.oid::regclass as table_name, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'id'
    join pg_type t on t.oid = a.atttypid
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and t.typname in ('int2', 'int4', 'int8')
      and not a.attisdropped
  loop
    execute format(
      'alter table %s add column if not exists public_id uuid not null default gen_random_uuid()',
      target.table_name
    );
    execute format(
      'create unique index if not exists %I on %s (public_id)',
      left(target.relname || '_public_id_uidx', 63),
      target.table_name
    );
  end loop;
end
$migration$;

alter table public.empresa
  add column if not exists precios_incluyen_impuesto boolean not null default true;

update public.empresa
set valor_impuesto = greatest(0, least(100, coalesce(valor_impuesto, 0)));

alter table public.empresa
  drop constraint if exists empresa_valor_impuesto_rango_check,
  add constraint empresa_valor_impuesto_rango_check
    check (valor_impuesto >= 0 and valor_impuesto <= 100);

alter table public.productos
  add column if not exists aplica_impuesto boolean not null default true;

alter table public.detalle_venta
  add column if not exists subtotal numeric(14,2) not null default 0,
  add column if not exists impuesto_total numeric(14,2) not null default 0,
  add column if not exists costo_total numeric(14,2) not null default 0,
  add column if not exists ganancia numeric(14,2) not null default 0;

create or replace function private.calculate_sale_line()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  tax_percent numeric := 0;
  prices_include_tax boolean := true;
  is_taxable boolean := true;
  base_amount numeric(18,4);
  tax_amount numeric(18,4);
  payable_amount numeric(18,4);
begin
  if new.cantidad is null or new.cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor que cero';
  end if;
  if coalesce(new.precio_venta, 0) < 0 or coalesce(new.precio_compra, 0) < 0 then
    raise exception 'Los precios no pueden ser negativos';
  end if;

  select
    coalesce(e.valor_impuesto, 0),
    coalesce(e.precios_incluyen_impuesto, true),
    coalesce(p.aplica_impuesto, true)
  into tax_percent, prices_include_tax, is_taxable
  from public.ventas v
  join public.empresa e on e.id = v.id_empresa
  left join public.productos p on p.id = new.id_producto
  where v.id = new.id_venta;

  if not found then
    raise exception 'La venta no existe o no pertenece a una empresa valida';
  end if;

  payable_amount := round(new.cantidad * coalesce(new.precio_venta, 0), 2);
  if not is_taxable or tax_percent = 0 then
    base_amount := payable_amount;
    tax_amount := 0;
  elsif prices_include_tax then
    base_amount := round(payable_amount / (1 + tax_percent / 100), 2);
    tax_amount := payable_amount - base_amount;
  else
    base_amount := payable_amount;
    tax_amount := round(base_amount * tax_percent / 100, 2);
    payable_amount := base_amount + tax_amount;
  end if;

  new.subtotal := base_amount;
  new.impuesto_total := tax_amount;
  new.total := payable_amount;
  new.costo_total := round(new.cantidad * coalesce(new.precio_compra, 0), 2);
  -- Profit excludes collected tax; tax is a liability, not revenue.
  new.ganancia := round(base_amount - new.costo_total, 2);
  return new;
end;
$function$;

revoke all on function private.calculate_sale_line() from public, anon, authenticated;

drop trigger if exists trg_calculate_sale_line on public.detalle_venta;
create trigger trg_calculate_sale_line
before insert or update of cantidad, precio_venta, precio_compra, id_producto, id_venta
on public.detalle_venta
for each row execute function private.calculate_sale_line();

create or replace function private.recalculate_sale_totals(target_sale_id bigint)
returns void
language sql
security invoker
set search_path = ''
as $function$
  update public.ventas v
  set
    sub_total = totals.subtotal,
    total_impuestos = totals.impuestos,
    monto_total = totals.total,
    cantidad_productos = totals.cantidad
  from (
    select
      coalesce(round(sum(dv.subtotal), 2), 0) as subtotal,
      coalesce(round(sum(dv.impuesto_total), 2), 0) as impuestos,
      coalesce(round(sum(dv.total), 2), 0) as total,
      coalesce(sum(dv.cantidad), 0)::bigint as cantidad
    from public.detalle_venta dv
    where dv.id_venta = target_sale_id
  ) totals
  where v.id = target_sale_id;
$function$;

revoke all on function private.recalculate_sale_totals(bigint) from public, anon, authenticated;

create or replace function private.sync_sale_totals_from_line()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  perform private.recalculate_sale_totals(coalesce(new.id_venta, old.id_venta));
  if tg_op = 'UPDATE' and old.id_venta is distinct from new.id_venta then
    perform private.recalculate_sale_totals(old.id_venta);
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

revoke all on function private.sync_sale_totals_from_line() from public, anon, authenticated;

drop trigger if exists trg_sync_sale_totals_from_line on public.detalle_venta;
create trigger trg_sync_sale_totals_from_line
after insert or update or delete on public.detalle_venta
for each row execute function private.sync_sale_totals_from_line();

-- Recalculate existing drafts and completed sales with the same authoritative rules.
update public.detalle_venta set cantidad = cantidad;

create or replace function public.confirmar_venta(
  _id_venta bigint,
  _id_usuario bigint,
  _vuelto numeric,
  _id_tipo_comprobante bigint,
  _serie text,
  _id_sucursal bigint,
  _id_cliente bigint,
  _fecha date,
  _monto_total numeric
)
returns setof public.ventas
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  authoritative_total numeric(14,2);
begin
  perform private.recalculate_sale_totals(_id_venta);
  select v.monto_total into authoritative_total
  from public.ventas v where v.id = _id_venta for update;

  if not found then
    raise exception 'Venta no encontrada o sin permisos';
  end if;
  if abs(authoritative_total - round(coalesce(_monto_total, 0), 2)) > 0.01 then
    raise exception 'El total cambio mientras se editaba la venta. Revise el detalle y cobre nuevamente';
  end if;

  update public.ventas v
  set fecha = coalesce(_fecha, current_date),
      id_usuario = _id_usuario,
      id_sucursal = _id_sucursal,
      id_cliente = _id_cliente,
      vuelto = round(coalesce(_vuelto, 0), 2),
      estado = 'confirmada'
  where v.id = _id_venta;

  update public.detalle_venta dv
  set estado = 'confirmada'
  where dv.id_venta = _id_venta;

  update public.serializacion_comprobantes sc
  set correlativo = sc.correlativo + 1
  where sc.id_tipo_comprobante = _id_tipo_comprobante
    and sc.sucursal_id = _id_sucursal
    and sc.serie = _serie;

  return query select v.* from public.ventas v where v.id = _id_venta;
end;
$function$;

revoke all on function public.confirmar_venta(bigint, bigint, numeric, bigint, text, bigint, bigint, date, numeric) from public, anon;
grant execute on function public.confirmar_venta(bigint, bigint, numeric, bigint, text, bigint, bigint, date, numeric) to authenticated;

create or replace function public.editar_cantidad_detalle_uuid(
  _id uuid,
  _cantidad numeric
) returns table (
  id uuid,
  cantidad numeric,
  subtotal numeric,
  impuesto_total numeric,
  total numeric,
  costo_total numeric,
  ganancia numeric
)
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if _cantidad is null or _cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor que cero';
  end if;

  return query
  update public.detalle_venta dv
  set cantidad = _cantidad
  where dv.public_id = _id
  returning dv.public_id, dv.cantidad, dv.subtotal, dv.impuesto_total,
            dv.total, dv.costo_total, dv.ganancia;

  if not found then
    raise exception 'Detalle de venta no encontrado o sin permisos';
  end if;
end;
$function$;

revoke all on function public.editar_cantidad_detalle_uuid(uuid, numeric) from public, anon;
grant execute on function public.editar_cantidad_detalle_uuid(uuid, numeric) to authenticated;

-- Provider-owned SaaS control plane. Operational gym data remains in the
-- existing POS/CRM tables and is linked through tenants.legacy_empresa_id.
create table public.saas_features (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null unique check (feature_key ~ '^[a-z0-9_]+$'),
  nombre text not null,
  descripcion text,
  created_at timestamptz not null default now()
);

create table public.saas_plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique check (plan_key ~ '^[a-z0-9_]+$'),
  nombre text not null,
  descripcion text,
  stripe_product_id text unique,
  stripe_price_id text unique,
  precio numeric(14,2) not null default 0 check (precio >= 0),
  moneda text not null default 'USD' check (char_length(moneda) = 3),
  intervalo text not null default 'month' check (intervalo in ('month', 'year')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saas_plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.saas_plans(id) on delete cascade,
  feature_id uuid not null references public.saas_features(id) on delete cascade,
  enabled boolean not null default true,
  limits jsonb not null default '{}'::jsonb,
  unique (plan_id, feature_id)
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  legacy_empresa_id bigint unique references public.empresa(id) on delete cascade,
  nombre text not null,
  slug text not null unique,
  estado text not null default 'trialing'
    check (estado in ('trialing', 'active', 'past_due', 'suspended', 'canceled')),
  stripe_customer_id text unique,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'admin', 'staff', 'viewer')),
  estado text not null default 'active' check (estado in ('invited', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table public.tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.saas_plans(id) on delete restrict,
  stripe_subscription_id text unique,
  stripe_price_id text,
  estado text not null default 'incomplete'
    check (estado in ('trialing', 'active', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused')),
  cancel_at_period_end boolean not null default false,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index tenant_one_live_subscription_uidx
on public.tenant_subscriptions (tenant_id)
where estado in ('trialing', 'active', 'past_due', 'unpaid', 'incomplete', 'paused');

create table public.tenant_feature_overrides (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  feature_id uuid not null references public.saas_features(id) on delete cascade,
  enabled boolean not null,
  limits jsonb not null default '{}'::jsonb,
  source text not null default 'manual' check (source in ('manual', 'addon', 'promotion')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, feature_id)
);

create table public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  estado text not null default 'received' check (estado in ('received', 'processed', 'failed')),
  error text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index tenant_memberships_user_tenant_idx
  on public.tenant_memberships (user_id, tenant_id) where estado = 'active';
create index tenant_subscriptions_tenant_status_idx
  on public.tenant_subscriptions (tenant_id, estado, current_period_end desc);
create index tenant_feature_overrides_lookup_idx
  on public.tenant_feature_overrides (tenant_id, feature_id, expires_at);

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
  insert into public.tenants (legacy_empresa_id, nombre, slug, trial_ends_at)
  values (
    new.id,
    coalesce(nullif(new.nombre, ''), 'Organizacion'),
    'org-' || new.public_id::text,
    now() + interval '14 days'
  )
  on conflict (legacy_empresa_id) do update
    set nombre = excluded.nombre,
        updated_at = now()
  returning id into tenant_uuid;

  insert into public.tenant_subscriptions (
    tenant_id, plan_id, estado, current_period_start, current_period_end
  )
  select tenant_uuid, p.id, 'trialing', now(), now() + interval '14 days'
  from public.saas_plans p
  where p.plan_key = 'premium'
    and not exists (
      select 1 from public.tenant_subscriptions s where s.tenant_id = tenant_uuid
    );

  select u.id_auth::uuid into owner_uuid
  from public.usuarios u
  where u.id = new.id_usuario
    and u.id_auth ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

  if owner_uuid is not null then
    insert into public.tenant_memberships (tenant_id, user_id, role, estado)
    values (tenant_uuid, owner_uuid, 'owner', 'active')
    on conflict (tenant_id, user_id) do update
      set role = 'owner', estado = 'active', updated_at = now();
  end if;
  return new;
end;
$function$;

revoke all on function private.ensure_tenant_for_empresa() from public, anon, authenticated;

drop trigger if exists trg_ensure_tenant_for_empresa on public.empresa;
create trigger trg_ensure_tenant_for_empresa
after insert or update of nombre, id_usuario on public.empresa
for each row execute function private.ensure_tenant_for_empresa();

insert into public.tenants (legacy_empresa_id, nombre, slug, trial_ends_at)
select e.id, e.nombre, 'org-' || e.public_id::text, now() + interval '14 days'
from public.empresa e
on conflict (legacy_empresa_id) do update set nombre = excluded.nombre;

insert into public.tenant_memberships (tenant_id, user_id, role, estado)
select
  t.id,
  u.id_auth::uuid,
  case when u.id = e.id_usuario then 'owner' else
    case when lower(coalesce(r.nombre, '')) in ('superadmin', 'administrador', 'admin') then 'admin' else 'staff' end
  end,
  'active'
from public.usuarios u
join public.empresa e on e.id = u.id_empresa
join public.tenants t on t.legacy_empresa_id = e.id
left join public.roles r on r.id = u.id_rol
where u.id_auth ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
on conflict (tenant_id, user_id) do update
set role = excluded.role, estado = 'active', updated_at = now();

insert into public.saas_features (feature_key, nombre, descripcion) values
  ('pos', 'Punto de venta', 'Ventas, caja, productos, inventario y reportes POS'),
  ('crm', 'CRM para gimnasios', 'Miembros, pagos, horarios, personal y asistencias'),
  ('whatsapp_automation', 'Automatizacion WhatsApp', 'Plantillas, colas y automatizaciones de WhatsApp'),
  ('advanced_reports', 'Reportes avanzados', 'Analitica financiera y operativa avanzada')
on conflict (feature_key) do update
set nombre = excluded.nombre, descripcion = excluded.descripcion;

insert into public.saas_plans (plan_key, nombre, descripcion, precio, moneda, intervalo) values
  ('basic', 'Basico', 'Operacion POS esencial', 0, 'USD', 'month'),
  ('growth', 'Crecimiento', 'POS y CRM para operar el gimnasio', 0, 'USD', 'month'),
  ('premium', 'Premium', 'Operacion completa y automatizaciones', 0, 'USD', 'month')
on conflict (plan_key) do update
set nombre = excluded.nombre, descripcion = excluded.descripcion;

insert into public.saas_plan_features (plan_id, feature_id, enabled)
select p.id, f.id, true
from public.saas_plans p
join public.saas_features f on
  (p.plan_key = 'basic' and f.feature_key = 'pos') or
  (p.plan_key = 'growth' and f.feature_key in ('pos', 'crm')) or
  (p.plan_key = 'premium' and f.feature_key in ('pos', 'crm', 'whatsapp_automation', 'advanced_reports'))
on conflict (plan_id, feature_id) do update set enabled = true;

-- Existing customers enter a trial with the complete plan. Stripe becomes the
-- authority as soon as webhook events attach a real subscription.
insert into public.tenant_subscriptions (
  tenant_id, plan_id, estado, current_period_start, current_period_end
)
select t.id, p.id, 'trialing', now(), coalesce(t.trial_ends_at, now() + interval '14 days')
from public.tenants t
cross join public.saas_plans p
where p.plan_key = 'premium'
  and not exists (select 1 from public.tenant_subscriptions s where s.tenant_id = t.id)
on conflict do nothing;

create or replace function private.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select tm.tenant_id
  from public.tenant_memberships tm
  where tm.user_id = (select auth.uid())
    and tm.estado = 'active'
  order by case tm.role when 'owner' then 0 when 'admin' then 1 else 2 end, tm.created_at
  limit 1;
$function$;

revoke all on function private.current_tenant_id() from public, anon, authenticated;

create or replace function private.is_tenant_admin(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = target_tenant_id
      and tm.user_id = (select auth.uid())
      and tm.estado = 'active'
      and tm.role in ('owner', 'admin')
  );
$function$;

revoke all on function private.is_tenant_admin(uuid) from public, anon, authenticated;

create or replace function private.tenant_has_feature(target_tenant_id uuid, requested_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    exists (
      select 1 from public.tenant_memberships tm
      where tm.tenant_id = target_tenant_id
        and tm.user_id = (select auth.uid())
        and tm.estado = 'active'
    )
    and coalesce(
      (
        select o.enabled
        from public.tenant_feature_overrides o
        join public.saas_features f on f.id = o.feature_id
        where o.tenant_id = target_tenant_id
          and f.feature_key = requested_feature
          and (o.expires_at is null or o.expires_at > now())
        limit 1
      ),
      exists (
        select 1
        from public.tenant_subscriptions s
        join public.saas_plan_features pf on pf.plan_id = s.plan_id and pf.enabled
        join public.saas_features f on f.id = pf.feature_id
        where s.tenant_id = target_tenant_id
          and f.feature_key = requested_feature
          and s.estado in ('trialing', 'active')
          and (s.current_period_end is null or s.current_period_end > now())
      ),
      false
    );
$function$;

revoke all on function private.tenant_has_feature(uuid, text) from public, anon, authenticated;

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
  ), feature_access as (
    select f.feature_key,
           (select private.tenant_has_feature((select id from current_tenant), f.feature_key)) as enabled
    from public.saas_features f
  )
  select jsonb_build_object(
    'tenant_id', t.id,
    'name', t.nombre,
    'status', t.estado,
    'features', coalesce(
      (select jsonb_object_agg(feature_key, enabled) from feature_access),
      '{}'::jsonb
    )
  )
  from current_tenant t;
$function$;

revoke all on function public.get_current_tenant_access() from public, anon;
grant execute on function public.get_current_tenant_access() to authenticated;

alter table public.saas_features enable row level security;
alter table public.saas_plans enable row level security;
alter table public.saas_plan_features enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.tenant_feature_overrides enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.platform_admins enable row level security;

grant select on public.saas_features, public.saas_plans, public.saas_plan_features to authenticated;
grant select on public.tenants, public.tenant_memberships,
  public.tenant_subscriptions, public.tenant_feature_overrides to authenticated;
revoke all on public.stripe_webhook_events, public.platform_admins from anon, authenticated;

create policy saas_features_authenticated_read on public.saas_features
for select to authenticated using (true);
create policy saas_plans_authenticated_read on public.saas_plans
for select to authenticated using (activo);
create policy saas_plan_features_authenticated_read on public.saas_plan_features
for select to authenticated using (true);
create policy tenants_member_read on public.tenants
for select to authenticated
using (id = (select private.current_tenant_id()));
create policy tenant_memberships_member_read on public.tenant_memberships
for select to authenticated
using (tenant_id = (select private.current_tenant_id()));
create policy tenant_subscriptions_member_read on public.tenant_subscriptions
for select to authenticated
using (tenant_id = (select private.current_tenant_id()));
create policy tenant_feature_overrides_member_read on public.tenant_feature_overrides
for select to authenticated
using (tenant_id = (select private.current_tenant_id()));

-- Feature checks are enforced in PostgreSQL as restrictive policies, not only
-- hidden in the React navigation. This prevents direct Data API bypasses.
do $feature_policies$
declare
  table_name text;
  pos_tables text[] := array[
    'empresa', 'usuarios', 'sucursales', 'asignacion_sucursal', 'categorias',
    'productos', 'multiprecios', 'almacenes', 'ventas', 'detalle_venta',
    'kardex', 'tipodocumento', 'metodos_pago', 'caja', 'cierrecaja',
    'movimientos_caja', 'impresoras', 'tipo_comprobantes',
    'serializacion_comprobantes', 'mov_stock'
  ];
  crm_tables text[] := array[
    'crm_planes', 'crm_horarios', 'clientes_crm', 'crm_invitaciones',
    'crm_suscripciones', 'crm_pagos', 'crm_asistencias', 'cargos',
    'trabajadores', 'empresa_modulos', 'rol_modulos', 'parametros_sistema',
    'crm_whatsapp_config', 'crm_whatsapp_plantillas',
    'crm_whatsapp_mensajes', 'crm_automatizaciones'
  ];
  whatsapp_tables text[] := array[
    'crm_whatsapp_config', 'crm_whatsapp_plantillas',
    'crm_whatsapp_mensajes', 'crm_automatizaciones'
  ];
begin
  foreach table_name in array pos_tables loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop policy if exists saas_pos_feature_gate on public.%I', table_name);
      execute format(
        'create policy saas_pos_feature_gate on public.%I as restrictive for all to authenticated using ((select private.tenant_has_feature((select private.current_tenant_id()), ''pos''))) with check ((select private.tenant_has_feature((select private.current_tenant_id()), ''pos'')))',
        table_name
      );
    end if;
  end loop;

  foreach table_name in array crm_tables loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop policy if exists saas_crm_feature_gate on public.%I', table_name);
      execute format(
        'create policy saas_crm_feature_gate on public.%I as restrictive for all to authenticated using ((select private.tenant_has_feature((select private.current_tenant_id()), ''crm''))) with check ((select private.tenant_has_feature((select private.current_tenant_id()), ''crm'')))',
        table_name
      );
    end if;
  end loop;

  foreach table_name in array whatsapp_tables loop
    execute format('drop policy if exists saas_whatsapp_feature_gate on public.%I', table_name);
    execute format(
      'create policy saas_whatsapp_feature_gate on public.%I as restrictive for all to authenticated using ((select private.tenant_has_feature((select private.current_tenant_id()), ''whatsapp_automation''))) with check ((select private.tenant_has_feature((select private.current_tenant_id()), ''whatsapp_automation'')))',
      table_name
    );
  end loop;
end
$feature_policies$;

-- Legacy migrations created correct policies on several imported POS tables
-- without enabling RLS itself. Activate it wherever at least one policy exists.
do $enable_rls$
declare
  target record;
begin
  for target in
    select distinct schemaname, tablename
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('alter table %I.%I enable row level security', target.schemaname, target.tablename);
  end loop;
end
$enable_rls$;

-- Tenant IDs are indexed on both the control-plane and legacy company bridge.
-- RLS on operational tables remains company-scoped, preventing cross-tenant access.
create index if not exists tenants_legacy_empresa_idx on public.tenants (legacy_empresa_id);

notify pgrst, 'reload schema';
