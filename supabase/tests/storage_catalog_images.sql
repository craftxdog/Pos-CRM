begin;

select plan(1);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '22222222-2222-4222-8222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'storage-smoke@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

with new_user as (
  insert into public.usuarios (nombres, correo, id_auth, id_rol, fecharegistro)
  select
    'Storage Smoke',
    'storage-smoke@example.test',
    '22222222-2222-4222-8222-222222222222',
    r.id,
    current_date
  from public.roles r
  where lower(r.nombre) = 'administrador'
  limit 1
  returning id
), new_company as (
  insert into public.empresa (nombre, id_auth, id_usuario)
  select
    'Storage Smoke Gym',
    '22222222-2222-4222-8222-222222222222',
    id
  from new_user
  returning id, id_usuario
)
update public.usuarios u
set id_empresa = c.id
from new_company c
where u.id = c.id_usuario;

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","email":"storage-smoke@example.test"}',
  true
);
set local role authenticated;

do $storage_test$
declare
  company_id bigint;
  object_id uuid;
  blocked_other_company boolean := false;
begin
  select u.id_empresa into company_id
  from public.usuarios u
  where u.id_auth = '22222222-2222-4222-8222-222222222222';

  insert into storage.objects (bucket_id, name)
  values ('imagenes', 'empresa/' || company_id::text || '/categorias/1')
  returning id into object_id;

  update storage.objects
  set metadata = '{"smoke_test":true}'::jsonb
  where id = object_id;

  if not exists (select 1 from storage.objects where id = object_id) then
    raise exception 'La empresa no pudo leer su propia imagen';
  end if;

  begin
    insert into storage.objects (bucket_id, name)
    values (
      'imagenes',
      'empresa/' || (company_id + 1)::text || '/categorias/999999'
    );
  exception when insufficient_privilege then
    blocked_other_company := true;
  end;

  if not blocked_other_company then
    raise exception 'La empresa pudo escribir en la ruta de otro tenant';
  end if;

end
$storage_test$;

reset role;
select pass('Storage permite crear, reemplazar y leer el catálogo propio, y bloquea otros tenants');
select * from finish();

rollback;
