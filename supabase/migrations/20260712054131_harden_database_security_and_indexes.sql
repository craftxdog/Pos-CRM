-- ActiveSelfControl: hardening and performance baseline.
-- This migration is intentionally idempotent where PostgreSQL permits it.

-- Browser roles only need row-level DML. TRUNCATE bypasses RLS and neither
-- REFERENCES nor TRIGGER should be available through the Data API.
revoke all privileges on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from authenticated;

-- These routines were created after the original function hardening and
-- inherited EXECUTE for PUBLIC. Keep the inventory RPCs authenticated-only;
-- trigger helpers are not directly callable by API roles.
revoke execute on function public.incrementarstock(bigint, numeric) from public, anon;
revoke execute on function public.reducirstock(bigint, numeric) from public, anon;
revoke execute on function public.sync_stock_sucursal() from public, anon, authenticated;
grant execute on function public.incrementarstock(bigint, numeric) to authenticated;
grant execute on function public.reducirstock(bigint, numeric) to authenticated;

-- Obsolete brand RPCs reference a table that no longer exists and are not
-- consumed by the application. Keeping broken callable code makes schema
-- validation fail and creates future maintenance risk.
drop function if exists public.editarmarca(text, integer, integer);
drop function if exists public.insertarmarca(text, integer);

-- Preserve the existing sale-detail behavior while removing the dead local
-- variable reported by plpgsql_check.
create or replace function public.insertardetalleventa(
  _id_venta integer,
  _cantidad numeric,
  _precio_venta numeric,
  _total numeric,
  _descripcion text,
  _id_producto integer,
  _precio_compra numeric,
  _id_sucursal integer,
  _id_almacen integer
) returns void
language plpgsql
set search_path = public
as $function$
begin
  perform 1
  from public.detalle_venta
  join public.productos p on p.id = detalle_venta.id_producto
  where p.id = _id_producto
    and id_venta = _id_venta
    and estado = 'nueva';

  if found then
    update public.detalle_venta
    set cantidad = cantidad + _cantidad,
        total = (cantidad + _cantidad) * precio_venta
    where id_producto = _id_producto
      and id_venta = _id_venta
      and estado = 'nueva';
  else
    insert into public.detalle_venta(
      id_venta, cantidad, precio_venta, total, descripcion, id_producto,
      precio_compra, id_sucursal, id_almacen
    ) values (
      _id_venta, _cantidad, _precio_venta, _total, _descripcion, _id_producto,
      _precio_compra, _id_sucursal, _id_almacen
    );
  end if;
end;
$function$;

-- A public bucket can serve getPublicUrl() objects without a broad SELECT
-- policy. Removing it prevents anonymous enumeration of every stored object.
drop policy if exists imagenes_public_read on storage.objects;

-- Avoid evaluating two permissive SELECT policies for every warehouse row.
drop policy if exists almacen_company_write on public.almacen;
drop policy if exists almacen_company_insert on public.almacen;
drop policy if exists almacen_company_update on public.almacen;
drop policy if exists almacen_company_delete on public.almacen;

create policy almacen_company_insert on public.almacen
for insert to authenticated
with check (
  exists (
    select 1 from public.sucursales s
    where s.id = almacen.id_sucursal
      and s.id_empresa = (select private.current_empresa_id())
  )
);

create policy almacen_company_update on public.almacen
for update to authenticated
using (
  exists (
    select 1 from public.sucursales s
    where s.id = almacen.id_sucursal
      and s.id_empresa = (select private.current_empresa_id())
  )
)
with check (
  exists (
    select 1 from public.sucursales s
    where s.id = almacen.id_sucursal
      and s.id_empresa = (select private.current_empresa_id())
  )
);

create policy almacen_company_delete on public.almacen
for delete to authenticated
using (
  exists (
    select 1 from public.sucursales s
    where s.id = almacen.id_sucursal
      and s.id_empresa = (select private.current_empresa_id())
  )
);

-- PostgreSQL does not automatically index foreign-key columns. Generate one
-- covering btree index for every currently uncovered FK, including composite
-- keys in their declared order.
do $migration$
declare
  fk record;
begin
  for fk in
    select
      con.conrelid,
      con.conname,
      (
        select string_agg(quote_ident(a.attname), ', ' order by u.ord)
        from unnest(con.conkey) with ordinality u(attnum, ord)
        join pg_attribute a
          on a.attrelid = con.conrelid and a.attnum = u.attnum
      ) as columns_sql
    from pg_constraint con
    where con.contype = 'f'
      and con.connamespace = 'public'::regnamespace
      and not exists (
        select 1
        from pg_index idx
        where idx.indrelid = con.conrelid
          and idx.indisvalid
          and idx.indpred is null
          and (idx.indkey::smallint[])[0:cardinality(con.conkey)-1] = con.conkey
      )
  loop
    execute format(
      'create index if not exists %I on %s (%s)',
      left(fk.conname || '_idx', 63),
      fk.conrelid::regclass,
      fk.columns_sql
    );
  end loop;
end
$migration$;
