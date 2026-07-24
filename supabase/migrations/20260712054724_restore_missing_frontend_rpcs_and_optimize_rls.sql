-- Restore RPC contracts already consumed by the frontend. All routines remain
-- SECURITY INVOKER so table RLS is enforced for the calling user.

create or replace function public.editarcantidaddv(
  _id bigint,
  _cantidad numeric
) returns void
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if _cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor que cero';
  end if;

  update public.detalle_venta dv
  set cantidad = _cantidad,
      total = _cantidad * dv.precio_venta
  where dv.id = _id;

  if not found then
    raise exception 'Detalle de venta no encontrado o sin permisos';
  end if;
end;
$function$;

create or replace function public.report_stock_por_almacen_sucursal(
  sucursal_id bigint,
  almacen_id bigint
) returns table (
  codigo_articulo text,
  descripcion_articulo text,
  stock numeric,
  stock_minimo numeric,
  precio_costo numeric,
  total numeric
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    coalesce(p.codigo_interno, p.codigo_barras, p.id::text),
    p.nombre,
    s.stock,
    s.stock_minimo,
    p.precio_compra,
    s.stock * p.precio_compra
  from public.almacenes s
  join public.productos p on p.id = s.id_producto
  where s.id_sucursal = sucursal_id
    and s.id_almacen = almacen_id
  order by p.nombre;
$function$;

create or replace function public.report_stock_bajo_minimo(
  sucursal_id bigint,
  almacen_id bigint
) returns table (
  codigo_articulo text,
  descripcion_articulo text,
  stock numeric,
  stock_minimo numeric,
  precio_costo numeric,
  total numeric
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    coalesce(p.codigo_interno, p.codigo_barras, p.id::text),
    p.nombre,
    s.stock,
    s.stock_minimo,
    p.precio_compra,
    s.stock * p.precio_compra
  from public.almacenes s
  join public.productos p on p.id = s.id_producto
  where s.id_sucursal = sucursal_id
    and s.id_almacen = almacen_id
    and s.stock <= s.stock_minimo
  order by p.nombre;
$function$;

create or replace function public.report_ventas_por_sucursal(
  sucursal_id bigint,
  fecha_inicio date,
  fecha_fin date
) returns table (
  id_venta bigint,
  fecha date,
  monto_total numeric,
  total_impuestos numeric,
  subtotal numeric,
  pago_con text,
  cantidad_productos bigint,
  cajero text,
  estado text
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    v.id,
    v.fecha,
    v.monto_total,
    v.total_impuestos,
    v.sub_total,
    v.tipo_de_pago,
    v.cantidad_productos,
    coalesce(u.nombres, 'Sin asignar'),
    v.estado
  from public.ventas v
  left join public.usuarios u on u.id = v.id_usuario
  where v.id_sucursal = sucursal_id
    and v.fecha between fecha_inicio and fecha_fin
  order by v.fecha desc, v.id desc;
$function$;

revoke all on function public.editarcantidaddv(bigint, numeric) from public, anon;
revoke all on function public.report_stock_por_almacen_sucursal(bigint, bigint) from public, anon;
revoke all on function public.report_stock_bajo_minimo(bigint, bigint) from public, anon;
revoke all on function public.report_ventas_por_sucursal(bigint, date, date) from public, anon;

grant execute on function public.editarcantidaddv(bigint, numeric) to authenticated;
grant execute on function public.report_stock_por_almacen_sucursal(bigint, bigint) to authenticated;
grant execute on function public.report_stock_bajo_minimo(bigint, bigint) to authenticated;
grant execute on function public.report_ventas_por_sucursal(bigint, date, date) to authenticated;
