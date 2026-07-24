drop policy if exists "metodos_pago_admin_write" on public.metodos_pago;
drop policy if exists "metodos_pago_admin_insert" on public.metodos_pago;
drop policy if exists "metodos_pago_admin_update" on public.metodos_pago;
drop policy if exists "metodos_pago_admin_delete" on public.metodos_pago;

create policy "metodos_pago_admin_insert"
on public.metodos_pago for insert
to authenticated
with check (id_empresa = (select private.current_empresa_id()) and (select private.is_empresa_admin()));

create policy "metodos_pago_admin_update"
on public.metodos_pago for update
to authenticated
using (id_empresa = (select private.current_empresa_id()) and (select private.is_empresa_admin()))
with check (id_empresa = (select private.current_empresa_id()) and (select private.is_empresa_admin()));

create policy "metodos_pago_admin_delete"
on public.metodos_pago for delete
to authenticated
using (id_empresa = (select private.current_empresa_id()) and (select private.is_empresa_admin()));

drop policy if exists "caja_admin_write" on public.caja;
drop policy if exists "caja_admin_insert" on public.caja;
drop policy if exists "caja_admin_update" on public.caja;
drop policy if exists "caja_admin_delete" on public.caja;

create policy "caja_admin_insert"
on public.caja for insert
to authenticated
with check (
  exists (
    select 1 from public.sucursales s
    where s.id = caja.id_sucursal
      and s.id_empresa = (select private.current_empresa_id())
      and (select private.is_empresa_admin())
  )
);

create policy "caja_admin_update"
on public.caja for update
to authenticated
using (
  exists (
    select 1 from public.sucursales s
    where s.id = caja.id_sucursal
      and s.id_empresa = (select private.current_empresa_id())
      and (select private.is_empresa_admin())
  )
)
with check (
  exists (
    select 1 from public.sucursales s
    where s.id = caja.id_sucursal
      and s.id_empresa = (select private.current_empresa_id())
      and (select private.is_empresa_admin())
  )
);

create policy "caja_admin_delete"
on public.caja for delete
to authenticated
using (
  exists (
    select 1 from public.sucursales s
    where s.id = caja.id_sucursal
      and s.id_empresa = (select private.current_empresa_id())
      and (select private.is_empresa_admin())
  )
);

drop policy if exists "cierrecaja_staff_write" on public.cierrecaja;
drop policy if exists "cierrecaja_staff_insert" on public.cierrecaja;
drop policy if exists "cierrecaja_staff_update" on public.cierrecaja;
drop policy if exists "cierrecaja_staff_delete" on public.cierrecaja;

create policy "cierrecaja_staff_insert"
on public.cierrecaja for insert
to authenticated
with check (
  exists (
    select 1
    from public.caja c
    join public.sucursales s on s.id = c.id_sucursal
    where c.id = cierrecaja.id_caja
      and s.id_empresa = (select private.current_empresa_id())
  )
);

create policy "cierrecaja_staff_update"
on public.cierrecaja for update
to authenticated
using (
  exists (
    select 1
    from public.caja c
    join public.sucursales s on s.id = c.id_sucursal
    where c.id = cierrecaja.id_caja
      and s.id_empresa = (select private.current_empresa_id())
  )
)
with check (
  exists (
    select 1
    from public.caja c
    join public.sucursales s on s.id = c.id_sucursal
    where c.id = cierrecaja.id_caja
      and s.id_empresa = (select private.current_empresa_id())
  )
);

create policy "cierrecaja_staff_delete"
on public.cierrecaja for delete
to authenticated
using (
  exists (
    select 1
    from public.caja c
    join public.sucursales s on s.id = c.id_sucursal
    where c.id = cierrecaja.id_caja
      and s.id_empresa = (select private.current_empresa_id())
  )
);

drop policy if exists "movimientos_caja_staff_write" on public.movimientos_caja;
drop policy if exists "movimientos_caja_staff_insert" on public.movimientos_caja;
drop policy if exists "movimientos_caja_staff_update" on public.movimientos_caja;
drop policy if exists "movimientos_caja_staff_delete" on public.movimientos_caja;

create policy "movimientos_caja_staff_insert"
on public.movimientos_caja for insert
to authenticated
with check (
  exists (
    select 1
    from public.cierrecaja cc
    join public.caja c on c.id = cc.id_caja
    join public.sucursales s on s.id = c.id_sucursal
    where cc.id = movimientos_caja.id_cierre_caja
      and s.id_empresa = (select private.current_empresa_id())
  )
);

create policy "movimientos_caja_staff_update"
on public.movimientos_caja for update
to authenticated
using (
  exists (
    select 1
    from public.cierrecaja cc
    join public.caja c on c.id = cc.id_caja
    join public.sucursales s on s.id = c.id_sucursal
    where cc.id = movimientos_caja.id_cierre_caja
      and s.id_empresa = (select private.current_empresa_id())
  )
)
with check (
  exists (
    select 1
    from public.cierrecaja cc
    join public.caja c on c.id = cc.id_caja
    join public.sucursales s on s.id = c.id_sucursal
    where cc.id = movimientos_caja.id_cierre_caja
      and s.id_empresa = (select private.current_empresa_id())
  )
);

create policy "movimientos_caja_staff_delete"
on public.movimientos_caja for delete
to authenticated
using (
  exists (
    select 1
    from public.cierrecaja cc
    join public.caja c on c.id = cc.id_caja
    join public.sucursales s on s.id = c.id_sucursal
    where cc.id = movimientos_caja.id_cierre_caja
      and s.id_empresa = (select private.current_empresa_id())
  )
);
