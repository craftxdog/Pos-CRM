-- Keep one live membership per customer/plan and provide a tenant-safe RPC
-- for correcting plan dates without creating another subscription row.

alter table public.crm_suscripcion_historial
  drop constraint if exists crm_suscripcion_historial_accion_check;

alter table public.crm_suscripcion_historial
  add constraint crm_suscripcion_historial_accion_check
  check (
    accion in (
      'asignada',
      'cambio_plan',
      'vigencia_editada',
      'renovada',
      'pausada',
      'reactivada',
      'cancelada',
      'invitacion_aceptada'
    )
  );

create index if not exists crm_suscripciones_live_membership_lookup_idx
  on public.crm_suscripciones (
    id_empresa,
    id_cliente_crm,
    id_plan,
    estado
  );

create or replace function private.crm_prevent_duplicate_live_subscription()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.estado not in ('activa', 'pausada') then
    return new;
  end if;

  -- Serialize assignments for the same company, customer and plan so two
  -- simultaneous requests cannot both pass the duplicate check.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      format('%s:%s:%s', new.id_empresa, new.id_cliente_crm, new.id_plan),
      0
    )
  );

  if exists (
    select 1
    from public.crm_suscripciones existing
    where existing.id_empresa = new.id_empresa
      and existing.id_cliente_crm = new.id_cliente_crm
      and existing.id_plan = new.id_plan
      and existing.estado in ('activa', 'pausada')
  ) then
    raise exception using
      errcode = '23505',
      message = 'CRM_DUPLICATE_ACTIVE_SUBSCRIPTION',
      detail = 'El cliente ya tiene este plan activo o pausado.';
  end if;

  return new;
end;
$function$;

revoke all on function private.crm_prevent_duplicate_live_subscription()
from public, anon, authenticated;

drop trigger if exists trg_crm_prevent_duplicate_live_subscription
on public.crm_suscripciones;

create trigger trg_crm_prevent_duplicate_live_subscription
before insert on public.crm_suscripciones
for each row
execute function private.crm_prevent_duplicate_live_subscription();

create or replace function public.crm_editar_suscripcion(
  p_id_suscripcion bigint,
  p_id_plan bigint,
  p_fecha_inicio date,
  p_fecha_fin date default null
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
  v_plan public.crm_planes%rowtype;
  v_fecha_fin date;
  v_accion text;
begin
  if v_empresa_id is null then
    raise exception 'No se pudo identificar la empresa del usuario';
  end if;

  if p_fecha_inicio is null then
    raise exception 'Selecciona la fecha de inicio';
  end if;

  select *
  into v_suscripcion
  from public.crm_suscripciones subscription
  where subscription.id = p_id_suscripcion
    and subscription.id_empresa = v_empresa_id
  for update;

  if not found then
    raise exception 'No se encontró la suscripción';
  end if;

  select *
  into v_plan
  from public.crm_planes plan
  where plan.id = p_id_plan
    and plan.id_empresa = v_empresa_id
    and (plan.activo = true or plan.id = v_suscripcion.id_plan);

  if not found then
    raise exception 'El plan no existe o está inactivo';
  end if;

  v_fecha_fin := coalesce(
    p_fecha_fin,
    p_fecha_inicio + (v_plan.duracion_dias - 1)
  );

  if v_fecha_fin < p_fecha_inicio then
    raise exception 'El vencimiento no puede ser anterior al inicio';
  end if;

  if v_plan.id <> v_suscripcion.id_plan
    and exists (
      select 1
      from public.crm_suscripciones duplicate
      where duplicate.id_empresa = v_empresa_id
        and duplicate.id_cliente_crm = v_suscripcion.id_cliente_crm
        and duplicate.id_plan = v_plan.id
        and duplicate.estado in ('activa', 'pausada')
        and duplicate.id <> v_suscripcion.id
    )
  then
    raise exception using
      errcode = '23505',
      message = 'CRM_DUPLICATE_ACTIVE_SUBSCRIPTION',
      detail = 'El cliente ya tiene el plan seleccionado activo o pausado.';
  end if;

  v_anterior := v_suscripcion;
  v_accion := case
    when v_plan.id = v_suscripcion.id_plan then 'vigencia_editada'
    else 'cambio_plan'
  end;

  update public.crm_suscripciones
  set id_plan = v_plan.id,
      fecha_inicio = p_fecha_inicio,
      fecha_fin = v_fecha_fin,
      precio_pactado = case
        when v_plan.id = v_anterior.id_plan then v_anterior.precio_pactado
        else v_plan.precio
      end
  where id = v_suscripcion.id
  returning * into v_suscripcion;

  insert into public.crm_suscripcion_historial (
    id_empresa,
    id_suscripcion,
    accion,
    id_plan_anterior,
    id_plan_nuevo,
    fecha_inicio_anterior,
    fecha_fin_anterior,
    fecha_inicio_nueva,
    fecha_fin_nueva,
    estado_anterior,
    estado_nuevo,
    registrado_por,
    detalle
  )
  values (
    v_empresa_id,
    v_suscripcion.id,
    v_accion,
    v_anterior.id_plan,
    v_suscripcion.id_plan,
    v_anterior.fecha_inicio,
    v_anterior.fecha_fin,
    v_suscripcion.fecha_inicio,
    v_suscripcion.fecha_fin,
    v_anterior.estado,
    v_suscripcion.estado,
    v_usuario_id,
    jsonb_build_object(
      'vencimiento_calculado',
      p_fecha_fin is null,
      'duracion_dias',
      v_plan.duracion_dias
    )
  );

  return jsonb_build_object(
    'suscripcion', to_jsonb(v_suscripcion),
    'accion', v_accion,
    'duracion_dias', v_plan.duracion_dias
  );
end;
$function$;

revoke all on function public.crm_editar_suscripcion(bigint, bigint, date, date)
from public, anon;

grant execute on function public.crm_editar_suscripcion(bigint, bigint, date, date)
to authenticated;

notify pgrst, 'reload schema';
