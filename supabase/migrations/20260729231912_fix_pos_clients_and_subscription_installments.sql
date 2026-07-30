-- Keep POS customer references on the table the application actually uses.
insert into public.clientes_proveedores (id, nombres, id_empresa, tipo, estado)
select legacy.id, legacy.nombres, legacy.id_empresa, 'cliente', 'activo'
from public.clientes legacy
where not exists (
  select 1 from public.clientes_proveedores customer where customer.id = legacy.id
)
on conflict (id) do nothing;

update public.ventas sale
set id_cliente = null
where sale.id_cliente is not null
  and not exists (
    select 1 from public.clientes_proveedores customer where customer.id = sale.id_cliente
  );

alter table public.ventas
  drop constraint if exists public_ventas_id_cliente_fkey;

alter table public.ventas
  add constraint public_ventas_id_cliente_fkey
  foreign key (id_cliente)
  references public.clientes_proveedores(id)
  on delete set null;

create index if not exists ventas_id_cliente_idx on public.ventas (id_cliente);

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
  v_venta public.ventas%rowtype;
begin
  perform private.recalculate_sale_totals(_id_venta);

  select sale.*
  into v_venta
  from public.ventas sale
  where sale.id = _id_venta
  for update;

  if not found then
    raise exception 'Venta no encontrada o sin permisos';
  end if;

  if abs(v_venta.monto_total - round(coalesce(_monto_total, 0), 2)) > 0.01 then
    raise exception 'El total cambió mientras se editaba la venta. Revisa el detalle y cobra nuevamente';
  end if;

  if _id_cliente is not null and not exists (
    select 1
    from public.clientes_proveedores customer
    where customer.id = _id_cliente
      and customer.id_empresa = v_venta.id_empresa
      and customer.tipo = 'cliente'
  ) then
    raise exception 'El cliente seleccionado no pertenece a esta empresa. Vuelve a seleccionarlo';
  end if;

  update public.ventas sale
  set fecha = coalesce(_fecha, current_date),
      id_usuario = _id_usuario,
      id_sucursal = _id_sucursal,
      id_cliente = _id_cliente,
      vuelto = round(coalesce(_vuelto, 0), 2),
      estado = 'confirmada'
  where sale.id = _id_venta;

  update public.detalle_venta detail
  set estado = 'confirmada'
  where detail.id_venta = _id_venta;

  update public.serializacion_comprobantes serialization
  set correlativo = serialization.correlativo + 1
  where serialization.id_tipo_comprobante = _id_tipo_comprobante
    and serialization.sucursal_id = _id_sucursal
    and serialization.serie = _serie;

  return query select sale.* from public.ventas sale where sale.id = _id_venta;
end;
$function$;

revoke all on function public.confirmar_venta(bigint, bigint, numeric, bigint, text, bigint, bigint, date, numeric)
from public, anon;
grant execute on function public.confirmar_venta(bigint, bigint, numeric, bigint, text, bigint, bigint, date, numeric)
to authenticated;

create or replace function public.confirmar_venta_pos(
  _id_venta bigint,
  _id_usuario bigint,
  _vuelto numeric,
  _id_tipo_comprobante bigint,
  _serie text,
  _id_sucursal bigint,
  _id_cliente bigint,
  _fecha date,
  _monto_total numeric,
  _id_cierre_caja bigint,
  _pagos jsonb
)
returns setof public.ventas
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_venta public.ventas%rowtype;
  v_pago jsonb;
  v_total_recibido numeric(14,2);
begin
  if jsonb_typeof(coalesce(_pagos, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(_pagos, '[]'::jsonb)) = 0 then
    raise exception 'Debes indicar al menos un método de pago';
  end if;

  select sale.*
  into v_venta
  from public.ventas sale
  where sale.id = _id_venta
  for update;

  if not found then
    raise exception 'Venta no encontrada o sin permisos';
  end if;

  perform 1
  from public.cierrecaja closing
  join public.caja cashbox on cashbox.id = closing.id_caja
  where closing.id = _id_cierre_caja
    and closing.estado = 0
    and cashbox.id_sucursal = _id_sucursal;
  if not found then
    raise exception 'La caja seleccionada no está abierta para esta sucursal';
  end if;

  select round(coalesce(sum((entry->>'monto')::numeric), 0), 2)
  into v_total_recibido
  from jsonb_array_elements(_pagos) entry;

  if abs((v_total_recibido - round(coalesce(_vuelto, 0), 2)) - round(coalesce(_monto_total, 0), 2)) > 0.01 then
    raise exception 'La distribución de pagos no coincide con el total de la venta';
  end if;

  if v_venta.estado <> 'confirmada' then
    select confirmed.*
    into v_venta
    from public.confirmar_venta(
      _id_venta,
      _id_usuario,
      _vuelto,
      _id_tipo_comprobante,
      _serie,
      _id_sucursal,
      _id_cliente,
      _fecha,
      _monto_total
    ) confirmed;
  end if;

  if not exists (
    select 1 from public.movimientos_caja movement where movement.id_ventas = _id_venta
  ) then
    for v_pago in select value from jsonb_array_elements(_pagos)
    loop
      if coalesce((v_pago->>'monto')::numeric, 0) <= 0 then
        continue;
      end if;
      if not exists (
        select 1
        from public.metodos_pago method
        where method.id = (v_pago->>'id_metodo_pago')::bigint
          and method.id_empresa = v_venta.id_empresa
      ) then
        raise exception 'Uno de los métodos de pago no pertenece a la empresa';
      end if;

      insert into public.movimientos_caja (
        tipo_movimiento,
        monto,
        id_metodo_pago,
        descripcion,
        id_usuario,
        id_cierre_caja,
        id_ventas,
        vuelto
      ) values (
        'ingreso',
        round((v_pago->>'monto')::numeric, 2),
        (v_pago->>'id_metodo_pago')::bigint,
        format('Pago de venta con %s', coalesce(nullif(v_pago->>'tipo', ''), 'método registrado')),
        _id_usuario,
        _id_cierre_caja,
        _id_venta,
        round(coalesce((v_pago->>'vuelto')::numeric, 0), 2)
      );
    end loop;
  end if;

  return query select sale.* from public.ventas sale where sale.id = _id_venta;
end;
$function$;

revoke all on function public.confirmar_venta_pos(bigint, bigint, numeric, bigint, text, bigint, bigint, date, numeric, bigint, jsonb)
from public, anon;
grant execute on function public.confirmar_venta_pos(bigint, bigint, numeric, bigint, text, bigint, bigint, date, numeric, bigint, jsonb)
to authenticated;

-- Payments explicitly applied to a plan period form its installment ledger.
alter table public.crm_pagos
  add column if not exists aplica_a_saldo_plan boolean not null default false;

update public.crm_pagos payment
set aplica_a_saldo_plan = true
where payment.id_suscripcion is not null
  and payment.estado = 'pagado'
  and payment.periodo_inicio is not null
  and payment.periodo_fin is not null;

create index if not exists crm_pagos_suscripcion_periodo_saldo_idx
  on public.crm_pagos (id_suscripcion, periodo_inicio, periodo_fin, fecha_pago, id)
  where estado = 'pagado' and aplica_a_saldo_plan;

create or replace view public.crm_suscripciones_saldos
with (security_invoker = true)
as
select
  subscription.id,
  subscription.id_empresa,
  subscription.id_cliente_crm,
  subscription.id_plan,
  subscription.fecha_inicio as periodo_inicio,
  subscription.fecha_fin as periodo_fin,
  round(coalesce(subscription.precio_pactado, plan.precio, 0), 2)::numeric(12,2) as total_plan,
  least(
    round(coalesce(subscription.precio_pactado, plan.precio, 0), 2),
    round(coalesce(sum(payment.monto) filter (
      where payment.estado = 'pagado'
        and payment.aplica_a_saldo_plan
        and payment.periodo_inicio = subscription.fecha_inicio
        and payment.periodo_fin = subscription.fecha_fin
    ), 0), 2)
  )::numeric(12,2) as abonado_periodo,
  greatest(
    round(coalesce(subscription.precio_pactado, plan.precio, 0), 2)
      - round(coalesce(sum(payment.monto) filter (
        where payment.estado = 'pagado'
          and payment.aplica_a_saldo_plan
          and payment.periodo_inicio = subscription.fecha_inicio
          and payment.periodo_fin = subscription.fecha_fin
      ), 0), 2),
    0
  )::numeric(12,2) as saldo_pendiente,
  case
    when round(coalesce(subscription.precio_pactado, plan.precio, 0), 2) <= 0 then 'pagado'
    when coalesce(sum(payment.monto) filter (
      where payment.estado = 'pagado'
        and payment.aplica_a_saldo_plan
        and payment.periodo_inicio = subscription.fecha_inicio
        and payment.periodo_fin = subscription.fecha_fin
    ), 0) <= 0 then 'pendiente'
    when coalesce(sum(payment.monto) filter (
      where payment.estado = 'pagado'
        and payment.aplica_a_saldo_plan
        and payment.periodo_inicio = subscription.fecha_inicio
        and payment.periodo_fin = subscription.fecha_fin
    ), 0) < round(coalesce(subscription.precio_pactado, plan.precio, 0), 2) then 'parcial'
    else 'pagado'
  end as estado_pago
from public.crm_suscripciones subscription
join public.crm_planes plan
  on plan.id = subscription.id_plan
 and plan.id_empresa = subscription.id_empresa
left join public.crm_pagos payment
  on payment.id_suscripcion = subscription.id
 and payment.id_empresa = subscription.id_empresa
group by subscription.id, plan.precio;

revoke all on public.crm_suscripciones_saldos from public, anon;
grant select on public.crm_suscripciones_saldos to authenticated;

create or replace function public.crm_abonar_suscripcion_pos(
  p_id_suscripcion bigint,
  p_monto_abono numeric,
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
  v_usuario_id bigint := (select private.current_usuario_id());
  v_cliente public.clientes_crm%rowtype;
  v_suscripcion public.crm_suscripciones%rowtype;
  v_plan public.crm_planes%rowtype;
  v_pago public.crm_pagos%rowtype;
  v_moneda text;
  v_metodo text := lower(nullif(trim(coalesce(p_metodo_pago, '')), ''));
  v_total numeric(12,2);
  v_abonado_anterior numeric(12,2);
  v_abono numeric(12,2) := round(coalesce(p_monto_abono, 0), 2);
  v_saldo_anterior numeric(12,2);
  v_saldo_nuevo numeric(12,2);
  v_recibido numeric(12,2);
  v_cambio numeric(12,2) := 0;
begin
  if v_empresa_id is null or v_usuario_id is null then
    raise exception 'No se pudo identificar la empresa o el usuario';
  end if;
  if v_abono <= 0 then
    raise exception 'El abono debe ser mayor que cero';
  end if;
  if v_metodo not in ('efectivo', 'transferencia', 'tarjeta', 'deposito', 'otro') then
    raise exception 'Selecciona un método de pago válido';
  end if;
  if v_metodo in ('transferencia', 'deposito')
    and nullif(trim(p_referencia_pago), '') is null then
    raise exception 'La transferencia o depósito requiere número de referencia';
  end if;

  select *
  into v_suscripcion
  from public.crm_suscripciones subscription
  where subscription.id = p_id_suscripcion
    and subscription.id_empresa = v_empresa_id
  for update;

  if not found then
    raise exception 'La suscripción no pertenece a la empresa actual';
  end if;
  if v_suscripcion.estado = 'cancelada' then
    raise exception 'No se puede abonar a una suscripción cancelada';
  end if;

  select * into v_cliente
  from public.clientes_crm client
  where client.id = v_suscripcion.id_cliente_crm
    and client.id_empresa = v_empresa_id;
  if not found then
    raise exception 'No se encontró el cliente de la suscripción';
  end if;

  select * into v_plan
  from public.crm_planes plan
  where plan.id = v_suscripcion.id_plan
    and plan.id_empresa = v_empresa_id;
  if not found then
    raise exception 'No se encontró el plan de la suscripción';
  end if;

  v_total := round(coalesce(v_suscripcion.precio_pactado, v_plan.precio, 0), 2);
  select round(coalesce(sum(payment.monto), 0), 2)
  into v_abonado_anterior
  from public.crm_pagos payment
  where payment.id_empresa = v_empresa_id
    and payment.id_suscripcion = v_suscripcion.id
    and payment.periodo_inicio = v_suscripcion.fecha_inicio
    and payment.periodo_fin = v_suscripcion.fecha_fin
    and payment.estado = 'pagado'
    and payment.aplica_a_saldo_plan;

  v_saldo_anterior := greatest(v_total - v_abonado_anterior, 0);
  if v_saldo_anterior <= 0 then
    raise exception 'Este período del plan ya está pagado por completo';
  end if;
  if v_abono > v_saldo_anterior then
    raise exception 'El abono excede el saldo pendiente de %', v_saldo_anterior;
  end if;

  v_recibido := case
    when v_metodo = 'efectivo' then round(coalesce(p_monto_recibido, v_abono), 2)
    else v_abono
  end;
  if v_metodo = 'efectivo' and v_recibido < v_abono then
    raise exception 'El efectivo recibido no cubre el abono';
  end if;
  if v_metodo = 'efectivo' then
    v_cambio := v_recibido - v_abono;
  end if;

  select coalesce(currency, 'USD')
  into v_moneda
  from public.empresa
  where id = v_empresa_id;

  insert into public.crm_pagos (
    id_empresa, id_cliente_crm, id_suscripcion, monto, monto_recibido, cambio,
    moneda, metodo_pago, referencia_pago, fecha_pago, fecha_vencimiento,
    periodo_inicio, periodo_fin, estado, registrado_por, notas, aplica_a_saldo_plan
  ) values (
    v_empresa_id, v_cliente.id, v_suscripcion.id, v_abono, v_recibido, v_cambio,
    coalesce(v_moneda, 'USD'), initcap(v_metodo), nullif(trim(p_referencia_pago), ''), now(),
    v_suscripcion.fecha_fin, v_suscripcion.fecha_inicio, v_suscripcion.fecha_fin,
    'pagado', v_usuario_id, nullif(trim(p_notas), ''), true
  )
  returning * into v_pago;

  update public.crm_pagos payment
  set referencia = format(
    'FAC-%s-%s-%s',
    v_empresa_id,
    to_char(v_pago.fecha_pago, 'YYYY'),
    lpad(v_pago.id::text, 6, '0')
  )
  where payment.id = v_pago.id
  returning * into v_pago;

  v_saldo_nuevo := greatest(v_saldo_anterior - v_abono, 0);

  return jsonb_build_object(
    'cliente', to_jsonb(v_cliente),
    'plan', to_jsonb(v_plan),
    'suscripcion', to_jsonb(v_suscripcion),
    'pago', to_jsonb(v_pago),
    'comprobante_id', concat('P-', v_pago.id),
    'total_plan', v_total,
    'abonado_anterior', v_abonado_anterior,
    'abono_actual', v_abono,
    'abonado_acumulado', least(v_abonado_anterior + v_abono, v_total),
    'saldo_pendiente', v_saldo_nuevo,
    'estado_pago', case when v_saldo_nuevo = 0 then 'pagado' else 'parcial' end
  );
end;
$function$;

revoke all on function public.crm_abonar_suscripcion_pos(bigint, numeric, text, numeric, text, text)
from public, anon;
grant execute on function public.crm_abonar_suscripcion_pos(bigint, numeric, text, numeric, text, text)
to authenticated;

-- Expose current-plan balance in the client directory.
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
  subscription.id as id_suscripcion,
  subscription.id_plan,
  subscription.estado as estado_suscripcion,
  subscription.fecha_inicio,
  subscription.fecha_fin,
  subscription.precio_pactado,
  plan.nombre as plan_nombre,
  plan.periodicidad as plan_periodicidad,
  plan.duracion_dias as plan_duracion_dias,
  schedule.nombre as horario_nombre,
  coalesce(overdue.saldo_vencido, 0) as saldo_vencido,
  coalesce(overdue.pagos_pendientes, 0) as pagos_pendientes,
  last_payment.ultimo_pago_at,
  last_payment.ultimo_pago_monto,
  case
    when c.estado in ('inactivo', 'suspendido') then 'inactiva'
    when coalesce(overdue.saldo_vencido, 0) > 0
      or subscription.estado = 'vencida'
      or (subscription.estado = 'activa' and subscription.fecha_fin < current_date
          and coalesce(balance.saldo_pendiente, subscription.precio_pactado, 0) > 0) then 'moroso'
    when subscription.id is null then 'sin_suscripcion'
    when subscription.estado <> 'activa' then 'inactiva'
    when coalesce(balance.estado_pago, 'pendiente') = 'parcial' then 'pago_parcial'
    when coalesce(balance.estado_pago, 'pendiente') = 'pendiente' then 'pendiente_pago'
    when subscription.fecha_fin <= current_date + 7 then 'por_vencer'
    else 'al_dia'
  end as estado_financiero,
  case when subscription.id is not null then subscription.fecha_fin - current_date else null end as dias_para_vencer,
  lower(concat_ws(' ', c.codigo, c.nombres, c.apellidos, c.email, c.telefono, plan.nombre)) as busqueda,
  coalesce(balance.total_plan, subscription.precio_pactado, plan.precio, 0)::numeric(12,2) as total_plan,
  coalesce(balance.abonado_periodo, 0)::numeric(12,2) as abonado_plan,
  coalesce(balance.saldo_pendiente, subscription.precio_pactado, plan.precio, 0)::numeric(12,2) as saldo_plan,
  coalesce(balance.estado_pago, case when subscription.id is null then null else 'pendiente' end) as estado_pago_plan
from public.clientes_crm c
left join lateral (
  select candidate.*
  from public.crm_suscripciones candidate
  where candidate.id_empresa = c.id_empresa
    and candidate.id_cliente_crm = c.id
  order by
    case candidate.estado when 'activa' then 0 when 'pausada' then 1 when 'vencida' then 2 else 3 end,
    candidate.fecha_fin desc,
    candidate.id desc
  limit 1
) subscription on true
left join public.crm_planes plan on plan.id = subscription.id_plan
left join public.crm_horarios schedule on schedule.id = c.id_horario
left join public.crm_suscripciones_saldos balance on balance.id = subscription.id
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
) overdue on true
left join lateral (
  select payment.fecha_pago as ultimo_pago_at, payment.monto as ultimo_pago_monto
  from public.crm_pagos payment
  where payment.id_empresa = c.id_empresa
    and payment.id_cliente_crm = c.id
    and payment.estado = 'pagado'
  order by payment.fecha_pago desc nulls last, payment.created_at desc, payment.id desc
  limit 1
) last_payment on true;

revoke all on public.crm_clientes_directorio from public, anon;
grant select on public.crm_clientes_directorio to authenticated;

-- Append the balance snapshot that was true immediately after every receipt.
create or replace view public.crm_historial_cobros
with (security_invoker = true)
as
select
  concat('P-', payment.id) as id,
  'pago'::text as origen,
  payment.id as id_origen,
  payment.id_empresa,
  payment.id_cliente_crm,
  payment.id_suscripcion,
  payment.referencia,
  payment.monto,
  payment.monto_recibido,
  payment.cambio,
  payment.moneda,
  payment.metodo_pago,
  payment.referencia_pago,
  payment.fecha_pago,
  payment.fecha_vencimiento,
  payment.periodo_inicio,
  payment.periodo_fin,
  payment.estado,
  payment.notas,
  client.nombres as cliente_nombres,
  client.apellidos as cliente_apellidos,
  client.email as cliente_email,
  client.telefono as cliente_telefono,
  client.direccion as cliente_direccion,
  client.identificador_fiscal as cliente_identificador_fiscal,
  client.identificador_nacional as cliente_identificador_nacional,
  plan.nombre as plan_nombre,
  plan.descripcion as plan_descripcion,
  subscription.fecha_inicio as suscripcion_inicio,
  subscription.fecha_fin as suscripcion_fin,
  lower(concat_ws(' ', payment.referencia, payment.referencia_pago, client.nombres, client.apellidos, client.email, plan.nombre)) as busqueda,
  case when payment.aplica_a_saldo_plan then coalesce(subscription.precio_pactado, plan.precio, 0) else null end::numeric(12,2) as total_plan,
  case when payment.aplica_a_saldo_plan then least(
    coalesce(subscription.precio_pactado, plan.precio, 0),
    coalesce((
      select sum(previous.monto)
      from public.crm_pagos previous
      where previous.id_empresa = payment.id_empresa
        and previous.id_suscripcion = payment.id_suscripcion
        and previous.periodo_inicio = payment.periodo_inicio
        and previous.periodo_fin = payment.periodo_fin
        and previous.estado = 'pagado'
        and previous.aplica_a_saldo_plan
        and (previous.fecha_pago, previous.id) <= (payment.fecha_pago, payment.id)
    ), 0)
  ) else null end::numeric(12,2) as abonado_acumulado,
  case when payment.aplica_a_saldo_plan then greatest(
    coalesce(subscription.precio_pactado, plan.precio, 0) - coalesce((
      select sum(previous.monto)
      from public.crm_pagos previous
      where previous.id_empresa = payment.id_empresa
        and previous.id_suscripcion = payment.id_suscripcion
        and previous.periodo_inicio = payment.periodo_inicio
        and previous.periodo_fin = payment.periodo_fin
        and previous.estado = 'pagado'
        and previous.aplica_a_saldo_plan
        and (previous.fecha_pago, previous.id) <= (payment.fecha_pago, payment.id)
    ), 0),
    0
  ) else null end::numeric(12,2) as saldo_pendiente,
  payment.aplica_a_saldo_plan
from public.crm_pagos payment
join public.clientes_crm client on client.id = payment.id_cliente_crm
left join public.crm_suscripciones subscription on subscription.id = payment.id_suscripcion
left join public.crm_planes plan on plan.id = subscription.id_plan
where payment.estado = 'pagado'
  and coalesce(payment.referencia_pago, '') not like 'REC-MORA-%'
union all
select
  concat('R-', receipt.id) as id,
  'recibo_mora'::text as origen,
  receipt.id as id_origen,
  receipt.id_empresa,
  receipt.id_cliente_crm,
  receipt.id_suscripcion,
  receipt.referencia,
  receipt.monto,
  receipt.monto_recibido,
  receipt.cambio,
  receipt.moneda,
  receipt.metodo_pago,
  receipt.referencia_pago,
  receipt.fecha_pago,
  receipt.fecha_pago::date as fecha_vencimiento,
  subscription.fecha_inicio as periodo_inicio,
  subscription.fecha_fin as periodo_fin,
  'pagado'::text as estado,
  receipt.notas,
  client.nombres as cliente_nombres,
  client.apellidos as cliente_apellidos,
  client.email as cliente_email,
  client.telefono as cliente_telefono,
  client.direccion as cliente_direccion,
  client.identificador_fiscal as cliente_identificador_fiscal,
  client.identificador_nacional as cliente_identificador_nacional,
  plan.nombre as plan_nombre,
  plan.descripcion as plan_descripcion,
  subscription.fecha_inicio as suscripcion_inicio,
  subscription.fecha_fin as suscripcion_fin,
  lower(concat_ws(' ', receipt.referencia, receipt.referencia_pago, client.nombres, client.apellidos, client.email, plan.nombre)) as busqueda,
  null::numeric(12,2) as total_plan,
  null::numeric(12,2) as abonado_acumulado,
  null::numeric(12,2) as saldo_pendiente,
  false as aplica_a_saldo_plan
from public.crm_comprobantes_cobro receipt
join public.clientes_crm client on client.id = receipt.id_cliente_crm
left join public.crm_suscripciones subscription on subscription.id = receipt.id_suscripcion
left join public.crm_planes plan on plan.id = subscription.id_plan;

revoke all on public.crm_historial_cobros from public, anon;
grant select on public.crm_historial_cobros to authenticated;
