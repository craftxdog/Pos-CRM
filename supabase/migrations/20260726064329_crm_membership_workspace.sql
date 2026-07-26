-- CRM membership workspace: explicit invitation delivery state, POS-to-CRM
-- customer synchronization, and a tenant-safe operational subscriptions view.

alter table public.crm_invitaciones
  add column if not exists estado_envio text not null default 'pendiente';

alter table public.crm_invitaciones
  drop constraint if exists crm_invitaciones_estado_envio_check,
  add constraint crm_invitaciones_estado_envio_check
    check (estado_envio in ('pendiente', 'enviando', 'enviado', 'error'));

update public.crm_invitaciones
set estado_envio = case
  when email_enviado_at is not null then 'enviado'
  when ultimo_error_email is not null then 'error'
  else 'pendiente'
end;

create index if not exists crm_invitaciones_empresa_estado_created_idx
  on public.crm_invitaciones (id_empresa, estado, created_at desc);

create index if not exists crm_invitaciones_empresa_envio_created_idx
  on public.crm_invitaciones (id_empresa, estado_envio, created_at desc);

create index if not exists clientes_crm_empresa_estado_nombre_idx
  on public.clientes_crm (id_empresa, estado, nombres);

create index if not exists clientes_crm_cliente_proveedor_idx
  on public.clientes_crm (id_cliente_proveedor)
  where id_cliente_proveedor is not null;

create index if not exists crm_suscripciones_empresa_estado_fin_idx
  on public.crm_suscripciones (id_empresa, estado, fecha_fin);

create index if not exists crm_suscripciones_plan_idx
  on public.crm_suscripciones (id_plan);

-- Complete onboarding atomically so a client cannot be created while its
-- invitation remains pending if the second write fails.
create or replace function public.crm_completar_invitacion(
  p_invitacion_id uuid,
  p_nombres text,
  p_apellidos text default null,
  p_telefono text default null,
  p_direccion text default null,
  p_identificador_nacional text default null,
  p_identificador_fiscal text default null,
  p_fecha_nacimiento date default null,
  p_notas text default null
)
returns public.clientes_crm
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_invitacion public.crm_invitaciones%rowtype;
  v_cliente public.clientes_crm%rowtype;
  v_auth_id uuid := (select auth.uid());
  v_auth_email text := (select private.current_auth_email());
begin
  if v_auth_id is null or v_auth_email is null then
    raise exception 'Debes abrir la invitación con el correo autenticado';
  end if;
  if nullif(trim(p_nombres), '') is null then
    raise exception 'El nombre es obligatorio';
  end if;

  select *
  into v_invitacion
  from public.crm_invitaciones i
  where i.id = p_invitacion_id
    and i.estado = 'pendiente'
    and i.expires_at > now()
    and lower(i.email) = v_auth_email
  for update;

  if not found then
    raise exception 'La invitación no está disponible o ya venció';
  end if;

  select *
  into v_cliente
  from public.clientes_crm c
  where c.id_empresa = v_invitacion.id_empresa
    and lower(c.email) = v_auth_email
  limit 1;

  if found then
    if v_cliente.id_auth is not null and v_cliente.id_auth <> v_auth_id then
      raise exception 'El correo ya está vinculado a otro cliente';
    end if;

    update public.clientes_crm
    set
      id_auth = v_auth_id,
      nombres = trim(p_nombres),
      apellidos = nullif(trim(p_apellidos), ''),
      telefono = nullif(trim(p_telefono), ''),
      direccion = nullif(trim(p_direccion), ''),
      identificador_nacional = nullif(trim(p_identificador_nacional), ''),
      identificador_fiscal = nullif(trim(p_identificador_fiscal), ''),
      fecha_nacimiento = p_fecha_nacimiento,
      notas = nullif(trim(p_notas), ''),
      estado = 'activo',
      origen = 'invitacion'
    where id = v_cliente.id
    returning * into v_cliente;
  else
    insert into public.clientes_crm (
      id_empresa,
      id_auth,
      nombres,
      apellidos,
      email,
      telefono,
      direccion,
      identificador_nacional,
      identificador_fiscal,
      fecha_nacimiento,
      estado,
      origen,
      notas
    )
    values (
      v_invitacion.id_empresa,
      v_auth_id,
      trim(p_nombres),
      nullif(trim(p_apellidos), ''),
      v_auth_email,
      nullif(trim(p_telefono), ''),
      nullif(trim(p_direccion), ''),
      nullif(trim(p_identificador_nacional), ''),
      nullif(trim(p_identificador_fiscal), ''),
      p_fecha_nacimiento,
      'activo',
      'invitacion',
      nullif(trim(p_notas), '')
    )
    returning * into v_cliente;
  end if;

  update public.crm_invitaciones
  set
    estado = 'aceptada',
    accepted_at = now(),
    id_cliente_crm = v_cliente.id
  where id = v_invitacion.id;

  return v_cliente;
end;
$function$;

revoke all on function public.crm_completar_invitacion(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  text
) from public, anon;

grant execute on function public.crm_completar_invitacion(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  text
) to authenticated;

-- A customer created from the POS checkout must immediately become available
-- to the CRM. pg_trigger_depth prevents the existing CRM -> POS trigger from
-- creating a synchronization loop.
create or replace function private.pos_sync_cliente_crm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_current_empresa bigint := (select private.current_empresa_id());
begin
  if pg_trigger_depth() > 1
    or lower(coalesce(new.tipo, '')) <> 'cliente'
    or new.id_empresa is null
  then
    return new;
  end if;

  if (select auth.uid()) is not null
    and v_current_empresa is distinct from new.id_empresa
  then
    raise exception 'No puedes sincronizar clientes de otra empresa';
  end if;

  update public.clientes_crm c
  set
    nombres = new.nombres,
    email = nullif(trim(new.email), ''),
    telefono = nullif(trim(new.telefono), ''),
    direccion = nullif(trim(new.direccion), ''),
    identificador_nacional = nullif(trim(new.identificador_nacional), ''),
    identificador_fiscal = nullif(trim(new.identificador_fiscal), ''),
    estado = case
      when new.estado in ('activo', 'inactivo', 'suspendido') then new.estado
      else 'activo'
    end,
    updated_at = now()
  where c.id_cliente_proveedor = new.id
    and c.id_empresa = new.id_empresa;

  if not found and nullif(trim(new.email), '') is not null then
    update public.clientes_crm c
    set
      id_cliente_proveedor = new.id,
      nombres = new.nombres,
      telefono = nullif(trim(new.telefono), ''),
      direccion = nullif(trim(new.direccion), ''),
      identificador_nacional = nullif(trim(new.identificador_nacional), ''),
      identificador_fiscal = nullif(trim(new.identificador_fiscal), ''),
      estado = case
        when new.estado in ('activo', 'inactivo', 'suspendido') then new.estado
        else 'activo'
      end,
      updated_at = now()
    where c.id_empresa = new.id_empresa
      and c.id_cliente_proveedor is null
      and lower(c.email) = lower(trim(new.email));
  end if;

  if not found then
    insert into public.clientes_crm (
      id_empresa,
      id_cliente_proveedor,
      nombres,
      email,
      telefono,
      direccion,
      identificador_nacional,
      identificador_fiscal,
      estado,
      origen
    )
    values (
      new.id_empresa,
      new.id,
      new.nombres,
      nullif(trim(new.email), ''),
      nullif(trim(new.telefono), ''),
      nullif(trim(new.direccion), ''),
      nullif(trim(new.identificador_nacional), ''),
      nullif(trim(new.identificador_fiscal), ''),
      case
        when new.estado in ('activo', 'inactivo', 'suspendido') then new.estado
        else 'activo'
      end,
      'pos'
    );
  end if;

  return new;
end;
$function$;

revoke all on function private.pos_sync_cliente_crm()
from public, anon, authenticated;

drop trigger if exists trg_clientes_proveedores_sync_crm
on public.clientes_proveedores;

create trigger trg_clientes_proveedores_sync_crm
after insert or update of
  nombres,
  id_empresa,
  direccion,
  telefono,
  email,
  identificador_nacional,
  identificador_fiscal,
  tipo,
  estado
on public.clientes_proveedores
for each row execute function private.pos_sync_cliente_crm();

-- Backfill customers that existed in the POS before this bidirectional sync.
update public.clientes_crm c
set id_cliente_proveedor = cp.id
from public.clientes_proveedores cp
where c.id_cliente_proveedor is null
  and cp.id_empresa = c.id_empresa
  and lower(cp.tipo) = 'cliente'
  and nullif(trim(cp.email), '') is not null
  and lower(cp.email) = lower(c.email)
  and not exists (
    select 1
    from public.clientes_crm linked
    where linked.id_cliente_proveedor = cp.id
  );

insert into public.clientes_crm (
  id_empresa,
  id_cliente_proveedor,
  nombres,
  email,
  telefono,
  direccion,
  identificador_nacional,
  identificador_fiscal,
  estado,
  origen
)
select
  cp.id_empresa,
  cp.id,
  cp.nombres,
  nullif(trim(cp.email), ''),
  nullif(trim(cp.telefono), ''),
  nullif(trim(cp.direccion), ''),
  nullif(trim(cp.identificador_nacional), ''),
  nullif(trim(cp.identificador_fiscal), ''),
  case
    when cp.estado in ('activo', 'inactivo', 'suspendido') then cp.estado
    else 'activo'
  end,
  'pos'
from public.clientes_proveedores cp
where lower(cp.tipo) = 'cliente'
  and cp.id_empresa is not null
  and not exists (
    select 1
    from public.clientes_crm c
    where c.id_cliente_proveedor = cp.id
  )
  and (
    nullif(trim(cp.email), '') is null
    or not exists (
      select 1
      from public.clientes_crm c
      where c.id_empresa = cp.id_empresa
        and lower(c.email) = lower(cp.email)
    )
  );

create or replace view public.crm_suscripciones_operativas
with (security_invoker = true)
as
select
  s.id,
  s.public_id,
  s.id_empresa,
  s.id_cliente_crm,
  s.id_plan,
  c.nombres as cliente_nombres,
  c.apellidos as cliente_apellidos,
  trim(concat_ws(' ', c.nombres, c.apellidos)) as cliente_nombre,
  c.email as cliente_email,
  c.telefono as cliente_telefono,
  c.estado as cliente_estado,
  p.nombre as plan_nombre,
  p.descripcion as plan_descripcion,
  p.periodicidad as plan_periodicidad,
  p.duracion_dias as plan_duracion_dias,
  p.activo as plan_activo,
  s.fecha_inicio,
  s.fecha_fin,
  s.precio_pactado,
  s.auto_renovar,
  s.estado as estado_registrado,
  case
    when coalesce(payment.deuda_vencida, false) then 'morosa'
    when s.estado in ('pausada', 'vencida', 'cancelada')
      or s.fecha_fin < current_date then 'inactiva'
    when s.fecha_fin <= current_date + 7 then 'por_vencer'
    else 'activa'
  end as estado_operativo,
  greatest(s.fecha_fin - current_date, 0) as dias_restantes,
  coalesce(payment.deuda_vencida, false) as deuda_vencida,
  payment.estado as ultimo_pago_estado,
  payment.fecha_vencimiento as ultimo_pago_vencimiento,
  payment.referencia as ultimo_pago_referencia,
  lower(concat_ws(
    ' ',
    c.nombres,
    c.apellidos,
    c.email,
    c.telefono,
    p.nombre,
    p.descripcion
  )) as busqueda,
  s.created_at,
  s.updated_at
from public.crm_suscripciones s
join public.clientes_crm c
  on c.id = s.id_cliente_crm
 and c.id_empresa = s.id_empresa
join public.crm_planes p
  on p.id = s.id_plan
 and p.id_empresa = s.id_empresa
left join lateral (
  select
    pg.estado,
    pg.fecha_vencimiento,
    pg.referencia,
    exists (
      select 1
      from public.crm_pagos overdue
      where overdue.id_suscripcion = s.id
        and overdue.id_empresa = s.id_empresa
        and (
          overdue.estado = 'vencido'
          or (
            overdue.estado = 'pendiente'
            and coalesce(overdue.fecha_vencimiento, s.fecha_fin) < current_date
          )
        )
    ) as deuda_vencida
  from public.crm_pagos pg
  where pg.id_suscripcion = s.id
    and pg.id_empresa = s.id_empresa
  order by pg.created_at desc, pg.id desc
  limit 1
) payment on true;

revoke all on public.crm_suscripciones_operativas from public, anon;
grant select on public.crm_suscripciones_operativas to authenticated;

insert into public.modulos (
  nombre,
  descripcion,
  icono,
  link,
  etiquetas,
  "check"
)
select
  'CRM Suscripciones',
  'Asignación, vigencia, morosidad y renovaciones',
  'flat-color-icons:workflow',
  '/crm/suscripciones',
  '#crm',
  true
where not exists (
  select 1
  from public.modulos
  where link = '/crm/suscripciones'
);

notify pgrst, 'reload schema';
