-- A company logo lives at one deterministic object path: empresa/<company-id>.
-- The policies are intentionally scoped to the authenticated user's current company.
drop policy if exists imagenes_company_select on storage.objects;
drop policy if exists imagenes_company_insert on storage.objects;
drop policy if exists imagenes_company_update on storage.objects;

create policy imagenes_company_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'imagenes'
  and name = ('empresa/' || (select private.current_empresa_id())::text)
);

create policy imagenes_company_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'imagenes'
  and name = ('empresa/' || (select private.current_empresa_id())::text)
);

create policy imagenes_company_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'imagenes'
  and name = ('empresa/' || (select private.current_empresa_id())::text)
)
with check (
  bucket_id = 'imagenes'
  and name = ('empresa/' || (select private.current_empresa_id())::text)
);

-- A new branch must be operational from its first minute. The trigger creates
-- only the minimum POS infrastructure and is not callable through the API.
create or replace function private.ensure_pos_defaults_for_sucursal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_caja_id bigint;
  owner_user_id bigint;
begin
  insert into public.caja (id_sucursal, descripcion)
  select new.id, 'Caja principal'
  where not exists (
    select 1 from public.caja c where c.id_sucursal = new.id
  )
  returning id into default_caja_id;

  if default_caja_id is null then
    select c.id into default_caja_id
    from public.caja c
    where c.id_sucursal = new.id
    order by c.id
    limit 1;
  end if;

  if default_caja_id is not null then
    insert into public.impresoras (id_caja)
    values (default_caja_id)
    on conflict (id_caja) do nothing;
  end if;

  select e.id_usuario into owner_user_id
  from public.empresa e
  where e.id = new.id_empresa;

  if owner_user_id is not null and default_caja_id is not null then
    insert into public.asignacion_sucursal (id_sucursal, id_usuario, id_caja)
    select new.id, owner_user_id, default_caja_id
    where not exists (
      select 1
      from public.asignacion_sucursal a
      where a.id_sucursal = new.id and a.id_usuario = owner_user_id
    );
  end if;

  insert into public.serializacion_comprobantes (
    sucursal_id,
    id_tipo_comprobante,
    serie,
    correlativo,
    cantidad_numeros,
    por_default
  )
  select
    new.id,
    tc.id,
    'A001',
    1,
    8,
    not exists (
      select 1
      from public.serializacion_comprobantes existing
      where existing.sucursal_id = new.id and existing.por_default
    )
  from public.tipo_comprobantes tc
  where tc.destino = 'ventas'
    and not exists (
      select 1
      from public.serializacion_comprobantes sc
      where sc.sucursal_id = new.id and sc.id_tipo_comprobante = tc.id
    );

  return new;
end;
$$;

revoke all on function private.ensure_pos_defaults_for_sucursal() from public, anon, authenticated;

drop trigger if exists trg_sucursal_pos_defaults on public.sucursales;
create trigger trg_sucursal_pos_defaults
after insert on public.sucursales
for each row execute function private.ensure_pos_defaults_for_sucursal();
