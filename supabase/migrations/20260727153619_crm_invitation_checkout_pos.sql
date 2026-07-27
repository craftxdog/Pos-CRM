-- Atomic checkout actions for the CRM. Renewals only become active after a
-- payment is recorded, and delinquent balances are settled without producing
-- duplicate revenue rows.

create or replace function public.crm_renovar_suscripcion_pos(
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
  v_usuario_id bigint := (select private.current_usuario_id());
  v_suscripcion public.crm_suscripciones%rowtype;
  v_anterior public.crm_suscripciones%rowtype;
  v_cliente public.clientes_crm%rowtype;
  v_plan public.crm_planes%rowtype;
  v_pago public.crm_pagos%rowtype;
  v_moneda text;
  v_metodo text := lower(nullif(trim(coalesce(p_metodo_pago, '')), ''));
  v_monto numeric(12,2);
  v_recibido numeric(12,2);
  v_cambio numeric(12,2) := 0;
  v_inicio date;
  v_fin date;
begin
  if v_empresa_id is null or v_usuario_id is null then
    raise exception 'No se pudo identificar la empresa o el usuario';
  end if;
  if v_metodo not in ('efectivo', 'transferencia', 'tarjeta', 'deposito', 'otro') then
    raise exception 'Selecciona un método de pago válido';
  end if;
  if v_metodo in ('transferencia', 'deposito')
    and nullif(trim(p_referencia_pago), '') is null then
    raise exception 'La transferencia o depósito requiere número de referencia';
  end if;

  select * into v_suscripcion
  from public.crm_suscripciones subscription
  where subscription.id = p_id_suscripcion
    and subscription.id_empresa = v_empresa_id
  for update;
  if not found then
    raise exception 'No se encontró la suscripción';
  end if;
  if v_suscripcion.estado = 'cancelada' then
    raise exception 'No se puede renovar una suscripción cancelada';
  end if;
  v_anterior := v_suscripcion;

  select * into v_cliente
  from public.clientes_crm client
  where client.id = v_suscripcion.id_cliente_crm
    and client.id_empresa = v_empresa_id;
  select * into v_plan
  from public.crm_planes plan
  where plan.id = v_suscripcion.id_plan
    and plan.id_empresa = v_empresa_id;
  if not found then
    raise exception 'El plan asociado ya no existe';
  end if;

  v_monto := round(coalesce(v_suscripcion.precio_pactado, v_plan.precio, 0), 2);
  if v_monto <= 0 then
    raise exception 'El plan no tiene un precio válido para renovar';
  end if;
  v_recibido := case when v_metodo = 'efectivo'
    then round(coalesce(p_monto_recibido, v_monto), 2) else v_monto end;
  if v_metodo = 'efectivo' and v_recibido < v_monto then
    raise exception 'El efectivo recibido no cubre el total de la renovación';
  end if;
  if v_metodo = 'efectivo' then v_cambio := v_recibido - v_monto; end if;

  v_inicio := case
    when v_suscripcion.fecha_fin >= current_date then v_suscripcion.fecha_fin + 1
    else current_date
  end;
  v_fin := v_inicio + (v_plan.duracion_dias - 1);

  update public.crm_suscripciones
  set fecha_inicio = v_inicio,
      fecha_fin = v_fin,
      precio_pactado = v_monto,
      estado = 'activa'
  where id = v_suscripcion.id
  returning * into v_suscripcion;

  select coalesce(currency, 'USD') into v_moneda
  from public.empresa where id = v_empresa_id;
  insert into public.crm_pagos (
    id_empresa, id_cliente_crm, id_suscripcion, monto, monto_recibido, cambio,
    moneda, metodo_pago, referencia_pago, fecha_pago, fecha_vencimiento,
    periodo_inicio, periodo_fin, estado, registrado_por, notas
  ) values (
    v_empresa_id, v_cliente.id, v_suscripcion.id, v_monto, v_recibido, v_cambio,
    coalesce(v_moneda, 'USD'), initcap(v_metodo), nullif(trim(p_referencia_pago), ''), now(), v_fin,
    v_inicio, v_fin, 'pagado', v_usuario_id,
    coalesce(nullif(trim(p_notas), ''), 'Renovación de suscripción')
  ) returning * into v_pago;
  update public.crm_pagos
  set referencia = coalesce(referencia, format('FAC-%s-%s-%s', v_empresa_id, to_char(v_pago.fecha_pago, 'YYYY'), lpad(v_pago.id::text, 6, '0')))
  where id = v_pago.id
  returning * into v_pago;

  insert into public.crm_suscripcion_historial (
    id_empresa, id_suscripcion, accion, id_plan_anterior, id_plan_nuevo,
    fecha_inicio_anterior, fecha_fin_anterior, fecha_inicio_nueva, fecha_fin_nueva,
    estado_anterior, estado_nuevo, registrado_por
  ) values (
    v_empresa_id, v_suscripcion.id, 'renovada', v_anterior.id_plan, v_suscripcion.id_plan,
    v_anterior.fecha_inicio, v_anterior.fecha_fin, v_suscripcion.fecha_inicio, v_suscripcion.fecha_fin,
    v_anterior.estado, v_suscripcion.estado, v_usuario_id
  );

  return jsonb_build_object(
    'cliente', to_jsonb(v_cliente), 'plan', to_jsonb(v_plan),
    'suscripcion', to_jsonb(v_suscripcion), 'pago', to_jsonb(v_pago)
  );
end;
$function$;

revoke all on function public.crm_renovar_suscripcion_pos(bigint, text, numeric, text, text) from public, anon;
grant execute on function public.crm_renovar_suscripcion_pos(bigint, text, numeric, text, text) to authenticated;

create or replace function public.crm_cobrar_mora_pos(
  p_id_cliente_crm bigint,
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
  v_plan public.crm_planes%rowtype;
  v_suscripcion public.crm_suscripciones%rowtype;
  v_moneda text;
  v_metodo text := lower(nullif(trim(coalesce(p_metodo_pago, '')), ''));
  v_total numeric(12,2);
  v_recibido numeric(12,2);
  v_cambio numeric(12,2) := 0;
  v_facturas integer;
  v_referencia text;
  v_pago jsonb;
begin
  if v_empresa_id is null or v_usuario_id is null then
    raise exception 'No se pudo identificar la empresa o el usuario';
  end if;
  if v_metodo not in ('efectivo', 'transferencia', 'tarjeta', 'deposito', 'otro') then
    raise exception 'Selecciona un método de pago válido';
  end if;
  if v_metodo in ('transferencia', 'deposito') and nullif(trim(p_referencia_pago), '') is null then
    raise exception 'La transferencia o depósito requiere número de referencia';
  end if;
  select * into v_cliente from public.clientes_crm client
  where client.id = p_id_cliente_crm and client.id_empresa = v_empresa_id;
  if not found then raise exception 'El cliente no pertenece a la empresa actual'; end if;

  perform 1
  from public.crm_pagos payment
  where payment.id_empresa = v_empresa_id and payment.id_cliente_crm = v_cliente.id
    and (payment.estado = 'vencido' or (payment.estado = 'pendiente' and payment.fecha_vencimiento < current_date))
  for update;
  select coalesce(sum(payment.monto), 0)::numeric(12,2), count(*)::integer
  into v_total, v_facturas
  from public.crm_pagos payment
  where payment.id_empresa = v_empresa_id and payment.id_cliente_crm = v_cliente.id
    and (payment.estado = 'vencido' or (payment.estado = 'pendiente' and payment.fecha_vencimiento < current_date));
  if v_total <= 0 or v_facturas = 0 then
    raise exception 'El cliente no tiene saldo vencido por cobrar';
  end if;
  v_recibido := case when v_metodo = 'efectivo'
    then round(coalesce(p_monto_recibido, v_total), 2) else v_total end;
  if v_metodo = 'efectivo' and v_recibido < v_total then
    raise exception 'El efectivo recibido no cubre el saldo vencido';
  end if;
  if v_metodo = 'efectivo' then v_cambio := v_recibido - v_total; end if;
  v_referencia := coalesce(nullif(trim(p_referencia_pago), ''), format('REC-MORA-%s-%s-%s', v_empresa_id, to_char(current_date, 'YYYY'), lpad(v_cliente.id::text, 6, '0')));

  update public.crm_pagos payment
  set estado = 'pagado', fecha_pago = now(), metodo_pago = initcap(v_metodo),
      referencia_pago = v_referencia, notas = coalesce(nullif(trim(p_notas), ''), 'Pago de saldo vencido'),
      monto_recibido = case when payment.id = (
        select min(item.id) from public.crm_pagos item
        where item.id_empresa = v_empresa_id and item.id_cliente_crm = v_cliente.id
          and (item.estado = 'vencido' or (item.estado = 'pendiente' and item.fecha_vencimiento < current_date))
      ) then v_recibido else payment.monto end,
      cambio = case when payment.id = (
        select min(item.id) from public.crm_pagos item
        where item.id_empresa = v_empresa_id and item.id_cliente_crm = v_cliente.id
          and (item.estado = 'vencido' or (item.estado = 'pendiente' and item.fecha_vencimiento < current_date))
      ) then v_cambio else 0 end
  where payment.id_empresa = v_empresa_id and payment.id_cliente_crm = v_cliente.id
    and (payment.estado = 'vencido' or (payment.estado = 'pendiente' and payment.fecha_vencimiento < current_date));

  select * into v_suscripcion from public.crm_suscripciones subscription
  where subscription.id_empresa = v_empresa_id and subscription.id_cliente_crm = v_cliente.id
  order by subscription.fecha_fin desc, subscription.id desc limit 1;
  if found then
    select * into v_plan from public.crm_planes plan where plan.id = v_suscripcion.id_plan;
  end if;
  select coalesce(currency, 'USD') into v_moneda from public.empresa where id = v_empresa_id;
  v_pago := jsonb_build_object(
    'id', format('mora-%s-%s', v_cliente.id, extract(epoch from clock_timestamp())::bigint),
    'monto', v_total, 'monto_recibido', v_recibido, 'cambio', v_cambio,
    'moneda', coalesce(v_moneda, 'USD'), 'metodo_pago', initcap(v_metodo),
    'referencia', v_referencia, 'referencia_pago', v_referencia, 'fecha_pago', now(),
    'fecha_vencimiento', current_date, 'estado', 'pagado',
    'notas', format('Pago de %s documento(s) vencido(s)', v_facturas)
  );
  return jsonb_build_object(
    'cliente', to_jsonb(v_cliente), 'plan', case when v_plan.id is null then null else to_jsonb(v_plan) end,
    'suscripcion', case when v_suscripcion.id is null then null else to_jsonb(v_suscripcion) end,
    'pago', v_pago, 'facturas_liquidadas', v_facturas, 'saldo_cobrado', v_total
  );
end;
$function$;

revoke all on function public.crm_cobrar_mora_pos(bigint, text, numeric, text, text) from public, anon;
grant execute on function public.crm_cobrar_mora_pos(bigint, text, numeric, text, text) to authenticated;
