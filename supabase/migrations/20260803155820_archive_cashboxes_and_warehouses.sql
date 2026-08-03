-- Operational cashboxes and warehouses are archived instead of deleted so
-- sales, closings, cash movements and inventory ledgers remain auditable.

alter table public.caja
  add column if not exists archived_at timestamptz;

alter table public.almacen
  add column if not exists estado text not null default 'activa',
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.caja
set archived_at = coalesce(updated_at, now())
where estado = 'inactiva'
  and archived_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'almacen_estado_check'
      and conrelid = 'public.almacen'::regclass
  ) then
    alter table public.almacen
      add constraint almacen_estado_check
      check (estado in ('activa', 'inactiva'));
  end if;
end;
$$;

create index if not exists caja_sucursal_activa_idx
  on public.caja (id_sucursal)
  where estado = 'activa';

create index if not exists almacen_sucursal_activo_idx
  on public.almacen (id_sucursal)
  where estado = 'activa';

create or replace function private.validate_cashbox_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.estado = 'activa' and new.estado = 'inactiva' then
    -- Serialize lifecycle changes for the branch so two active boxes cannot
    -- both become the "last one" and retire at the same time.
    perform 1
    from public.sucursales branch
    where branch.id = old.id_sucursal
    for update;

    if exists (
      select 1
      from public.cierrecaja closing
      where closing.id_caja = old.id
        and (closing.estado = 0 or closing.fechacierre is null)
    ) then
      raise exception using
        errcode = '23514',
        message = 'La caja tiene un turno abierto. Cierra y concilia la caja antes de retirarla.';
    end if;

    if not exists (
      select 1
      from public.caja other_cashbox
      where other_cashbox.id_sucursal = old.id_sucursal
        and other_cashbox.id <> old.id
        and other_cashbox.estado = 'activa'
    ) then
      raise exception using
        errcode = '23514',
        message = 'No puedes retirar la única caja activa de la sucursal.';
    end if;

    new.archived_at = now();
  elsif old.estado = 'inactiva' and new.estado = 'activa' then
    new.archived_at = null;
  end if;

  return new;
end;
$$;

create or replace function private.detach_archived_cashbox_assignments()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.estado = 'activa' and new.estado = 'inactiva' then
    -- Serialize the last-active check and wait for any stock update already
    -- in progress before evaluating the balance.
    perform 1
    from public.sucursales branch
    where branch.id = old.id_sucursal
    for update;

    perform 1
    from public.almacenes inventory
    where inventory.id_almacen = old.id
    for update;

    update public.asignacion_sucursal assignment
    set id_caja = null
    where assignment.id_caja = new.id;
  end if;

  return new;
end;
$$;

create or replace function private.validate_warehouse_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.estado = 'activa' and new.estado = 'inactiva' then
    if exists (
      select 1
      from public.almacenes inventory
      where inventory.id_almacen = old.id
        and coalesce(inventory.stock, 0) <> 0
    ) then
      raise exception using
        errcode = '23514',
        message = 'El almacén todavía tiene existencias. Transfiere o ajusta todo el stock a cero antes de retirarlo.';
    end if;

    if not exists (
      select 1
      from public.almacen other_warehouse
      where other_warehouse.id_sucursal = old.id_sucursal
        and other_warehouse.id <> old.id
        and other_warehouse.estado = 'activa'
    ) then
      raise exception using
        errcode = '23514',
        message = 'No puedes retirar el único almacén activo de la sucursal.';
    end if;

    new.archived_at = now();
  elsif old.estado = 'inactiva' and new.estado = 'activa' then
    new.archived_at = null;
  end if;

  return new;
end;
$$;

create or replace function private.prevent_operational_master_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'caja' then
    raise exception using
      errcode = '23503',
      message = 'Las cajas no se eliminan: retírala para conservar cierres, ventas y movimientos.';
  end if;

  raise exception using
    errcode = '23503',
    message = 'Los almacenes no se eliminan: retíralo para conservar existencias y movimientos.';
end;
$$;

create or replace function private.ensure_active_cashbox_for_opening()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.estado = 0 then
    -- SHARE conflicts with a concurrent retirement UPDATE. The statement
    -- waits and then validates the final operational state.
    perform 1
    from public.caja cashbox
    where cashbox.id = new.id_caja
      and cashbox.estado = 'activa'
    for share;

    if not found then
      raise exception using
        errcode = '23514',
        message = 'La caja está retirada y no puede abrir nuevos turnos.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.ensure_active_warehouse_for_operation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Prevent a stock operation from slipping in while the warehouse is being
  -- retired. It waits for the lifecycle update and validates the final state.
  perform 1
    from public.almacen warehouse
    where warehouse.id = new.id_almacen
      and warehouse.estado = 'activa'
  for share;

  if not found then
    raise exception using
      errcode = '23514',
      message = 'El almacén está retirado y no admite nuevas operaciones.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_cashbox_lifecycle on public.caja;
create trigger trg_validate_cashbox_lifecycle
before update of estado on public.caja
for each row execute function private.validate_cashbox_lifecycle();

drop trigger if exists trg_detach_archived_cashbox_assignments on public.caja;
create trigger trg_detach_archived_cashbox_assignments
after update of estado on public.caja
for each row execute function private.detach_archived_cashbox_assignments();

drop trigger if exists trg_prevent_cashbox_delete on public.caja;
create trigger trg_prevent_cashbox_delete
before delete on public.caja
for each row execute function private.prevent_operational_master_delete();

drop trigger if exists trg_validate_warehouse_lifecycle on public.almacen;
create trigger trg_validate_warehouse_lifecycle
before update of estado on public.almacen
for each row execute function private.validate_warehouse_lifecycle();

drop trigger if exists trg_prevent_warehouse_delete on public.almacen;
create trigger trg_prevent_warehouse_delete
before delete on public.almacen
for each row execute function private.prevent_operational_master_delete();

drop trigger if exists trg_almacen_updated_at on public.almacen;
create trigger trg_almacen_updated_at
before update on public.almacen
for each row execute function private.set_updated_at();

drop trigger if exists trg_require_active_cashbox_for_opening on public.cierrecaja;
create trigger trg_require_active_cashbox_for_opening
before insert or update of id_caja, estado on public.cierrecaja
for each row execute function private.ensure_active_cashbox_for_opening();

drop trigger if exists trg_require_active_warehouse_for_stock on public.almacenes;
create trigger trg_require_active_warehouse_for_stock
before insert or update of id_almacen, stock on public.almacenes
for each row execute function private.ensure_active_warehouse_for_operation();

drop trigger if exists trg_require_active_warehouse_for_movement on public.movimientos_stock;
create trigger trg_require_active_warehouse_for_movement
before insert or update of id_almacen on public.movimientos_stock
for each row execute function private.ensure_active_warehouse_for_operation();

create or replace function public.diagnosticar_retiro_caja(_id_caja bigint)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', cashbox.id,
    'estado', cashbox.estado,
    'turnos_abiertos', (
      select count(*)
      from public.cierrecaja closing
      where closing.id_caja = cashbox.id
        and (closing.estado = 0 or closing.fechacierre is null)
    ),
    'cierres_historicos', (
      select count(*) from public.cierrecaja closing where closing.id_caja = cashbox.id
    ),
    'movimientos_historicos', (
      select count(*)
      from public.movimientos_caja movement
      join public.cierrecaja closing on closing.id = movement.id_cierre_caja
      where closing.id_caja = cashbox.id
    ),
    'ventas_historicas', (
      select count(*)
      from public.ventas sale
      join public.cierrecaja closing on closing.id = sale.id_cierre_caja
      where closing.id_caja = cashbox.id
    ),
    'asignaciones', (
      select count(*) from public.asignacion_sucursal assignment where assignment.id_caja = cashbox.id
    ),
    'otras_activas', (
      select count(*)
      from public.caja other_cashbox
      where other_cashbox.id_sucursal = cashbox.id_sucursal
        and other_cashbox.id <> cashbox.id
        and other_cashbox.estado = 'activa'
    ),
    'puede_retirar',
      not exists (
        select 1
        from public.cierrecaja closing
        where closing.id_caja = cashbox.id
          and (closing.estado = 0 or closing.fechacierre is null)
      )
      and exists (
        select 1
        from public.caja other_cashbox
        where other_cashbox.id_sucursal = cashbox.id_sucursal
          and other_cashbox.id <> cashbox.id
          and other_cashbox.estado = 'activa'
      )
  )
  from public.caja cashbox
  where cashbox.id = _id_caja;
$$;

create or replace function public.diagnosticar_retiro_almacen(_id_almacen bigint)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', warehouse.id,
    'estado', warehouse.estado,
    'filas_con_stock', (
      select count(*)
      from public.almacenes inventory
      where inventory.id_almacen = warehouse.id
        and coalesce(inventory.stock, 0) <> 0
    ),
    'existencias', (
      select coalesce(sum(inventory.stock), 0)
      from public.almacenes inventory
      where inventory.id_almacen = warehouse.id
    ),
    'movimientos_historicos', (
      select count(*)
      from public.movimientos_stock movement
      where movement.id_almacen = warehouse.id
    ),
    'otras_activas', (
      select count(*)
      from public.almacen other_warehouse
      where other_warehouse.id_sucursal = warehouse.id_sucursal
        and other_warehouse.id <> warehouse.id
        and other_warehouse.estado = 'activa'
    ),
    'puede_retirar',
      not exists (
        select 1
        from public.almacenes inventory
        where inventory.id_almacen = warehouse.id
          and coalesce(inventory.stock, 0) <> 0
      )
      and exists (
        select 1
        from public.almacen other_warehouse
        where other_warehouse.id_sucursal = warehouse.id_sucursal
          and other_warehouse.id <> warehouse.id
          and other_warehouse.estado = 'activa'
      )
  )
  from public.almacen warehouse
  where warehouse.id = _id_almacen;
$$;

revoke all on function private.validate_cashbox_lifecycle() from public, anon, authenticated;
revoke all on function private.detach_archived_cashbox_assignments() from public, anon, authenticated;
revoke all on function private.validate_warehouse_lifecycle() from public, anon, authenticated;
revoke all on function private.prevent_operational_master_delete() from public, anon, authenticated;
revoke all on function private.ensure_active_cashbox_for_opening() from public, anon, authenticated;
revoke all on function private.ensure_active_warehouse_for_operation() from public, anon, authenticated;

revoke all on function public.diagnosticar_retiro_caja(bigint) from public, anon;
revoke all on function public.diagnosticar_retiro_almacen(bigint) from public, anon;
grant execute on function public.diagnosticar_retiro_caja(bigint) to authenticated;
grant execute on function public.diagnosticar_retiro_almacen(bigint) to authenticated;

drop policy if exists "almacen_company_write" on public.almacen;
drop policy if exists "almacen_company_insert" on public.almacen;
drop policy if exists "almacen_company_update" on public.almacen;
drop policy if exists "almacen_company_delete" on public.almacen;

create policy "almacen_company_insert"
on public.almacen for insert
to authenticated
with check (
  exists (
    select 1
    from public.sucursales branch
    where branch.id = almacen.id_sucursal
      and branch.id_empresa = (select private.current_empresa_id())
      and (select private.is_empresa_admin())
  )
);

create policy "almacen_company_update"
on public.almacen for update
to authenticated
using (
  exists (
    select 1
    from public.sucursales branch
    where branch.id = almacen.id_sucursal
      and branch.id_empresa = (select private.current_empresa_id())
      and (select private.is_empresa_admin())
  )
)
with check (
  exists (
    select 1
    from public.sucursales branch
    where branch.id = almacen.id_sucursal
      and branch.id_empresa = (select private.current_empresa_id())
      and (select private.is_empresa_admin())
  )
);

-- A direct DELETE still passes through the trigger above, which explains to
-- API clients that retirement is the supported lifecycle operation.
create policy "almacen_company_delete"
on public.almacen for delete
to authenticated
using (
  exists (
    select 1
    from public.sucursales branch
    where branch.id = almacen.id_sucursal
      and branch.id_empresa = (select private.current_empresa_id())
      and (select private.is_empresa_admin())
  )
);

comment on column public.caja.archived_at is
  'Fecha de retiro operativo. La fila y todo su historial se conservan.';
comment on column public.almacen.estado is
  'Estado operativo: activa o inactiva. Los almacenes retirados conservan el historial.';
comment on column public.almacen.archived_at is
  'Fecha de retiro operativo. La fila, existencias en cero y movimientos se conservan.';
