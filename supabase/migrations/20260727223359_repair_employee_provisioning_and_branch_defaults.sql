-- Repair records created before the production bootstrap trigger and before
-- employee provisioning was centralized in admin-create-user. All statements
-- are idempotent and preserve existing branch, cash-box and permission choices.

-- Every legacy company needs a tenant before its users can resolve access in
-- get_current_tenant_access(). The normal company trigger already creates this
-- for new companies; this fills only missing legacy rows.
insert into public.tenants (legacy_empresa_id, nombre, slug, trial_ends_at)
select
  e.id,
  coalesce(nullif(e.nombre, ''), 'Organizacion'),
  'org-' || e.public_id::text,
  now() + interval '14 days'
from public.empresa e
where not exists (
  select 1 from public.tenants t where t.legacy_empresa_id = e.id
)
on conflict (legacy_empresa_id) do nothing;

-- A user who can enter the application must also be an active tenant member.
-- Keep the owner/admin distinction and do not overwrite manually suspended
-- memberships.
insert into public.tenant_memberships (tenant_id, user_id, role, estado)
select
  t.id,
  u.id_auth::uuid,
  case
    when u.id = e.id_usuario then 'owner'
    when lower(coalesce(r.nombre, '')) in ('superadmin', 'administrador', 'admin') then 'admin'
    else 'staff'
  end,
  'active'
from public.usuarios u
join public.empresa e on e.id = u.id_empresa
join public.tenants t on t.legacy_empresa_id = e.id
left join public.roles r on r.id = u.id_rol
where u.id_auth ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and not exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = t.id and tm.user_id = u.id_auth::uuid
  );

-- Existing branches created before the trigger receive the same minimum POS
-- infrastructure as newly created branches. Existing choices are never changed.
insert into public.caja (id_sucursal, descripcion)
select s.id, 'Caja principal'
from public.sucursales s
where not exists (
  select 1 from public.caja c where c.id_sucursal = s.id
);

insert into public.impresoras (id_caja)
select c.id
from public.caja c
where not exists (
  select 1 from public.impresoras i where i.id_caja = c.id
);

-- Give users with no branch at all the first available branch/cash-box in
-- their company. Users who already have an assignment keep it unchanged.
with default_branch as (
  select distinct on (s.id_empresa)
    s.id_empresa,
    s.id as id_sucursal,
    c.id as id_caja
  from public.sucursales s
  join public.caja c on c.id_sucursal = s.id
  order by s.id_empresa, s.id, c.id
)
insert into public.asignacion_sucursal (id_sucursal, id_usuario, id_caja)
select db.id_sucursal, u.id, db.id_caja
from public.usuarios u
join default_branch db on db.id_empresa = u.id_empresa
where not exists (
  select 1 from public.asignacion_sucursal a where a.id_usuario = u.id
);

update public.asignacion_sucursal a
set id_caja = c.id
from public.caja c
where a.id_caja is null
  and c.id = (
    select c2.id
    from public.caja c2
    where c2.id_sucursal = a.id_sucursal
    order by c2.id
    limit 1
  );

-- The POS requires a serialization for every sales document type. New branches
-- receive them from the trigger; this backfills the existing production branch.
insert into public.tipo_comprobantes (nombre, destino)
select seed.nombre, seed.destino
from (values ('Recibo', 'ventas'), ('Factura', 'ventas')) as seed(nombre, destino)
where not exists (
  select 1
  from public.tipo_comprobantes tc
  where lower(tc.nombre) = lower(seed.nombre)
    and tc.destino = seed.destino
);

insert into public.serializacion_comprobantes (
  sucursal_id,
  id_tipo_comprobante,
  serie,
  correlativo,
  cantidad_numeros,
  por_default
)
select
  s.id,
  tc.id,
  'A001',
  1,
  8,
  not exists (
    select 1
    from public.serializacion_comprobantes current_default
    where current_default.sucursal_id = s.id and current_default.por_default
  )
from public.sucursales s
join public.tipo_comprobantes tc on tc.destino = 'ventas'
where not exists (
  select 1
  from public.serializacion_comprobantes sc
  where sc.sucursal_id = s.id and sc.id_tipo_comprobante = tc.id
);

-- Older browser-based provisioning sometimes created the user and assignment
-- but stopped before inserting its role defaults. Backfill only users with no
-- permissions; individually customized users remain untouched.
insert into public.permisos (id_usuario, idmodulo)
select u.id, pd.idmodulo
from public.usuarios u
join public.permisos_dafault pd on pd.id_rol = u.id_rol
where not exists (
  select 1 from public.permisos p where p.id_usuario = u.id
)
  and not exists (
    select 1
    from public.permisos existing
    where existing.id_usuario = u.id and existing.idmodulo = pd.idmodulo
  );
