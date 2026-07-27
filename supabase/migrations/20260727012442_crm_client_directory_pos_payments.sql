-- Operational customer directory and POS-style CRM billing.
-- The directory is intentionally a server-filtered view so the Clients module
-- can show membership and collection health without duplicating logic in React.

alter table public.crm_pagos
  add column if not exists monto_recibido numeric(12,2),
  add column if not exists cambio numeric(12,2) not null default 0,
  add column if not exists referencia_pago text;

alter table public.crm_pagos
  drop constraint if exists crm_pagos_monto_recibido_check,
  add constraint crm_pagos_monto_recibido_check
    check (monto_recibido is null or monto_recibido >= 0),
  drop constraint if exists crm_pagos_cambio_check,
  add constraint crm_pagos_cambio_check
    check (cambio >= 0);

update public.crm_pagos
set monto_recibido = monto
where monto_recibido is null
  and estado = 'pagado';

create index if not exists crm_pagos_empresa_cliente_estado_vencimiento_idx
  on public.crm_pagos (id_empresa, id_cliente_crm, estado, fecha_vencimiento);

create index if not exists crm_pagos_empresa_fecha_pago_idx
  on public.crm_pagos (id_empresa, fecha_pago desc)
  where estado = 'pagado';

create or replace view public.crm_clientes_directorio
with (security_invoker = true)
as
select
  c.id,
  c.public_id,
  c.id_empresa,
  c.codigo,
  c.id_cliente_proveedor,
  c.id_auth,
  c.nombres,
  c.apellidos,
  c.email,
  c.telefono,
  c.direccion,
  c.identificador_nacional,
  c.identificador_fiscal,
  c.estado as estado_cliente,
  c.origen,
  c.id_horario,
  c.created_at,
  c.updated_at,
  s.id as id_suscripcion,
  s.id_plan,
  s.estado as estado_suscripcion,
  s.fecha_inicio,
  s.fecha_fin,
  s.precio_pactado,
  plan.nombre as plan_nombre,
  plan.periodicidad as plan_periodicidad,
  plan.duracion_dias as plan_duracion_dias,
  horario.nombre as horario_nombre,
  coalesce(deuda.saldo_vencido, 0) as saldo_vencido,
  coalesce(deuda.pagos_pendientes, 0) as pagos_pendientes,
  pago.ultimo_pago_at,
  pago.ultimo_pago_monto,
  case
    when c.estado in ('inactivo', 'suspendido') then 'inactiva'
    when coalesce(deuda.saldo_vencido, 0) > 0
      or s.estado = 'vencida'
      or (s.estado = 'activa' and s.fecha_fin < current_date) then 'moroso'
    when s.id is null then 'sin_suscripcion'
    when s.estado <> 'activa' then 'inactiva'
    when s.fecha_fin <= current_date + 7 then 'por_vencer'
    else 'al_dia'
  end as estado_financiero,
  case
    when s.id is not null then s.fecha_fin - current_date
    else null
  end as dias_para_vencer,
  lower(concat_ws(' ', c.codigo, c.nombres, c.apellidos, c.email, c.telefono, plan.nombre)) as busqueda
from public.clientes_crm c
left join lateral (
  select subscription.*
  from public.crm_suscripciones subscription
  where subscription.id_empresa = c.id_empresa
    and subscription.id_cliente_crm = c.id
  order by
    case subscription.estado
      when 'activa' then 0
      when 'pausada' then 1
      when 'vencida' then 2
      else 3
    end,
    subscription.fecha_fin desc,
    subscription.id desc
  limit 1
) s on true
left join public.crm_planes plan on plan.id = s.id_plan
left join public.crm_horarios horario on horario.id = c.id_horario
left join lateral (
  select
    coalesce(sum(payment.monto) filter (
      where payment.estado = 'vencido'
        or (payment.estado = 'pendiente' and payment.fecha_vencimiento < current_date)
    ), 0) as saldo_vencido,
    count(*) filter (
      where payment.estado = 'vencido'
        or (payment.estado = 'pendiente' and payment.fecha_vencimiento < current_date)
    ) as pagos_pendientes
  from public.crm_pagos payment
  where payment.id_empresa = c.id_empresa
    and payment.id_cliente_crm = c.id
) deuda on true
left join lateral (
  select payment.fecha_pago as ultimo_pago_at, payment.monto as ultimo_pago_monto
  from public.crm_pagos payment
  where payment.id_empresa = c.id_empresa
    and payment.id_cliente_crm = c.id
    and payment.estado = 'pagado'
  order by payment.fecha_pago desc nulls last, payment.created_at desc, payment.id desc
  limit 1
) pago on true;

revoke all on public.crm_clientes_directorio from public, anon;
grant select on public.crm_clientes_directorio to authenticated;

create or replace function public.crm_registrar_pago_pos(
  p_id_cliente_crm bigint,
  p_id_suscripcion bigint default null,
  p_monto numeric default null,
  p_metodo_pago text default 'efectivo',
  p_monto_recibido numeric default null,
  p_referencia_pago text default null,
  p_fecha_vencimiento date default null,
  p_notas text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_empresa_id bigint := (select private.current_empresa_id());
  v_usuario_id bigint := (select private.current_usuario_id());
  v_cliente public.clientes_crm%rowtype;
  v_suscripcion public.crm_suscripciones%rowtype;
  v_plan public.crm_planes%rowtype;
  v_pago public.crm_pagos%rowtype;
  v_moneda text;
  v_metodo text := lower(nullif(trim(coalesce(p_metodo_pago, '')), ''));
  v_monto numeric(12,2) := round(coalesce(p_monto, 0), 2);
  v_recibido numeric(12,2);
  v_cambio numeric(12,2) := 0;
begin
  if v_empresa_id is null or v_usuario_id is null then
    raise exception 'No se pudo identificar la empresa o el usuario';
  end if;
  if v_monto <= 0 then
    raise exception 'El monto a cobrar debe ser mayor que cero';
  end if;
  if v_metodo not in ('efectivo', 'transferencia', 'tarjeta', 'deposito', 'otro') then
    raise exception 'Selecciona un método de pago válido';
  end if;
  if v_metodo in ('transferencia', 'deposito')
    and nullif(trim(p_referencia_pago), '') is null then
    raise exception 'La transferencia o depósito requiere número de referencia';
  end if;

  select * into v_cliente
  from public.clientes_crm client
  where client.id = p_id_cliente_crm
    and client.id_empresa = v_empresa_id;
  if not found then
    raise exception 'El cliente no pertenece a la empresa actual';
  end if;

  if p_id_suscripcion is not null then
    select * into v_suscripcion
    from public.crm_suscripciones subscription
    where subscription.id = p_id_suscripcion
      and subscription.id_empresa = v_empresa_id
      and subscription.id_cliente_crm = v_cliente.id;
    if not found then
      raise exception 'La suscripción no pertenece al cliente';
    end if;
    select * into v_plan
    from public.crm_planes plan
    where plan.id = v_suscripcion.id_plan
      and plan.id_empresa = v_empresa_id;
  end if;

  v_recibido := case
    when v_metodo = 'efectivo' then round(coalesce(p_monto_recibido, v_monto), 2)
    else v_monto
  end;
  if v_metodo = 'efectivo' and v_recibido < v_monto then
    raise exception 'El efectivo recibido no cubre el total de la factura';
  end if;
  if v_metodo = 'efectivo' then
    v_cambio := v_recibido - v_monto;
  end if;

  select coalesce(currency, 'USD') into v_moneda
  from public.empresa where id = v_empresa_id;

  insert into public.crm_pagos (
    id_empresa, id_cliente_crm, id_suscripcion, monto, monto_recibido, cambio,
    moneda, metodo_pago, referencia_pago, fecha_pago, fecha_vencimiento,
    periodo_inicio, periodo_fin, estado, registrado_por, notas
  ) values (
    v_empresa_id, v_cliente.id, v_suscripcion.id, v_monto, v_recibido, v_cambio,
    coalesce(v_moneda, 'USD'), initcap(v_metodo), nullif(trim(p_referencia_pago), ''), now(),
    coalesce(p_fecha_vencimiento, v_suscripcion.fecha_fin),
    v_suscripcion.fecha_inicio, v_suscripcion.fecha_fin,
    'pagado', v_usuario_id, nullif(trim(p_notas), '')
  ) returning * into v_pago;

  update public.crm_pagos
  set referencia = format(
    'FAC-%s-%s-%s', v_empresa_id,
    to_char(v_pago.fecha_pago, 'YYYY'), lpad(v_pago.id::text, 6, '0')
  )
  where id = v_pago.id
  returning * into v_pago;

  return jsonb_build_object(
    'cliente', to_jsonb(v_cliente),
    'plan', to_jsonb(v_plan),
    'suscripcion', case when v_suscripcion.id is null then null else to_jsonb(v_suscripcion) end,
    'pago', to_jsonb(v_pago)
  );
end;
$function$;

revoke all on function public.crm_registrar_pago_pos(bigint, bigint, numeric, text, numeric, text, date, text)
from public, anon;
grant execute on function public.crm_registrar_pago_pos(bigint, bigint, numeric, text, numeric, text, date, text)
to authenticated;

create or replace function public.crm_cobrar_suscripcion_pos(
  p_id_suscripcion bigint,
  p_metodo_pago text default 'efectivo',
  p_monto_recibido numeric default null,
  p_referencia_pago text default null,
  p_notas text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_empresa_id bigint := (select private.current_empresa_id());
  v_suscripcion public.crm_suscripciones%rowtype;
begin
  if v_empresa_id is null then
    raise exception 'No se pudo identificar la empresa del usuario';
  end if;
  select * into v_suscripcion
  from public.crm_suscripciones subscription
  where subscription.id = p_id_suscripcion
    and subscription.id_empresa = v_empresa_id;
  if not found then
    raise exception 'La suscripción no pertenece a la empresa actual';
  end if;
  if v_suscripcion.estado = 'cancelada' then
    raise exception 'No se puede facturar una suscripción cancelada';
  end if;

  return public.crm_registrar_pago_pos(
    v_suscripcion.id_cliente_crm,
    v_suscripcion.id,
    v_suscripcion.precio_pactado,
    p_metodo_pago,
    p_monto_recibido,
    p_referencia_pago,
    v_suscripcion.fecha_fin,
    p_notas
  );
end;
$function$;

revoke all on function public.crm_cobrar_suscripcion_pos(bigint, text, numeric, text, text)
from public, anon;
grant execute on function public.crm_cobrar_suscripcion_pos(bigint, text, numeric, text, text)
to authenticated;

create or replace function public.crm_reporte_ingresos_mensuales(
  p_mes date default date_trunc('month', current_date)::date
)
returns table(
  metodo_pago text,
  cantidad_pagos bigint,
  total_ingresos numeric,
  total_recibido numeric,
  total_vuelto numeric
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_empresa_id bigint := (select private.current_empresa_id());
  v_mes date := date_trunc('month', coalesce(p_mes, current_date))::date;
begin
  if v_empresa_id is null then
    raise exception 'No se pudo identificar la empresa del usuario';
  end if;
  return query
  select
    coalesce(nullif(payment.metodo_pago, ''), 'Sin especificar') as metodo_pago,
    count(*)::bigint as cantidad_pagos,
    coalesce(sum(payment.monto), 0) as total_ingresos,
    coalesce(sum(payment.monto_recibido), sum(payment.monto), 0) as total_recibido,
    coalesce(sum(payment.cambio), 0) as total_vuelto
  from public.crm_pagos payment
  where payment.id_empresa = v_empresa_id
    and payment.estado = 'pagado'
    and date_trunc('month', coalesce(payment.fecha_pago, payment.created_at))::date = v_mes
  group by coalesce(nullif(payment.metodo_pago, ''), 'Sin especificar')
  order by total_ingresos desc, metodo_pago asc;
end;
$function$;

revoke all on function public.crm_reporte_ingresos_mensuales(date)
from public, anon;
grant execute on function public.crm_reporte_ingresos_mensuales(date)
to authenticated;
