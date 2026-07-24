with config_modules(nombre, descripcion, icono, link, etiquetas, "check") as (
  values
    ('Empresa', 'Datos, moneda, logo y parametros generales', 'mdi:office-building-cog', '/configuracion/empresa', '#configuracion', true),
    ('Usuarios y roles', 'Usuarios, cargos, accesos y permisos', 'mdi:account-group', '/configuracion/usuarios', '#configuracion', true),
    ('Sucursales y cajas', 'Puntos de venta, cajas y asignaciones', 'mdi:store-cog', '/configuracion/sucursalcaja', '#configuracion', true),
    ('Almacenes', 'Stock por sucursal y control operativo', 'mdi:warehouse', '/configuracion/almacenes', '#configuracion', true),
    ('Productos', 'Catalogo, precios, codigos e inventario', 'mdi:package-variant-closed', '/configuracion/productos', '#configuracion', true),
    ('Categorias', 'Organizacion del catalogo de venta', 'mdi:shape', '/configuracion/categorias', '#configuracion', true),
    ('Clientes POS', 'Clientes y datos comerciales del POS', 'mdi:account-box', '/configuracion/clientes', '#configuracion', true),
    ('Proveedores', 'Contactos y referencias de compra', 'mdi:truck-delivery', '/configuracion/proveedores', '#configuracion', true),
    ('Metodos de pago', 'Efectivo, tarjetas, transferencias y otros metodos', 'mdi:credit-card-cog', '/configuracion/metodospago', '#configuracion', true),
    ('Impresoras', 'Impresion y dispositivos de caja', 'mdi:printer', '/configuracion/impresoras', '#configuracion', true),
    ('Ticket', 'Formato del comprobante de venta', 'mdi:receipt-text-cog', '/configuracion/ticket', '#configuracion', true),
    ('Serializacion', 'Numeracion de comprobantes y documentos', 'mdi:numeric', '/configuracion/serializacion', '#configuracion', true),
    ('Configurar CRM', 'Clientes, pagos, horarios, permisos y WhatsApp', 'mdi:account-supervisor-circle', '/configuracion/crm', '#configuracion', true)
)
insert into public.modulos (nombre, descripcion, icono, link, etiquetas, "check")
select nombre, descripcion, icono, link, etiquetas, "check"
from config_modules cm
where not exists (
  select 1
  from public.modulos m
  where m.link = cm.link
);

with config_modules(nombre, descripcion, icono, link, etiquetas, "check") as (
  values
    ('Empresa', 'Datos, moneda, logo y parametros generales', 'mdi:office-building-cog', '/configuracion/empresa', '#configuracion', true),
    ('Usuarios y roles', 'Usuarios, cargos, accesos y permisos', 'mdi:account-group', '/configuracion/usuarios', '#configuracion', true),
    ('Sucursales y cajas', 'Puntos de venta, cajas y asignaciones', 'mdi:store-cog', '/configuracion/sucursalcaja', '#configuracion', true),
    ('Almacenes', 'Stock por sucursal y control operativo', 'mdi:warehouse', '/configuracion/almacenes', '#configuracion', true),
    ('Productos', 'Catalogo, precios, codigos e inventario', 'mdi:package-variant-closed', '/configuracion/productos', '#configuracion', true),
    ('Categorias', 'Organizacion del catalogo de venta', 'mdi:shape', '/configuracion/categorias', '#configuracion', true),
    ('Clientes POS', 'Clientes y datos comerciales del POS', 'mdi:account-box', '/configuracion/clientes', '#configuracion', true),
    ('Proveedores', 'Contactos y referencias de compra', 'mdi:truck-delivery', '/configuracion/proveedores', '#configuracion', true),
    ('Metodos de pago', 'Efectivo, tarjetas, transferencias y otros metodos', 'mdi:credit-card-cog', '/configuracion/metodospago', '#configuracion', true),
    ('Impresoras', 'Impresion y dispositivos de caja', 'mdi:printer', '/configuracion/impresoras', '#configuracion', true),
    ('Ticket', 'Formato del comprobante de venta', 'mdi:receipt-text-cog', '/configuracion/ticket', '#configuracion', true),
    ('Serializacion', 'Numeracion de comprobantes y documentos', 'mdi:numeric', '/configuracion/serializacion', '#configuracion', true),
    ('Configurar CRM', 'Clientes, pagos, horarios, permisos y WhatsApp', 'mdi:account-supervisor-circle', '/configuracion/crm', '#configuracion', true)
)
update public.modulos m
set
  nombre = cm.nombre,
  descripcion = cm.descripcion,
  icono = cm.icono,
  etiquetas = cm.etiquetas,
  "check" = cm."check"
from config_modules cm
where m.link = cm.link;
