begin;

do $test$
declare
  role_id bigint;
  user_id bigint;
  company_id bigint;
  branch_id bigint;
  category_id bigint;
  product_id bigint;
  sale_id bigint;
  line_id bigint;
  line_record record;
  sale_record record;
  tenant_record record;
  missing_uuids integer;
begin
  select id into role_id from public.roles where lower(nombre) = 'administrador' limit 1;
  insert into public.usuarios (nombres, correo, id_rol, fecharegistro)
  values ('Smoke Admin', 'smoke@example.test', role_id, current_date)
  returning id into user_id;

  insert into public.empresa (
    nombre, id_auth, id_usuario, impuesto, valor_impuesto, precios_incluyen_impuesto
  ) values (
    'Smoke Gym', gen_random_uuid()::text, user_id, 'IVA', 13, true
  ) returning id into company_id;
  update public.usuarios set id_empresa = company_id where id = user_id;

  select id into branch_id from public.sucursales where id_empresa = company_id limit 1;
  insert into public.categorias (nombre, id_empresa)
  values ('Smoke', company_id) returning id into category_id;
  insert into public.productos (
    nombre, precio_venta, precio_compra, id_categoria, id_empresa,
    maneja_inventarios, aplica_impuesto
  ) values (
    'Membresia mostrador', 113, 50, category_id, company_id, false, true
  ) returning id into product_id;
  insert into public.ventas (id_usuario, id_sucursal, id_empresa, estado)
  values (user_id, branch_id, company_id, 'pendiente') returning id into sale_id;
  insert into public.detalle_venta (
    id_venta, cantidad, precio_venta, precio_compra, descripcion,
    id_producto, id_sucursal
  ) values (
    sale_id, 2, 113, 50, 'Membresia mostrador', product_id, branch_id
  ) returning id into line_id;

  select * into line_record from public.detalle_venta where id = line_id;
  if line_record.subtotal <> 200 or line_record.impuesto_total <> 26
     or line_record.total <> 226 or line_record.costo_total <> 100
     or line_record.ganancia <> 100 then
    raise exception 'Calculo de linea incorrecto: %', row_to_json(line_record);
  end if;

  select * into sale_record from public.ventas where id = sale_id;
  if sale_record.sub_total <> 200 or sale_record.total_impuestos <> 26
     or sale_record.monto_total <> 226 or sale_record.cantidad_productos <> 2 then
    raise exception 'Calculo de venta incorrecto: %', row_to_json(sale_record);
  end if;

  select t.*, s.estado as subscription_status into tenant_record
  from public.tenants t
  join public.tenant_subscriptions s on s.tenant_id = t.id
  where t.legacy_empresa_id = company_id;
  if tenant_record.id is null or tenant_record.subscription_status <> 'active' then
    raise exception 'Tenant o suscripción permanente no creado correctamente';
  end if;

  select count(*) into missing_uuids
  from (
    select public_id from public.empresa where id = company_id
    union all select public_id from public.usuarios where id = user_id
    union all select public_id from public.productos where id = product_id
    union all select public_id from public.ventas where id = sale_id
    union all select public_id from public.detalle_venta where id = line_id
  ) ids where public_id is null;
  if missing_uuids <> 0 then raise exception 'Hay identificadores publicos sin UUID'; end if;
end
$test$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '11111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'rls-smoke@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

with new_user as (
  insert into public.usuarios (nombres, correo, id_auth, id_rol, fecharegistro)
  select 'RLS Smoke', 'rls-smoke@example.test', '11111111-1111-4111-8111-111111111111', r.id, current_date
  from public.roles r where lower(r.nombre) = 'administrador' limit 1
  returning id
), new_company as (
  insert into public.empresa (nombre, id_auth, id_usuario)
  select 'RLS Smoke Gym', '11111111-1111-4111-8111-111111111111', id from new_user
  returning id, id_usuario
)
update public.usuarios u
set id_empresa = c.id
from new_company c
where u.id = c.id_usuario;

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","email":"rls-smoke@example.test"}',
  true
);
set local role authenticated;

do $rls_test$
declare
  access jsonb;
  visible_users integer;
  current_user_id bigint;
  current_company_id bigint;
  current_branch_id bigint;
  category_id bigint;
  product_id bigint;
  sale_id bigint;
  line_count integer;
begin
  select public.get_current_tenant_access() into access;
  if access->>'tenant_id' is null
     or coalesce((access->'features'->>'pos')::boolean, false) is not true
     or coalesce((access->'features'->>'crm')::boolean, false) is not true then
    raise exception 'Acceso tenant/RLS incorrecto: %', access;
  end if;

  select count(*) into visible_users from public.usuarios;
  if visible_users <> 1 then
    raise exception 'RLS expuso usuarios fuera del tenant: %', visible_users;
  end if;

  select u.id, u.id_empresa
  into current_user_id, current_company_id
  from public.usuarios u
  where u.id_auth = '11111111-1111-4111-8111-111111111111';

  select s.id into current_branch_id
  from public.sucursales s
  where s.id_empresa = current_company_id
  order by s.id
  limit 1;

  insert into public.categorias (nombre, id_empresa)
  values ('RPC Smoke', current_company_id)
  returning id into category_id;

  insert into public.productos (
    nombre, precio_venta, precio_compra, id_categoria, id_empresa,
    maneja_inventarios, aplica_impuesto
  ) values (
    'RPC POS item', 100, 40, category_id, current_company_id, false, true
  ) returning id into product_id;

  insert into public.ventas (fecha, id_usuario, id_sucursal, id_empresa, estado)
  values (current_date, current_user_id, current_branch_id, current_company_id, 'nueva')
  returning id into sale_id;

  perform public.insertardetalleventa(
    sale_id::integer, 1, 100, 100, 'RPC POS item', product_id::integer,
    40, current_branch_id::integer, null
  );

  select count(*) into line_count
  from public.detalle_venta
  where id_venta = sale_id and id_producto = product_id;
  if line_count <> 1 then
    raise exception 'La RPC insertardetalleventa no insertó una línea';
  end if;
end
$rls_test$;

rollback;
