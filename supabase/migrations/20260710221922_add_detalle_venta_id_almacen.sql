-- ActiveSelfControl: keep the legacy POS detail RPC in sync with the imported
-- table shape. public.insertardetalleventa receives _id_almacen and inserts it
-- into detalle_venta, but the original dump did not include that column.

alter table public.detalle_venta
  add column if not exists id_almacen bigint;

create index if not exists detalle_venta_id_almacen_idx
  on public.detalle_venta (id_almacen);
