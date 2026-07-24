import { useQuery } from "@tanstack/react-query";
import { ConfiguracionesTemplate, Spinner1, useUsuariosStore } from "../index";
import { useModulosStore } from "../store/ModulosStore";
import { usePermisosStore } from "../store/PermisosStore";

const CONFIGURATION_MODULES = [
  {
    id: "cfg-empresa",
    nombre: "Empresa",
    descripcion: "Datos, moneda, logo y parametros generales",
    icono: "mdi:office-building-cog",
    link: "/configuracion/empresa",
    etiquetas: "#configuracion",
    grupo: "administracion",
    orden: 10,
    check: true,
  },
  {
    id: "cfg-usuarios",
    nombre: "Usuarios y roles",
    descripcion: "Usuarios, cargos, accesos y permisos",
    icono: "mdi:account-group",
    link: "/configuracion/usuarios",
    etiquetas: "#configuracion",
    grupo: "administracion",
    orden: 20,
    check: true,
  },
  {
    id: "cfg-sucursales",
    nombre: "Sucursales y cajas",
    descripcion: "Puntos de venta, cajas y asignaciones",
    icono: "mdi:store-cog",
    link: "/configuracion/sucursalcaja",
    etiquetas: "#configuracion",
    grupo: "operacion",
    orden: 30,
    check: true,
  },
  {
    id: "cfg-almacenes",
    nombre: "Almacenes",
    descripcion: "Stock por sucursal y control operativo",
    icono: "mdi:warehouse",
    link: "/configuracion/almacenes",
    etiquetas: "#configuracion",
    grupo: "inventario",
    orden: 40,
    check: true,
  },
  {
    id: "cfg-productos",
    nombre: "Productos",
    descripcion: "Catalogo, precios, codigos e inventario",
    icono: "mdi:package-variant-closed",
    link: "/configuracion/productos",
    etiquetas: "#configuracion",
    grupo: "inventario",
    orden: 50,
    check: true,
  },
  {
    id: "cfg-categorias",
    nombre: "Categorias",
    descripcion: "Organizacion del catalogo de venta",
    icono: "mdi:shape",
    link: "/configuracion/categorias",
    etiquetas: "#configuracion",
    grupo: "inventario",
    orden: 60,
    check: true,
  },
  {
    id: "cfg-clientes",
    nombre: "Clientes POS",
    descripcion: "Clientes y datos comerciales del POS",
    icono: "mdi:account-box",
    link: "/configuracion/clientes",
    etiquetas: "#configuracion",
    grupo: "operacion",
    orden: 70,
    check: true,
  },
  {
    id: "cfg-proveedores",
    nombre: "Proveedores",
    descripcion: "Contactos y referencias de compra",
    icono: "mdi:truck-delivery",
    link: "/configuracion/proveedores",
    etiquetas: "#configuracion",
    grupo: "inventario",
    orden: 80,
    check: true,
  },
  {
    id: "cfg-pagos",
    nombre: "Metodos de pago",
    descripcion: "Efectivo, tarjetas, transferencias y otros metodos",
    icono: "mdi:credit-card-cog",
    link: "/configuracion/metodospago",
    etiquetas: "#configuracion",
    grupo: "pos",
    orden: 90,
    check: true,
  },
  {
    id: "cfg-impresoras",
    nombre: "Impresoras",
    descripcion: "Impresion y dispositivos de caja",
    icono: "mdi:printer",
    link: "/configuracion/impresoras",
    etiquetas: "#configuracion",
    grupo: "pos",
    orden: 100,
    check: true,
  },
  {
    id: "cfg-ticket",
    nombre: "Ticket",
    descripcion: "Formato del comprobante de venta",
    icono: "mdi:receipt-text-cog",
    link: "/configuracion/ticket",
    etiquetas: "#configuracion",
    grupo: "pos",
    orden: 110,
    check: true,
  },
  {
    id: "cfg-serializacion",
    nombre: "Serializacion",
    descripcion: "Numeracion de comprobantes y documentos",
    icono: "mdi:numeric",
    link: "/configuracion/serializacion",
    etiquetas: "#configuracion",
    grupo: "pos",
    orden: 120,
    check: true,
  },
  {
    id: "cfg-crm",
    nombre: "CRM",
    descripcion: "Clientes, pagos, horarios, permisos y WhatsApp",
    icono: "mdi:account-supervisor-circle",
    link: "/crm",
    etiquetas: "#configuracion",
    grupo: "crm",
    orden: 130,
    check: true,
  },
  {
    id: "cfg-crm-whatsapp",
    nombre: "WhatsApp CRM",
    descripcion: "Cobros, facturas, bienvenidas y vencimientos",
    icono: "logos:whatsapp-icon",
    link: "/crm/whatsapp",
    etiquetas: "#configuracion",
    grupo: "crm",
    orden: 140,
    check: true,
  },
];

function normalizeModule(item) {
  return item?.modulos || item;
}

function isConfigurationModule(modulo) {
  if (!modulo?.link || modulo.link === "/configuracion/crm") return false;
  return modulo.etiquetas === "#configuracion" || modulo.link.startsWith("/configuracion/");
}

function mergeModules(baseModules, dbModules) {
  const map = new Map();
  [...baseModules, ...(dbModules || []).filter(isConfigurationModule)].forEach((item) => {
    const modulo = normalizeModule(item);
    if (!modulo?.link) return;
    map.set(modulo.link, { ...map.get(modulo.link), ...modulo, check: modulo.check ?? true });
  });
  return Array.from(map.values()).sort((a, b) => (a.orden || 999) - (b.orden || 999));
}

export function Configuraciones() {
  const { datausuarios } = useUsuariosStore();
  const { mostrarPermisosConfiguracion } = usePermisosStore();
  const { dataModulos, mostrarModulos } = useModulosStore();
  const isAdmin = ["superadmin", "administrador", "admin"].includes(
    datausuarios?.roles?.nombre?.toLowerCase()
  );

  const { isLoading, error } = useQuery({
    queryKey: ["mostrar permisos configuracion", datausuarios?.id],
    queryFn: () => mostrarPermisosConfiguracion({ id_usuario: datausuarios?.id }),
    enabled: !!datausuarios?.id && !isAdmin,
    refetchOnWindowFocus: false,
  });

  const modulosQuery = useQuery({
    queryKey: ["mostrar modulos configuracion"],
    queryFn: mostrarModulos,
    enabled: !!datausuarios?.id && isAdmin,
    refetchOnWindowFocus: false,
  });

  if (isLoading || modulosQuery.isLoading) {
    return <Spinner1 />;
  }

  if (error || modulosQuery.error) {
    return <span>error...{error?.message || modulosQuery.error?.message}</span>;
  }

  const adminItems = mergeModules(CONFIGURATION_MODULES, dataModulos);

  return <ConfiguracionesTemplate items={isAdmin ? adminItems : undefined} />;
}
