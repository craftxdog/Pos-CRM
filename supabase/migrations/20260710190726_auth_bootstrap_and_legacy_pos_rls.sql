insert into public.roles (nombre)
select role_name
from (values ('superadmin'), ('administrador'), ('empleado')) as seed(role_name)
where not exists (
  select 1
  from public.roles r
  where lower(r.nombre) = seed.role_name
);

create or replace function private.bootstrap_current_user()
returns table(usuario_id bigint, empresa_id bigint)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  auth_id uuid := (select auth.uid());
  auth_email text := nullif((select auth.jwt() ->> 'email'), '');
  display_name text := nullif((select auth.jwt() -> 'user_metadata' ->> 'full_name'), '');
  selected_role_id bigint;
begin
  if auth_id is null then
    raise exception 'Auth session is required';
  end if;

  auth_email := coalesce(
    auth_email,
    'invitado-' || replace(auth_id::text, '-', '') || '@activeselfcontrol.local'
  );
  display_name := coalesce(display_name, split_part(auth_email, '@', 1), 'Usuario ASC');

  select u.id, u.id_empresa
  into usuario_id, empresa_id
  from public.usuarios u
  where u.id_auth = auth_id::text
  limit 1;

  if usuario_id is not null then
    if empresa_id is null then
      select e.id
      into empresa_id
      from public.empresa e
      where e.id_auth = auth_id::text
         or e.id_usuario = usuario_id
      order by e.id
      limit 1;

      if empresa_id is not null then
        update public.usuarios
        set id_empresa = empresa_id
        where id = usuario_id;
      end if;
    end if;

    return next;
    return;
  end if;

  select r.id
  into selected_role_id
  from public.roles r
  where lower(r.nombre) = 'superadmin'
  order by r.id
  limit 1;

  if selected_role_id is null then
    insert into public.roles (nombre)
    values ('superadmin')
    returning id into selected_role_id;
  end if;

  insert into public.usuarios (nombres, correo, id_auth, id_rol, fecharegistro)
  values (display_name, auth_email, auth_id::text, selected_role_id, current_date)
  returning id into usuario_id;

  insert into public.empresa (nombre, id_auth, id_usuario, correo)
  values ('ActiveSelfControl', auth_id::text, usuario_id, auth_email)
  on conflict (id_auth) do update
    set id_usuario = excluded.id_usuario,
        correo = excluded.correo
  returning id into empresa_id;

  update public.usuarios
  set id_empresa = empresa_id
  where id = usuario_id;

  return next;
end;
$$;

revoke execute on function private.bootstrap_current_user() from public, anon;
grant execute on function private.bootstrap_current_user() to authenticated;

create or replace function public.bootstrap_current_user()
returns table(usuario_id bigint, empresa_id bigint)
language sql
security invoker
set search_path = ''
as $$
  select * from private.bootstrap_current_user()
$$;

revoke execute on function public.bootstrap_current_user() from public, anon;
grant execute on function public.bootstrap_current_user() to authenticated;

create or replace function private.apply_policy_set(
  target_table regclass,
  policy_prefix text,
  select_predicate text,
  insert_predicate text,
  update_predicate text,
  delete_predicate text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format('drop policy if exists %I on %s', policy_prefix || '_select', target_table);
  execute format('drop policy if exists %I on %s', policy_prefix || '_insert', target_table);
  execute format('drop policy if exists %I on %s', policy_prefix || '_update', target_table);
  execute format('drop policy if exists %I on %s', policy_prefix || '_delete', target_table);

  execute format(
    'create policy %I on %s for select to authenticated using (%s)',
    policy_prefix || '_select',
    target_table,
    select_predicate
  );
  execute format(
    'create policy %I on %s for insert to authenticated with check (%s)',
    policy_prefix || '_insert',
    target_table,
    insert_predicate
  );
  execute format(
    'create policy %I on %s for update to authenticated using (%s) with check (%s)',
    policy_prefix || '_update',
    target_table,
    update_predicate,
    update_predicate
  );
  execute format(
    'create policy %I on %s for delete to authenticated using (%s)',
    policy_prefix || '_delete',
    target_table,
    delete_predicate
  );
end;
$$;

drop policy if exists "roles_authenticated_select" on public.roles;
create policy "roles_authenticated_select"
on public.roles for select
to authenticated
using (true);

select private.apply_policy_set(
  'public.empresa',
  'empresa_current_company',
  'id = (select private.current_empresa_id()) or id_auth = (select auth.uid())::text',
  'id_auth = (select auth.uid())::text',
  'id = (select private.current_empresa_id()) or id_auth = (select auth.uid())::text',
  'id = (select private.current_empresa_id()) and (select private.is_empresa_admin())'
);

select private.apply_policy_set(
  'public.usuarios',
  'usuarios_current_company',
  'id_auth = (select auth.uid())::text or id_empresa = (select private.current_empresa_id())',
  'id_auth = (select auth.uid())::text or (id_empresa = (select private.current_empresa_id()) and (select private.is_empresa_admin()))',
  'id_auth = (select auth.uid())::text or (id_empresa = (select private.current_empresa_id()) and (select private.is_empresa_admin()))',
  'id_empresa = (select private.current_empresa_id()) and (select private.is_empresa_admin())'
);

select private.apply_policy_set(
  'public.sucursales',
  'sucursales_current_company',
  'id_empresa = (select private.current_empresa_id())',
  'id_empresa = (select private.current_empresa_id()) and (select private.is_empresa_admin())',
  'id_empresa = (select private.current_empresa_id()) and (select private.is_empresa_admin())',
  'id_empresa = (select private.current_empresa_id()) and (select private.is_empresa_admin())'
);

select private.apply_policy_set(
  'public.asignacion_sucursal',
  'asignacion_sucursal_current_company',
  'exists (select 1 from public.sucursales s where s.id = asignacion_sucursal.id_sucursal and s.id_empresa = (select private.current_empresa_id()))',
  'exists (select 1 from public.sucursales s where s.id = asignacion_sucursal.id_sucursal and s.id_empresa = (select private.current_empresa_id())) and (select private.is_empresa_admin())',
  'exists (select 1 from public.sucursales s where s.id = asignacion_sucursal.id_sucursal and s.id_empresa = (select private.current_empresa_id())) and (select private.is_empresa_admin())',
  'exists (select 1 from public.sucursales s where s.id = asignacion_sucursal.id_sucursal and s.id_empresa = (select private.current_empresa_id())) and (select private.is_empresa_admin())'
);

select private.apply_policy_set(
  'public.tipodocumento',
  'tipodocumento_current_company',
  'id_empresa = (select private.current_empresa_id())',
  'id_empresa = (select private.current_empresa_id())',
  'id_empresa = (select private.current_empresa_id())',
  'id_empresa = (select private.current_empresa_id()) and (select private.is_empresa_admin())'
);

select private.apply_policy_set(
  'public.clientes',
  'clientes_current_company',
  'id_empresa = (select private.current_empresa_id())',
  'id_empresa = (select private.current_empresa_id())',
  'id_empresa = (select private.current_empresa_id())',
  'id_empresa = (select private.current_empresa_id())'
);

select private.apply_policy_set(
  'public.productos',
  'productos_current_company',
  'id_empresa = (select private.current_empresa_id())',
  'id_empresa = (select private.current_empresa_id())',
  'id_empresa = (select private.current_empresa_id())',
  'id_empresa = (select private.current_empresa_id())'
);

select private.apply_policy_set(
  'public.almacenes',
  'almacenes_current_company',
  'exists (select 1 from public.sucursales s where s.id = almacenes.id_sucursal and s.id_empresa = (select private.current_empresa_id()))',
  'exists (select 1 from public.sucursales s where s.id = almacenes.id_sucursal and s.id_empresa = (select private.current_empresa_id()))',
  'exists (select 1 from public.sucursales s where s.id = almacenes.id_sucursal and s.id_empresa = (select private.current_empresa_id()))',
  'exists (select 1 from public.sucursales s where s.id = almacenes.id_sucursal and s.id_empresa = (select private.current_empresa_id()))'
);

select private.apply_policy_set(
  'public.multiprecios',
  'multiprecios_current_company',
  'exists (select 1 from public.productos p where p.id = multiprecios.id_producto and p.id_empresa = (select private.current_empresa_id()))',
  'exists (select 1 from public.productos p where p.id = multiprecios.id_producto and p.id_empresa = (select private.current_empresa_id()))',
  'exists (select 1 from public.productos p where p.id = multiprecios.id_producto and p.id_empresa = (select private.current_empresa_id()))',
  'exists (select 1 from public.productos p where p.id = multiprecios.id_producto and p.id_empresa = (select private.current_empresa_id()))'
);

select private.apply_policy_set(
  'public.ventas',
  'ventas_current_company',
  'id_empresa = (select private.current_empresa_id())',
  'id_empresa = (select private.current_empresa_id())',
  'id_empresa = (select private.current_empresa_id())',
  'id_empresa = (select private.current_empresa_id())'
);

select private.apply_policy_set(
  'public.detalle_venta',
  'detalle_venta_current_company',
  'exists (select 1 from public.ventas v where v.id = detalle_venta.id_venta and v.id_empresa = (select private.current_empresa_id()))',
  'exists (select 1 from public.ventas v where v.id = detalle_venta.id_venta and v.id_empresa = (select private.current_empresa_id()))',
  'exists (select 1 from public.ventas v where v.id = detalle_venta.id_venta and v.id_empresa = (select private.current_empresa_id()))',
  'exists (select 1 from public.ventas v where v.id = detalle_venta.id_venta and v.id_empresa = (select private.current_empresa_id()))'
);

select private.apply_policy_set(
  'public.kardex',
  'kardex_current_company',
  'exists (select 1 from public.productos p where p.id = kardex.id_producto and p.id_empresa = (select private.current_empresa_id())) or id_usuario = (select private.current_usuario_id())',
  'exists (select 1 from public.productos p where p.id = kardex.id_producto and p.id_empresa = (select private.current_empresa_id())) or id_usuario = (select private.current_usuario_id())',
  'exists (select 1 from public.productos p where p.id = kardex.id_producto and p.id_empresa = (select private.current_empresa_id())) or id_usuario = (select private.current_usuario_id())',
  'exists (select 1 from public.productos p where p.id = kardex.id_producto and p.id_empresa = (select private.current_empresa_id())) or id_usuario = (select private.current_usuario_id())'
);

drop function private.apply_policy_set(regclass, text, text, text, text, text);

notify pgrst, 'reload schema';
