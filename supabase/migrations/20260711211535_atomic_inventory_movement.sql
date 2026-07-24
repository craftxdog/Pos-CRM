create or replace function public.registrar_movimiento_inventario(
  _id_empresa bigint,
  _id_almacen bigint,
  _id_producto bigint,
  _id_stock bigint,
  _tipo_movimiento text,
  _cantidad numeric,
  _fecha timestamp with time zone,
  _detalle text,
  _origen text,
  _creado_por bigint,
  _precio_compra numeric,
  _precio_venta numeric
)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  movimiento_id bigint;
  stock_actual numeric;
begin
  if _cantidad is null or _cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor que cero';
  end if;
  if _tipo_movimiento not in ('ingreso', 'salida') then
    raise exception 'Tipo de movimiento inválido';
  end if;
  if _id_empresa <> (select private.current_empresa_id()) then
    raise exception 'La empresa no corresponde a la sesión';
  end if;

  select stock into stock_actual
  from public.almacenes
  where id = _id_stock and id_almacen = _id_almacen and id_producto = _id_producto
  for update;
  if not found then raise exception 'No existe stock para el producto y almacén'; end if;
  if _tipo_movimiento = 'salida' and coalesce(stock_actual, 0) < _cantidad then
    raise exception 'Stock insuficiente. Disponible: %', coalesce(stock_actual, 0);
  end if;

  update public.almacenes
  set stock = case when _tipo_movimiento = 'ingreso'
    then coalesce(stock, 0) + _cantidad else coalesce(stock, 0) - _cantidad end
  where id = _id_stock;

  update public.productos
  set precio_compra = _precio_compra, precio_venta = _precio_venta
  where id = _id_producto and id_empresa = _id_empresa;
  if not found then raise exception 'Producto inválido para la empresa'; end if;

  insert into public.movimientos_stock (
    id_empresa, id_almacen, id_producto, tipo_movimiento, cantidad,
    fecha, detalle, origen, creado_por
  ) values (
    _id_empresa, _id_almacen, _id_producto, _tipo_movimiento, _cantidad,
    coalesce(_fecha, now()), _detalle, coalesce(_origen, 'inventario'), _creado_por
  ) returning id into movimiento_id;

  return movimiento_id;
end;
$$;

revoke execute on function public.registrar_movimiento_inventario(
  bigint, bigint, bigint, bigint, text, numeric, timestamp with time zone,
  text, text, bigint, numeric, numeric
) from public, anon;
grant execute on function public.registrar_movimiento_inventario(
  bigint, bigint, bigint, bigint, text, numeric, timestamp with time zone,
  text, text, bigint, numeric, numeric
) to authenticated;
