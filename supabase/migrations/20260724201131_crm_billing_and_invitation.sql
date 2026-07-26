-- Streamlined CRM billing and transactional invitation delivery.

alter table public.crm_invitaciones
  add column if not exists email_enviado_at timestamptz,
  add column if not exists ultimo_error_email text,
  add column if not exists intentos_email integer not null default 0
    check (intentos_email >= 0);

create index if not exists crm_pagos_empresa_created_at_idx
  on public.crm_pagos (id_empresa, created_at desc);

create index if not exists crm_suscripciones_empresa_cliente_idx
  on public.crm_suscripciones (id_empresa, id_cliente_crm, created_at desc);

create or replace function public.crm_facturar_plan(
  p_id_cliente_crm bigint,
  p_id_plan bigint,
  p_fecha_inicio date default current_date,
  p_estado text default 'pagado',
  p_metodo_pago text default null,
  p_auto_renovar boolean default false,
  p_notas text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_empresa_id bigint := (select private.current_empresa_id());
  v_usuario_id bigint := (select private.current_usuario_id());
  v_cliente public.clientes_crm%rowtype;
  v_plan public.crm_planes%rowtype;
  v_suscripcion public.crm_suscripciones%rowtype;
  v_pago public.crm_pagos%rowtype;
  v_moneda text;
begin
  if v_empresa_id is null then
    raise exception 'No se pudo identificar la empresa del usuario';
  end if;

  if p_estado not in ('pendiente', 'pagado', 'vencido') then
    raise exception 'Estado de factura no permitido';
  end if;

  select *
  into v_cliente
  from public.clientes_crm
  where id = p_id_cliente_crm
    and id_empresa = v_empresa_id;

  if not found then
    raise exception 'El cliente no pertenece a la empresa actual';
  end if;

  select *
  into v_plan
  from public.crm_planes
  where id = p_id_plan
    and id_empresa = v_empresa_id
    and activo = true;

  if not found then
    raise exception 'El plan no existe o no está activo';
  end if;

  select coalesce(currency, 'USD')
  into v_moneda
  from public.empresa
  where id = v_empresa_id;

  insert into public.crm_suscripciones (
    id_empresa,
    id_cliente_crm,
    id_plan,
    fecha_inicio,
    fecha_fin,
    precio_pactado,
    auto_renovar,
    estado
  )
  values (
    v_empresa_id,
    v_cliente.id,
    v_plan.id,
    coalesce(p_fecha_inicio, current_date),
    coalesce(p_fecha_inicio, current_date) + v_plan.duracion_dias,
    v_plan.precio,
    coalesce(p_auto_renovar, false),
    'activa'
  )
  returning * into v_suscripcion;

  insert into public.crm_pagos (
    id_empresa,
    id_cliente_crm,
    id_suscripcion,
    monto,
    moneda,
    metodo_pago,
    fecha_pago,
    fecha_vencimiento,
    periodo_inicio,
    periodo_fin,
    estado,
    registrado_por,
    notas
  )
  values (
    v_empresa_id,
    v_cliente.id,
    v_suscripcion.id,
    v_plan.precio,
    coalesce(v_moneda, 'USD'),
    nullif(trim(p_metodo_pago), ''),
    case when p_estado = 'pagado' then now() else null end,
    v_suscripcion.fecha_fin,
    v_suscripcion.fecha_inicio,
    v_suscripcion.fecha_fin,
    p_estado,
    v_usuario_id,
    nullif(trim(p_notas), '')
  )
  returning * into v_pago;

  update public.crm_pagos
  set referencia = format(
    'FAC-%s-%s-%s',
    v_empresa_id,
    to_char(coalesce(v_pago.fecha_pago, v_pago.created_at), 'YYYY'),
    lpad(v_pago.id::text, 6, '0')
  )
  where id = v_pago.id
  returning * into v_pago;

  return jsonb_build_object(
    'cliente', to_jsonb(v_cliente),
    'plan', to_jsonb(v_plan),
    'suscripcion', to_jsonb(v_suscripcion),
    'pago', to_jsonb(v_pago)
  );
end;
$$;

revoke all on function public.crm_facturar_plan(bigint, bigint, date, text, text, boolean, text)
from public, anon;

grant execute on function public.crm_facturar_plan(bigint, bigint, date, text, text, boolean, text)
to authenticated;

notify pgrst, 'reload schema';
