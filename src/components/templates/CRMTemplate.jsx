import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  FiActivity,
  FiAlertCircle,
  FiCalendar,
  FiCheckCircle,
  FiCreditCard,
  FiEdit3,
  FiEye,
  FiFileText,
  FiLayers,
  FiLock,
  FiMail,
  FiMessageCircle,
  FiPlusCircle,
  FiPrinter,
  FiSearch,
  FiSend,
  FiShield,
  FiTrash2,
  FiTrendingUp,
  FiUsers,
  FiXCircle,
} from "react-icons/fi";
import { MdOutlineBadge, MdOutlinePointOfSale } from "react-icons/md";
import { toast, Toaster } from "sonner";
import { useCrmStore } from "../../store/CrmStore";
import { useEmpresaStore } from "../../store/EmpresaStore";
import { useUsuariosStore } from "../../store/UsuariosStore";
import { CrmAttendanceWorkspace } from "../organismos/CRMDesign/CrmAttendanceWorkspace";
import { CrmClientsWorkspace } from "../organismos/CRMDesign/CrmClientsWorkspace";
import { CrmPaymentsWorkspace } from "../organismos/CRMDesign/CrmPaymentsWorkspace";
import { CrmSubscriptionsWorkspace } from "../organismos/CRMDesign/CrmSubscriptionsWorkspace";
import FacturaCliente from "../../reports/FacturaCliente";
import { v } from "../../styles/variables";

const tabs = [
  { id: "procesos", label: "Procesos", icon: FiActivity },
  { id: "clientes", label: "Clientes", icon: FiUsers },
  { id: "suscripciones", label: "Suscripciones", icon: FiLayers },
  { id: "pagos", label: "Pagos", icon: FiCreditCard },
  { id: "horarios", label: "Horarios", icon: FiCalendar },
  { id: "trabajadores", label: "Trabajadores", icon: MdOutlineBadge },
  { id: "whatsapp", label: "WhatsApp", icon: FiMessageCircle },
  { id: "permisos", label: "Permisos", icon: FiLock },
];

const whatsappTypes = [
  { id: "bienvenida", label: "Bienvenida" },
  { id: "cobro", label: "Nota de cobro" },
  { id: "factura", label: "Factura electronica" },
  { id: "suscripcion_por_vencer", label: "Suscripcion por vencer" },
  { id: "manual", label: "Manual" },
];

const chartColors = ["#F3D20C", "#16a34a", "#38bdf8", "#d97706", "#f97316", "#ef4444"];

const statusLabels = {
  prospecto: "Prospectos",
  activo: "Activos",
  inactivo: "Inactivos",
  suspendido: "Suspendidos",
  pagado: "Pagados",
  pendiente: "Pendientes",
  vencido: "Vencidos",
  anulado: "Anulados",
  activa: "Activas",
  cancelada: "Canceladas",
  finalizada: "Finalizadas",
  presente: "Presentes",
  tarde: "Tardes",
  ausente: "Ausentes",
  salida_registrada: "Salidas",
  borrador: "Borradores",
  enviado: "Enviados",
  aceptada: "Aceptadas",
  expirada: "Expiradas",
  cancelado: "Cancelados",
  por_vencer: "Próximas a vencer",
  morosa: "Morosas",
  error: "Con error",
  conectado: "Conectado",
  pausado: "Pausado",
};

const actionMessages = {
  cliente: "Cliente guardado",
  editar_cliente: "Cliente actualizado",
  invitacion: "Invitación enviada por correo",
  cancelar_invitacion: "Invitación cancelada",
  plan: "Plan creado",
  facturar_suscripcion: "Factura creada",
  suscripcion: "Suscripcion asignada",
  pago: "Pago registrado",
  horario: "Horario creado",
  asistencia: "Asistencia registrada",
  cargo: "Cargo creado",
  trabajador: "Trabajador guardado",
  empresa_modulo: "Modulo actualizado",
  rol_modulo: "Permisos actualizados",
  whatsapp_config: "Conexion guardada",
  whatsapp_plantilla: "Plantilla guardada",
  whatsapp_automatizacion: "Automatizacion guardada",
  whatsapp_mensaje: "Mensaje preparado",
  whatsapp_mensaje_estado: "Mensaje actualizado",
  whatsapp_despachar: "Mensaje enviado a la API",
};

function money(value, currency = "USD", iso = "en-US") {
  try {
    return new Intl.NumberFormat(iso || "en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(Number(value || 0));
  } catch {
    return `${currency || "USD"} ${Number(value || 0).toFixed(2)}`;
  }
}

function readForm(event) {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.currentTarget).entries());
}

function fullName(item) {
  return [item?.nombres, item?.apellidos].filter(Boolean).join(" ");
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + Math.max(0, Number(days || 30) - 1));
  return next.toISOString().slice(0, 10);
}

function dateOnly(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function isBeforeToday(value, today) {
  const parsed = dateOnly(value);
  return parsed ? parsed < today : false;
}

function isWithinDays(value, days) {
  if (!value) return false;
  const target = new Date(value);
  const today = new Date();
  const limit = new Date();
  limit.setDate(today.getDate() + days);
  return target >= today && target <= limit;
}

function cleanPhone(phone, defaultCountryCode = "1") {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) {
    return `+${raw.replace(/\D/g, "")}`;
  }
  const digits = raw.replace(/\D/g, "");
  const countryCode = String(defaultCountryCode || "1").replace(/\D/g, "") || "1";
  if (!digits) return "";
  return digits.startsWith(countryCode) ? `+${digits}` : `+${countryCode}${digits}`;
}

function renderTemplate(template, variables) {
  return String(template || "").replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, key) => {
    const value = variables[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function whatsappHref(destino, cuerpo) {
  const digits = String(destino || "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(cuerpo || "")}`;
}

function daysUntil(value) {
  if (!value) return "";
  const today = new Date();
  const target = new Date(`${dateOnly(value)}T00:00:00`);
  const diff = target.getTime() - today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function labelFor(value) {
  return statusLabels[value] || String(value || "Sin dato");
}

function invitationState(item) {
  if (item.estado === "aceptada") return { key: "aceptada", label: "Aceptada" };
  if (item.estado === "cancelada") return { key: "cancelada", label: "Cancelada" };
  if (item.estado === "expirada" || new Date(item.expires_at) < new Date()) {
    return { key: "expirada", label: "Expirada" };
  }
  if (item.estado_envio === "error" || item.ultimo_error_email) {
    return { key: "error", label: "Error de envío" };
  }
  if (item.estado_envio === "enviado" || item.email_enviado_at) {
    return { key: "enviada", label: "Enviada · esperando registro" };
  }
  return { key: "pendiente", label: "Preparando envío" };
}

function countBy(items, key, expected = []) {
  const totals = new Map(expected.map((item) => [item, 0]));
  items.forEach((item) => {
    const value = item?.[key] || "sin_dato";
    totals.set(value, (totals.get(value) || 0) + 1);
  });
  return Array.from(totals, ([name, value]) => ({
    name: labelFor(name),
    raw: name,
    value,
  }));
}

function buildRevenueTrend(pagos) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = date.toISOString().slice(0, 7);
    return {
      key,
      name: date.toLocaleDateString("es", { month: "short" }),
      ingresos: 0,
      pagos: 0,
    };
  });

  pagos.forEach((pago) => {
    const key = dateOnly(pago.fecha_pago || pago.created_at)?.slice(0, 7);
    const bucket = months.find((item) => item.key === key);
    if (!bucket) return;
    bucket.pagos += 1;
    if (pago.estado === "pagado") {
      bucket.ingresos += Number(pago.monto || 0);
    }
  });

  return months;
}

function hasChartData(data, key = "value") {
  return Array.isArray(data) && data.some((item) => Number(item?.[key] || 0) > 0);
}

function MetricCard({ label, value, detail, tone = "neutral" }) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}

function ChartCard({ title, subtitle, children, empty = false }) {
  return (
    <article className="chart-card">
      <header>
        <h3>{title}</h3>
        {subtitle && <span>{subtitle}</span>}
      </header>
      <div className="chart-body">
        {empty ? <p className="empty chart-empty">Sin datos suficientes.</p> : children}
      </div>
    </article>
  );
}

export function CRMTemplate({ initialTab = "procesos" }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [search, setSearch] = useState("");
  const [clientStatusFilter, setClientStatusFilter] = useState("todos");
  const [clientPage, setClientPage] = useState(1);
  const [paymentClientId, setPaymentClientId] = useState("");
  const queryClient = useQueryClient();
  const { dataempresa } = useEmpresaStore();
  const { datausuarios } = useUsuariosStore();
  const crm = useCrmStore();

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const query = useQuery({
    queryKey: ["crm-data", dataempresa?.id],
    queryFn: () => crm.cargarCrm({ id_empresa: dataempresa.id }),
    enabled: !!dataempresa?.id,
    refetchOnWindowFocus: false,
  });

  const mutation = useMutation({
    mutationFn: async ({ action, values }) => {
      const id_empresa = dataempresa.id;
      const registrado_por = datausuarios?.id || null;

      if (action === "cliente") {
        return crm.insertarCliente({
          id_empresa,
          nombres: values.nombres,
          apellidos: values.apellidos || null,
          email: values.email || null,
          telefono: values.telefono || null,
          direccion: values.direccion || null,
          identificador_nacional: values.identificador_nacional || null,
          identificador_fiscal: values.identificador_fiscal || null,
          estado: values.estado || "activo",
          origen: "manual",
          creado_por: registrado_por,
          notas: values.notas || null,
        });
      }

      if (action === "editar_cliente") {
        return crm.editarCliente({
          id: Number(values.id),
          nombres: values.nombres,
          apellidos: values.apellidos || null,
          email: values.email || null,
          telefono: values.telefono || null,
          direccion: values.direccion || null,
          estado: values.estado || "activo",
        });
      }

      if (action === "invitacion") {
        return crm.enviarInvitacion({
          id_empresa,
          email: values.email,
          id_plan: values.id_plan,
        });
      }

      if (action === "cancelar_invitacion") {
        return crm.cancelarInvitacion({
          id: values.id,
          id_empresa,
        });
      }

      if (action === "plan") {
        return crm.insertarPlan({
          id_empresa,
          nombre: values.nombre,
          descripcion: values.descripcion || null,
          precio: Number(values.precio || 0),
          periodicidad: values.periodicidad,
          duracion_dias: Number(values.duracion_dias || 30),
          activo: true,
        });
      }

      if (action === "suscripcion") {
        const plan = crm.planes.find((item) => String(item.id) === values.id_plan);
        const fecha_inicio = values.fecha_inicio || new Date().toISOString().slice(0, 10);
        return crm.insertarSuscripcion({
          id_empresa,
          id_cliente_crm: Number(values.id_cliente_crm),
          id_plan: Number(values.id_plan),
          fecha_inicio,
          fecha_fin: values.fecha_fin || addDays(fecha_inicio, plan?.duracion_dias || 30),
          precio_pactado: Number(values.precio_pactado || plan?.precio || 0),
          auto_renovar: values.auto_renovar === "on",
          estado: "activa",
        });
      }

      if (action === "pago") {
        return crm.insertarPago({
          id_empresa,
          id_cliente_crm: Number(values.id_cliente_crm),
          id_suscripcion: values.id_suscripcion ? Number(values.id_suscripcion) : null,
          monto: Number(values.monto || 0),
          moneda: dataempresa?.currency || "USD",
          metodo_pago: values.metodo_pago || null,
          referencia: values.referencia || null,
          fecha_pago: values.estado === "pagado" ? new Date().toISOString() : null,
          fecha_vencimiento: values.fecha_vencimiento || null,
          estado: values.estado || "pendiente",
          registrado_por,
          notas: values.notas || null,
        });
      }

      if (action === "facturar_suscripcion") {
        return crm.facturarSuscripcion({
          id_suscripcion: values.id_suscripcion,
          estado: values.estado,
          metodo_pago: values.metodo_pago,
          notas: values.notas,
        });
      }

      if (action === "horario") {
        return crm.insertarHorario({
          id_empresa,
          nombre: values.nombre,
          hora_entrada: values.hora_entrada,
          hora_salida: values.hora_salida,
          tolerancia_minutos: Number(values.tolerancia_minutos || 10),
          dias_semana: [1, 2, 3, 4, 5],
          activo: true,
        });
      }

      if (action === "asistencia") {
        const now = new Date().toISOString();
        return crm.insertarAsistencia({
          id_empresa,
          id_cliente_crm: Number(values.id_cliente_crm),
          id_horario: values.id_horario ? Number(values.id_horario) : null,
          fecha: values.fecha || new Date().toISOString().slice(0, 10),
          hora_entrada: values.tipo_registro === "entrada" ? now : null,
          hora_salida: values.tipo_registro === "salida" ? now : null,
          estado: values.estado || "presente",
          registrado_por,
          notas: values.notas || null,
        });
      }

      if (action === "cargo") {
        return crm.insertarCargo({
          id_empresa,
          nombre: values.nombre,
          descripcion: values.descripcion || null,
          activo: true,
        });
      }

      if (action === "trabajador") {
        return crm.insertarTrabajador({
          id_empresa,
          id_cargo: values.id_cargo ? Number(values.id_cargo) : null,
          id_horario: values.id_horario ? Number(values.id_horario) : null,
          nombres: values.nombres,
          email: values.email || null,
          telefono: values.telefono || null,
          fecha_ingreso: values.fecha_ingreso || new Date().toISOString().slice(0, 10),
          salario: values.salario ? Number(values.salario) : null,
          estado: "activo",
          notas: values.notas || null,
        });
      }

      if (action === "empresa_modulo") {
        return crm.upsertEmpresaModulo({
          id_empresa,
          idmodulo: Number(values.idmodulo),
          habilitado: values.habilitado === "on",
          updated_by: registrado_por,
        });
      }

      if (action === "rol_modulo") {
        return crm.upsertRolModulo({
          id_empresa,
          id_rol: Number(values.id_rol),
          idmodulo: Number(values.idmodulo),
          puede_ver: values.puede_ver === "on",
          puede_crear: values.puede_crear === "on",
          puede_editar: values.puede_editar === "on",
          puede_eliminar: values.puede_eliminar === "on",
          updated_by: registrado_por,
        });
      }

      if (action === "whatsapp_config") {
        return crm.upsertWhatsappConfig({
          id_empresa,
          proveedor: values.proveedor || "meta_cloud",
          estado: values.estado || "pendiente",
          phone_number_id: values.phone_number_id || null,
          business_account_id: values.business_account_id || null,
          display_phone: values.display_phone || null,
          default_country_code: values.default_country_code || "1",
          default_language: values.default_language || "es",
          metadata: {
            ...(crm.whatsappConfig?.metadata || {}),
            openwa_session_id: values.openwa_session_id || "default",
          },
          updated_by: registrado_por,
        });
      }

      if (action === "whatsapp_plantilla") {
        return crm.editarWhatsappPlantilla({
          id: Number(values.id),
          nombre: values.nombre,
          meta_template_name: values.meta_template_name || null,
          idioma: values.idioma || "es",
          cuerpo: values.cuerpo,
          activo: values.activo === "on",
        });
      }

      if (action === "whatsapp_automatizacion") {
        return crm.upsertCrmAutomatizacion({
          id_empresa,
          evento: values.evento,
          canal: "whatsapp",
          tipo_mensaje: values.tipo_mensaje,
          dias_antes: Number(values.dias_antes || 0),
          activo: values.activo === "on",
        });
      }

      if (action === "whatsapp_mensaje") {
        const cliente = crm.clientes.find((item) => String(item.id) === values.id_cliente_crm);
        const pago = crm.pagos.find((item) => String(item.id) === values.id_pago);
        const suscripcion = crm.suscripciones.find((item) => String(item.id) === values.id_suscripcion);
        const plantilla = crm.whatsappPlantillas.find((item) => item.tipo === values.tipo);
        const destino = cleanPhone(
          values.destino || cliente?.telefono,
          crm.whatsappConfig?.default_country_code || "1"
        );

        if (!destino) {
          throw new Error("El cliente necesita un telefono valido para WhatsApp.");
        }

        const variables = {
          nombre: fullName(cliente) || "Cliente",
          empresa: dataempresa?.nombre || "ActiveSelfControl",
          cliente_nombre: fullName(cliente) || "Cliente",
          empresa_nombre: dataempresa?.nombre || "ActiveSelfControl",
          monto: pago ? money(pago.monto, pago.moneda, dataempresa?.iso) : "",
          fecha_vencimiento: pago?.fecha_vencimiento || "",
          referencia: pago?.referencia || "",
          fecha_fin: suscripcion?.fecha_fin || "",
          dias_restantes: suscripcion?.fecha_fin ? String(daysUntil(suscripcion.fecha_fin)) : "",
        };
        const cuerpo = values.cuerpo?.trim() || renderTemplate(plantilla?.cuerpo, variables);

        return crm.crearWhatsappMensaje({
          id_empresa,
          id_cliente_crm: cliente?.id || null,
          id_pago: pago?.id || null,
          id_suscripcion: suscripcion?.id || null,
          tipo: values.tipo || "manual",
          destino,
          plantilla: plantilla?.meta_template_name || plantilla?.nombre || null,
          cuerpo,
          variables,
          estado: values.estado || "pendiente",
          scheduled_at: values.scheduled_at
            ? new Date(values.scheduled_at).toISOString()
            : new Date().toISOString(),
          created_by: registrado_por,
        });
      }

      if (action === "whatsapp_mensaje_estado") {
        return crm.actualizarWhatsappMensaje({
          id: Number(values.id),
          estado: values.estado,
        });
      }

      if (action === "whatsapp_despachar") {
        return crm.despacharWhatsappMensaje({
          id: Number(values.id),
          mode: values.mode || "template",
        });
      }
    },
    onSuccess: (result, variables) => {
      toast.success(actionMessages[variables.action] || "Datos guardados");
      queryClient.invalidateQueries({ queryKey: ["crm-data"] });
      queryClient.invalidateQueries({ queryKey: ["crm-subscriptions"] });
      if (variables.action === "facturar_suscripcion" && result?.pago) {
        void FacturaCliente("print", {
          dataempresa,
          pago: result.pago,
          cliente: result.cliente,
          suscripcion: result.suscripcion,
          plan: result.plan,
        }).catch((error) => toast.error(error?.message || "No se pudo imprimir la factura"));
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const submitForm = (action) => (event) => {
    const form = event.currentTarget;
    const values = readForm(event);
    mutation.mutate(
      { action, values },
      {
        onSuccess: () => {
          form.reset();
          if (action === "pago") setPaymentClientId("");
        },
      }
    );
  };

  const fillSubscriptionDefaults = (event) => {
    const form = event.currentTarget.form;
    const plan = crm.planes.find((item) => String(item.id) === event.target.value);
    if (!form || !plan) return;
    const startInput = form.elements.namedItem("fecha_inicio");
    const endInput = form.elements.namedItem("fecha_fin");
    const priceInput = form.elements.namedItem("precio_pactado");
    const start = startInput?.value || new Date().toISOString().slice(0, 10);
    if (startInput) startInput.value = start;
    if (endInput) endInput.value = addDays(start, plan.duracion_dias || 30);
    if (priceInput) priceInput.value = Number(plan.precio || 0);
  };

  const updateSubscriptionEnd = (event) => {
    const form = event.currentTarget.form;
    const planId = form?.elements.namedItem("id_plan")?.value;
    const plan = crm.planes.find((item) => String(item.id) === planId);
    if (form && plan && event.target.value) {
      const endInput = form.elements.namedItem("fecha_fin");
      if (endInput) endInput.value = addDays(event.target.value, plan.duracion_dias || 30);
    }
  };

  const fillPaymentDefaults = (event) => {
    const form = event.currentTarget.form;
    const subscription = crm.suscripciones.find((item) => String(item.id) === event.target.value);
    if (!form || !subscription) return;
    setPaymentClientId(String(subscription.id_cliente_crm));
    form.elements.namedItem("id_cliente_crm").value = subscription.id_cliente_crm;
    form.elements.namedItem("monto").value = Number(subscription.precio_pactado || subscription.crm_planes?.precio || 0);
    form.elements.namedItem("fecha_vencimiento").value = dateOnly(subscription.fecha_fin) || "";
    form.elements.namedItem("referencia").value = `Suscripcion #${subscription.id}`;
  };

  const printInvoice = (payment) => {
    void FacturaCliente("print", {
      dataempresa,
      pago: payment,
    }).catch((error) => toast.error(error?.message || "No se pudo imprimir la factura"));
  };

  const operational = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const monthPrefix = today.slice(0, 7);
    const pagosPendientes = crm.pagos.filter((item) => item.estado === "pendiente");
    const pagosVencidos = crm.pagos.filter(
      (item) => item.estado === "vencido" || (item.estado === "pendiente" && isBeforeToday(item.fecha_vencimiento, today))
    );
    const ingresosMes = crm.pagos
      .filter((item) => item.estado === "pagado" && dateOnly(item.fecha_pago)?.startsWith(monthPrefix))
      .reduce((sum, item) => sum + Number(item.monto || 0), 0);
    const carteraPendiente = pagosPendientes.reduce((sum, item) => sum + Number(item.monto || 0), 0);
    const asistenciasHoy = crm.asistencias.filter((item) => item.fecha === today);
    const suscripcionesPorVencer = crm.suscripciones.filter(
      (item) => item.estado === "activa" && isWithinDays(item.fecha_fin, 7)
    );
    const invitacionesPendientes = crm.invitaciones.filter((item) => item.estado === "pendiente");
    const whatsappPendientes = crm.whatsappMensajes.filter((item) =>
      ["borrador", "pendiente", "error"].includes(item.estado)
    );
    const clientesPorEstado = ["prospecto", "activo", "inactivo", "suspendido"].map((estado) => ({
      estado,
      total: crm.clientes.filter((item) => item.estado === estado).length,
    }));
    const acciones = [
      {
        icon: FiAlertCircle,
        title: "Cobros vencidos",
        value: pagosVencidos.length,
        detail: pagosVencidos.length ? "Priorizar contacto y bloqueo si aplica" : "Sin vencidos para hoy",
        tone: pagosVencidos.length ? "danger" : "ok",
      },
      {
        icon: FiCreditCard,
        title: "Cartera pendiente",
        value: money(carteraPendiente, dataempresa?.currency, dataempresa?.iso),
        detail: `${pagosPendientes.length} pago(s) por gestionar`,
        tone: pagosPendientes.length ? "warning" : "ok",
      },
      {
        icon: FiCalendar,
        title: "Renovaciones 7 dias",
        value: suscripcionesPorVencer.length,
        detail: "Clientes cerca de fin de suscripcion",
        tone: suscripcionesPorVencer.length ? "warning" : "ok",
      },
      {
        icon: FiMail,
        title: "Invitaciones pendientes",
        value: invitacionesPendientes.length,
        detail: "Correos enviados esperando onboarding",
        tone: invitacionesPendientes.length ? "info" : "ok",
      },
      {
        icon: FiMessageCircle,
        title: "WhatsApp pendientes",
        value: whatsappPendientes.length,
        detail: "Mensajes de cobro, bienvenida o renovacion",
        tone: whatsappPendientes.length ? "warning" : "ok",
      },
    ];

    return {
      today,
      pagosPendientes,
      pagosVencidos,
      ingresosMes,
      carteraPendiente,
      asistenciasHoy,
      suscripcionesPorVencer,
      invitacionesPendientes,
      whatsappPendientes,
      clientesPorEstado,
      acciones,
    };
  }, [
    crm.asistencias,
    crm.clientes,
    crm.invitaciones,
    crm.pagos,
    crm.suscripciones,
    crm.whatsappMensajes,
    dataempresa?.currency,
    dataempresa?.iso,
  ]);

  const analytics = useMemo(() => {
    const clientesEstado = operational.clientesPorEstado.map((item) => ({
      name: labelFor(item.estado),
      raw: item.estado,
      value: item.total,
    }));
    const pagosEstado = countBy(crm.pagos, "estado", ["pagado", "pendiente", "vencido", "anulado"]);
    const suscripcionesEstado = countBy(crm.suscripciones, "estado", ["activa", "pendiente", "vencida", "cancelada"]);
    const asistenciasEstado = countBy(crm.asistencias, "estado", ["presente", "tarde", "ausente", "salida_registrada"]);
    const invitacionesEstado = countBy(crm.invitaciones, "estado", ["pendiente", "aceptada", "expirada"]);
    const whatsappEstado = countBy(crm.whatsappMensajes, "estado", ["borrador", "pendiente", "enviado", "error"]);
    const trabajadoresEstado = countBy(crm.trabajadores, "estado", ["activo", "inactivo"]);
    const ingresosPorMes = buildRevenueTrend(crm.pagos);
    const totalPagado = crm.pagos
      .filter((item) => item.estado === "pagado")
      .reduce((sum, item) => sum + Number(item.monto || 0), 0);
    const ticketPromedio = crm.pagos.filter((item) => item.estado === "pagado").length
      ? totalPagado / crm.pagos.filter((item) => item.estado === "pagado").length
      : 0;
    const modulosHabilitados = crm.empresaModulos.filter((item) => item.habilitado).length;
    const permisosActivos = crm.rolModulos.filter(
      (item) => item.puede_ver || item.puede_crear || item.puede_editar || item.puede_eliminar
    ).length;
    const clientesConSuscripcion = new Set(crm.suscripciones.map((item) => item.id_cliente_crm)).size;
    const clientesConTelefono = crm.clientes.filter((item) => item.telefono).length;
    const clientesConEmail = crm.clientes.filter((item) => item.email).length;

    return {
      clientesEstado,
      pagosEstado,
      suscripcionesEstado,
      asistenciasEstado,
      invitacionesEstado,
      whatsappEstado,
      trabajadoresEstado,
      ingresosPorMes,
      totalPagado,
      ticketPromedio,
      modulosHabilitados,
      permisosActivos,
      clientesConSuscripcion,
      clientesConTelefono,
      clientesConEmail,
      totalPlanes: crm.planes.length,
      totalHorarios: crm.horarios.length,
      totalCargos: crm.cargos.length,
      totalTrabajadores: crm.trabajadores.length,
      totalPlantillas: crm.whatsappPlantillas.length,
      totalAutomatizaciones: crm.automatizaciones.length,
    };
  }, [
    crm.asistencias,
    crm.automatizaciones,
    crm.cargos,
    crm.clientes,
    crm.empresaModulos,
    crm.horarios,
    crm.invitaciones,
    crm.pagos,
    crm.planes,
    crm.rolModulos,
    crm.suscripciones,
    crm.trabajadores,
    crm.whatsappMensajes,
    crm.whatsappPlantillas,
    operational.clientesPorEstado,
  ]);

  const filteredClients = useMemo(() => {
    const value = search.trim().toLowerCase();
    const byStatus =
      clientStatusFilter === "todos"
        ? crm.clientes
        : crm.clientes.filter((item) => item.estado === clientStatusFilter);
    if (!value) return byStatus;
    return byStatus.filter((item) =>
      [item.nombres, item.apellidos, item.email, item.telefono]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [clientStatusFilter, crm.clientes, search]);

  useEffect(() => {
    setClientPage(1);
  }, [clientStatusFilter, search]);

  const clientPageSize = 10;
  const clientTotalPages = Math.max(
    1,
    Math.ceil(filteredClients.length / clientPageSize)
  );
  const safeClientPage = Math.min(clientPage, clientTotalPages);
  const paginatedClients = filteredClients.slice(
    (safeClientPage - 1) * clientPageSize,
    safeClientPage * clientPageSize
  );

  if (query.isLoading) {
    return <StateMessage>Cargando CRM...</StateMessage>;
  }

  if (query.error) {
    return (
      <StateMessage>
        No se pudo cargar el CRM. Revisa que la migracion de ActiveSelfControl
        este aplicada en Supabase. Detalle: {query.error.message}
      </StateMessage>
    );
  }

  const totals = {
    clientes: crm.resumen?.total_clientes || crm.clientes.length,
    activos: crm.resumen?.clientes_activos || crm.clientes.filter((item) => item.estado === "activo").length,
    pagosPendientes: crm.pagos.filter((item) => item.estado !== "pagado").length,
    suscripciones: crm.suscripciones.filter((item) => item.estado === "activa").length,
  };

  return (
    <Container>
      <Toaster position="top-right" richColors />
      <header className="header">
        <section>
          <span className="eyebrow"><FiActivity /> CRM OPERATIVO</span>
          <h1>{dataempresa?.nombre || "CRM"}</h1>
          <p>Clientes, planes, facturación e invitaciones en pocos pasos.</p>
        </section>
        <section className="pos-badge">
          <span className="connection-dot" aria-hidden="true" />
          <MdOutlinePointOfSale />
          <span>POS conectado</span>
        </section>
      </header>

      <section className="quick-actions" aria-label="Acciones rápidas">
        <button type="button" onClick={() => setActiveTab("clientes")}>
          <FiUsers />
          <span><strong>Nuevo cliente</strong><small>Registro manual</small></span>
        </button>
        <button type="button" onClick={() => setActiveTab("clientes")}>
          <FiMail />
          <span><strong>Enviar invitación</strong><small>Correo de acceso</small></span>
        </button>
        <button type="button" onClick={() => setActiveTab("suscripciones")}>
          <FiPlusCircle />
          <span><strong>Asignar suscripción</strong><small>Cliente y plan</small></span>
        </button>
        <button type="button" className="primary" onClick={() => setActiveTab("pagos")}>
          <FiFileText />
          <span><strong>Crear factura</strong><small>Cobrar e imprimir</small></span>
        </button>
      </section>

      <nav className="tabs" aria-label="CRM">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={activeTab === item.id ? "active" : ""}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {mutation.error && <p className="error">{mutation.error.message}</p>}

      {activeTab === "procesos" && (
        <section className="workspace dashboard-workspace">
          <section className="metric-grid">
            <MetricCard label="Clientes" value={totals.clientes} detail={`${totals.activos} activos`} tone="ok" />
            <MetricCard label="Suscripciones" value={totals.suscripciones} detail={`${analytics.clientesConSuscripcion} clientes vinculados`} />
            <MetricCard
              label="Ingresos del mes"
              value={money(operational.ingresosMes, dataempresa?.currency, dataempresa?.iso)}
              detail={`Ticket prom. ${money(analytics.ticketPromedio, dataempresa?.currency, dataempresa?.iso)}`}
              tone="ok"
            />
            <MetricCard
              label="Cartera pendiente"
              value={money(operational.carteraPendiente, dataempresa?.currency, dataempresa?.iso)}
              detail={`${totals.pagosPendientes} pago(s)`}
              tone={totals.pagosPendientes ? "warning" : "ok"}
            />
            <MetricCard label="Asistencias hoy" value={operational.asistenciasHoy.length} detail={`${crm.horarios.length} horarios activos`} />
            <MetricCard label="WhatsApp pendientes" value={operational.whatsappPendientes.length} detail={`${analytics.totalPlantillas} plantillas`} />
            <MetricCard label="Trabajadores" value={analytics.totalTrabajadores} detail={`${analytics.totalCargos} cargos`} />
            <MetricCard label="Permisos" value={analytics.permisosActivos} detail={`${analytics.modulosHabilitados} modulos habilitados`} />
          </section>

          <section className="chart-grid">
            <ChartCard title="Ingresos ultimos 6 meses" subtitle="Pagos marcados como pagados" empty={!hasChartData(analytics.ingresosPorMes, "ingresos")}>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={analytics.ingresosPorMes}>
                  <defs>
                    <linearGradient id="crmIncomeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis width={48} />
                  <Tooltip formatter={(value) => money(value, dataempresa?.currency, dataempresa?.iso)} />
                  <Area type="monotone" dataKey="ingresos" stroke="#16a34a" fill="url(#crmIncomeGradient)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Clientes por estado" subtitle="Flujo comercial" empty={!hasChartData(analytics.clientesEstado)}>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={analytics.clientesEstado} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
                    {analytics.clientesEstado.map((item, index) => (
                      <Cell key={item.raw} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Pagos por estado" subtitle="Cobranza y morosidad" empty={!hasChartData(analytics.pagosEstado)}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={analytics.pagosEstado}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} width={32} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {analytics.pagosEstado.map((item, index) => (
                      <Cell key={item.raw} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Asistencia" subtitle="Entradas, atrasos y ausencias">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={analytics.asistenciasEstado}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} width={32} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>

          <section className="operations-grid">
            <article className="panel process-panel">
              <div className="panel-title">
                <FiTrendingUp />
                <h2>Flujo operativo</h2>
              </div>
              <div className="process-steps">
                {operational.clientesPorEstado.map((item) => (
                  <div className="process-step" key={item.estado}>
                    <span className={`dot ${item.estado}`} />
                    <span>{labelFor(item.estado)}</span>
                    <strong>{item.total}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel action-panel">
              <div className="panel-title">
                <FiCheckCircle />
                <h2>Próximas acciones</h2>
              </div>
              <div className="action-list">
                {operational.acciones.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div className={`action-line ${item.tone}`} key={item.title}>
                      <Icon />
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.detail}</small>
                      </span>
                      <b>{item.value}</b>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="panel finance-panel">
              <div className="panel-title">
                <FiCreditCard />
                <h2>Control del día</h2>
              </div>
              <div className="amount-grid">
                <span>
                  <small>Ingresos del mes</small>
                  <strong>{money(operational.ingresosMes, dataempresa?.currency, dataempresa?.iso)}</strong>
                </span>
                <span>
                  <small>Asistencias hoy</small>
                  <strong>{operational.asistenciasHoy.length}</strong>
                </span>
                <span>
                  <small>Vencidos</small>
                  <strong>{operational.pagosVencidos.length}</strong>
                </span>
              </div>
            </article>
          </section>

          <section className="workspace two-cols inner-workspace">
            <div className="panel">
              <h2>Cobros vencidos</h2>
              <div className="list">
                {operational.pagosVencidos.length ? (
                  operational.pagosVencidos.slice(0, 10).map((pago) => (
                    <article key={pago.id}>
                      <strong>{fullName(pago.clientes_crm) || "Cliente"}</strong>
                      <span>{money(pago.monto, pago.moneda, dataempresa?.iso)} · {pago.fecha_vencimiento || "sin fecha"}</span>
                    </article>
                  ))
                ) : (
                  <p className="empty">No hay cobros vencidos.</p>
                )}
              </div>
            </div>

            <div className="panel">
              <h2>Renovaciones cercanas</h2>
              <div className="list">
                {operational.suscripcionesPorVencer.length ? (
                  operational.suscripcionesPorVencer.slice(0, 10).map((item) => (
                    <article key={item.id}>
                      <strong>{fullName(item.clientes_crm) || "Cliente"}</strong>
                      <span>{item.crm_planes?.nombre || "Plan"} · {item.fecha_fin}</span>
                    </article>
                  ))
                ) : (
                  <p className="empty">No hay renovaciones en los proximos 7 dias.</p>
                )}
              </div>
            </div>

            <div className="panel">
              <h2>Asistencia de hoy</h2>
              <div className="list">
                {operational.asistenciasHoy.length ? (
                  operational.asistenciasHoy.slice(0, 10).map((item) => (
                    <article key={item.id}>
                      <strong>{fullName(item.clientes_crm) || "Cliente"}</strong>
                      <span>{item.estado}</span>
                    </article>
                  ))
                ) : (
                  <p className="empty">Todavia no hay asistencias registradas hoy.</p>
                )}
              </div>
            </div>

            <div className="panel">
              <h2>Invitaciones pendientes</h2>
              <div className="list">
                {operational.invitacionesPendientes.length ? (
                  operational.invitacionesPendientes.slice(0, 10).map((item) => (
                    <article key={item.id}>
                      <strong>{item.email}</strong>
                      <span>{item.crm_planes?.nombre || "Sin plan"}</span>
                    </article>
                  ))
                ) : (
                  <p className="empty">No hay invitaciones pendientes.</p>
                )}
              </div>
            </div>
          </section>
        </section>
      )}

      {activeTab === "clientes" && (
        <CrmClientsWorkspace
          crm={crm}
          dataempresa={dataempresa}
          mutation={mutation}
          submitForm={submitForm}
          onNavigate={setActiveTab}
          onCharge={(client) => {
            setPaymentClientId(String(client.id));
            setActiveTab("pagos");
          }}
        />
      )}

      {false && (
        <>
        <section className="workspace module-overview">
          <section className="metric-grid">
            <MetricCard label="Clientes registrados" value={totals.clientes} detail={`${analytics.clientesConEmail} con correo valido`} />
            <MetricCard label="Activos" value={totals.activos} detail={`${analytics.clientesConSuscripcion} con suscripcion`} tone="ok" />
            <MetricCard label="Telefonos utiles" value={analytics.clientesConTelefono} detail="Listos para WhatsApp" />
            <MetricCard label="Invitaciones" value={crm.invitaciones.length} detail={`${operational.invitacionesPendientes.length} pendientes`} tone={operational.invitacionesPendientes.length ? "warning" : "ok"} />
          </section>
          <section className="chart-grid two">
            <ChartCard title="Clientes por estado" subtitle="Segmentacion para seguimiento" empty={!hasChartData(analytics.clientesEstado)}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analytics.clientesEstado}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} width={32} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {analytics.clientesEstado.map((item, index) => (
                      <Cell key={item.raw} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Invitaciones" subtitle="Onboarding por correo" empty={!hasChartData(analytics.invitacionesEstado)}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={analytics.invitacionesEstado} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82}>
                    {analytics.invitacionesEstado.map((item, index) => (
                      <Cell key={item.raw} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>
        </section>

        <section className="workspace two-cols">
          <div className="panel">
            <h2>Registrar cliente</h2>
            <form onSubmit={submitForm("cliente")}>
              <input name="nombres" placeholder="Nombres" required />
              <input name="apellidos" placeholder="Apellidos" />
              <input name="email" placeholder="Correo valido" type="email" />
              <input name="telefono" placeholder="Telefono" />
              <input name="direccion" placeholder="Direccion" />
              <input name="identificador_nacional" placeholder="Identificador nacional" />
              <input name="identificador_fiscal" placeholder="Identificador fiscal" />
              <select name="estado" defaultValue="activo">
                <option value="prospecto">Prospecto</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="suspendido">Suspendido</option>
              </select>
              <textarea name="notas" placeholder="Notas internas" />
              <button disabled={mutation.isPending}>Guardar cliente</button>
            </form>
          </div>

          <div className="panel">
            <h2>Invitar por correo</h2>
            <form onSubmit={submitForm("invitacion")}>
              <input name="email" placeholder="cliente@correo.com" type="email" required />
              <select name="id_plan" defaultValue="" required>
                <option value="">Selecciona el plan obligatorio</option>
                {crm.planes.filter((plan) => plan.activo).map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.nombre} - {money(plan.precio, dataempresa?.currency, dataempresa?.iso)}
                  </option>
                ))}
              </select>
              <button disabled={mutation.isPending}>
                <FiMail />
                Enviar invitacion
              </button>
            </form>

            <div className="list compact">
              {crm.invitaciones.slice(0, 6).map((item) => (
                <article key={item.id}>
                  <span className="invitation-copy">
                    <strong>{item.email}</strong>
                    <small>{item.crm_planes?.nombre || "Plan no disponible"}</small>
                    <small className={`invitation-status ${invitationState(item).key}`}>
                      {invitationState(item).label}
                    </small>
                  </span>
                  {item.estado === "pendiente" &&
                  new Date(item.expires_at) >= new Date() ? (
                    <button
                      type="button"
                      className="cancel-invitation"
                      title="Cancelar invitación"
                      onClick={() =>
                        mutation.mutate({
                          action: "cancelar_invitacion",
                          values: { id: item.id },
                        })
                      }
                      disabled={mutation.isPending}
                    >
                      <FiXCircle />
                      Cancelar
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          </div>

          <div className="panel wide">
            <div className="toolbar">
              <h2>Directorio</h2>
              <div className="filters">
                <label className="searchbox">
                  <FiSearch />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar cliente"
                  />
                </label>
                <select
                  value={clientStatusFilter}
                  onChange={(event) => setClientStatusFilter(event.target.value)}
                >
                  <option value="todos">Todos</option>
                  <option value="prospecto">Prospectos</option>
                  <option value="activo">Activos</option>
                  <option value="inactivo">Inactivos</option>
                  <option value="suspendido">Suspendidos</option>
                </select>
              </div>
            </div>
            <div className="table">
              <div className="row head">
                <span>Cliente</span>
                <span>Correo</span>
                <span>Telefono</span>
                <span>Estado</span>
              </div>
              {paginatedClients.map((item) => (
                <div className="row" key={item.id}>
                  <span>{fullName(item)}</span>
                  <span>{item.email || "-"}</span>
                  <span>{item.telefono || "-"}</span>
                  <span className={`status ${item.estado}`}>{item.estado}</span>
                </div>
              ))}
              {!filteredClients.length && <p className="empty">No hay clientes con esos filtros.</p>}
            </div>
            {filteredClients.length ? (
              <div className="client-pagination">
                <span>
                  Página {safeClientPage} de {clientTotalPages} · {filteredClients.length} cliente(s)
                </span>
                <div>
                  <button
                    type="button"
                    onClick={() => setClientPage((current) => Math.max(1, current - 1))}
                    disabled={safeClientPage === 1}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setClientPage((current) => Math.min(clientTotalPages, current + 1))
                    }
                    disabled={safeClientPage === clientTotalPages}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
        </>
      )}

      {activeTab === "suscripciones" && (
        <CrmSubscriptionsWorkspace
          crm={crm}
          dataempresa={dataempresa}
          mutation={mutation}
          submitForm={submitForm}
          fillSubscriptionDefaults={fillSubscriptionDefaults}
          updateSubscriptionEnd={updateSubscriptionEnd}
        />
      )}

      {activeTab === "pagos" && (
        <CrmPaymentsWorkspace
          crm={crm}
          dataempresa={dataempresa}
          initialClientId={paymentClientId}
          onClientHandled={() => setPaymentClientId("")}
        />
      )}

      {false && (
        <>
        <section className="workspace module-overview">
          <section className="metric-grid">
            <MetricCard label="Facturas" value={crm.pagos.length} detail="Cobros registrados" />
            <MetricCard label="Suscripciones activas" value={totals.suscripciones} detail={`${analytics.clientesConSuscripcion} clientes`} tone="ok" />
            <MetricCard
              label="Ingresos pagados"
              value={money(analytics.totalPagado, dataempresa?.currency, dataempresa?.iso)}
              detail={`Promedio ${money(analytics.ticketPromedio, dataempresa?.currency, dataempresa?.iso)}`}
              tone="ok"
            />
            <MetricCard
              label="Pendiente"
              value={money(operational.carteraPendiente, dataempresa?.currency, dataempresa?.iso)}
              detail={`${operational.pagosPendientes.length} cobro(s)`}
              tone={operational.pagosPendientes.length ? "warning" : "ok"}
            />
          </section>
          <section className="chart-grid two">
            <ChartCard title="Ingresos por mes" subtitle="Ultimos 6 meses" empty={!hasChartData(analytics.ingresosPorMes, "ingresos")}>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={analytics.ingresosPorMes}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis width={48} />
                  <Tooltip formatter={(value) => money(value, dataempresa?.currency, dataempresa?.iso)} />
                  <Area type="monotone" dataKey="ingresos" stroke="#16a34a" fill="#dcfce7" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Pagos por estado" subtitle="Salud de cobranza" empty={!hasChartData(analytics.pagosEstado)}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analytics.pagosEstado}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} width={32} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {analytics.pagosEstado.map((item, index) => (
                      <Cell key={item.raw} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>
        </section>

        <section className="workspace two-cols">
          <div className="panel wide invoice-checkout">
            <div className="invoice-checkout-copy">
              <span><FiFileText /></span>
              <div>
                <h2>Facturar una suscripción</h2>
                <p>Selecciona una membresía existente. Aquí solo se registra el cobro y se abre la factura para imprimir.</p>
              </div>
            </div>
            <form onSubmit={submitForm("facturar_suscripcion")}>
              <select name="id_suscripcion" required defaultValue="">
                <option value="">Selecciona cliente y suscripción</option>
                {crm.suscripciones
                  .filter((item) => item.estado !== "cancelada")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {fullName(item.clientes_crm)} · {item.crm_planes?.nombre} ·{" "}
                      {money(item.precio_pactado, dataempresa?.currency, dataempresa?.iso)}
                    </option>
                  ))}
              </select>
              <input name="metodo_pago" list="crm-payment-methods" placeholder="Método de pago" />
              <select name="estado" defaultValue="pagado">
                <option value="pagado">Pagada</option>
                <option value="pendiente">Pendiente</option>
                <option value="vencido">Vencida</option>
              </select>
              <textarea name="notas" placeholder="Notas opcionales de la factura" />
              <button
                className="invoice-action"
                disabled={mutation.isPending || !crm.suscripciones.length}
              >
                <FiPrinter />
                Crear e imprimir factura
              </button>
            </form>
          </div>

          <div className="panel">
            <h2>Registrar pago</h2>
            <p className="hint">Puedes registrar un pago directo o asociarlo a una suscripcion existente.</p>
            <form onSubmit={submitForm("pago")}>
              <select
                name="id_cliente_crm"
                required
                value={paymentClientId}
                onChange={(event) => {
                  setPaymentClientId(event.target.value);
                  event.currentTarget.form.elements.namedItem("id_suscripcion").value = "";
                }}
              >
                <option value="">Cliente</option>
                {crm.clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>{fullName(cliente)}</option>
                ))}
              </select>
              <select name="id_suscripcion" defaultValue="" onChange={fillPaymentDefaults}>
                <option value="">Sin suscripcion</option>
                {crm.suscripciones
                  .filter((item) => !paymentClientId || String(item.id_cliente_crm) === paymentClientId)
                  .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.clientes_crm?.nombres} - {item.crm_planes?.nombre}
                  </option>
                ))}
              </select>
              <input name="monto" type="number" min="0" step="0.01" placeholder="Monto" required />
              <input name="metodo_pago" list="crm-payment-methods" placeholder="Metodo de pago" />
              <datalist id="crm-payment-methods">
                <option value="Efectivo" />
                <option value="Tarjeta" />
                <option value="Transferencia" />
                <option value="Deposito" />
              </datalist>
              <input name="referencia" placeholder="Referencia" />
              <input name="fecha_vencimiento" type="date" />
              <select name="estado" defaultValue="pagado">
                <option value="pagado">Pagado</option>
                <option value="pendiente">Pendiente</option>
                <option value="vencido">Vencido</option>
                <option value="anulado">Anulado</option>
              </select>
              <textarea name="notas" placeholder="Notas" />
              <button disabled={mutation.isPending || !crm.clientes.length}>Guardar pago</button>
            </form>
          </div>

          <div className="panel">
            <h2>Ultimos pagos</h2>
            <div className="list">
              {crm.pagos.slice(0, 12).map((pago) => (
                <article key={pago.id}>
                  <span className="payment-copy">
                    <strong>{fullName(pago.clientes_crm) || "Cliente"}</strong>
                    <small>{pago.referencia || `Factura #${pago.id}`} · {money(pago.monto, pago.moneda, dataempresa?.iso)} · {pago.estado}</small>
                  </span>
                  <button
                    type="button"
                    className="print-invoice"
                    onClick={() => printInvoice(pago)}
                    title="Imprimir factura"
                  >
                    <FiPrinter />
                    Imprimir
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>
        </>
      )}

      {activeTab === "horarios" && (
        <CrmAttendanceWorkspace
          crm={crm}
          dataempresa={dataempresa}
          mutation={mutation}
          submitForm={submitForm}
        />
      )}

      {activeTab === "trabajadores" && (
        <>
        <section className="workspace module-overview">
          <section className="metric-grid">
            <MetricCard label="Trabajadores" value={analytics.totalTrabajadores} detail="Equipo operativo" />
            <MetricCard label="Cargos" value={analytics.totalCargos} detail="Estructura interna" />
            <MetricCard label="Con horario" value={crm.trabajadores.filter((item) => item.id_horario).length} detail="Planificados" tone="ok" />
            <MetricCard label="Sin cargo" value={crm.trabajadores.filter((item) => !item.id_cargo).length} detail="Revisar asignacion" tone="warning" />
          </section>
          <section className="chart-grid two">
            <ChartCard title="Trabajadores por estado" subtitle="Disponibilidad del equipo">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={analytics.trabajadoresEstado} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82}>
                    {analytics.trabajadoresEstado.map((item, index) => (
                      <Cell key={item.raw} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Cargos creados" subtitle="Base para roles operativos">
              <div className="focus-number">
                <strong>{analytics.totalCargos}</strong>
                <span>cargos disponibles para asignar</span>
              </div>
            </ChartCard>
          </section>
        </section>

        <section className="workspace two-cols">
          <div className="panel">
            <h2>Cargos</h2>
            <form onSubmit={submitForm("cargo")}>
              <input name="nombre" placeholder="Cargo" required />
              <textarea name="descripcion" placeholder="Descripcion" />
              <button disabled={mutation.isPending}>Crear cargo</button>
            </form>
          </div>

          <div className="panel">
            <h2>Trabajador</h2>
            <form onSubmit={submitForm("trabajador")}>
              <input name="nombres" placeholder="Nombre completo" required />
              <input name="email" type="email" placeholder="Correo" />
              <input name="telefono" placeholder="Telefono" />
              <select name="id_cargo" defaultValue="">
                <option value="">Cargo</option>
                {crm.cargos.map((cargo) => (
                  <option key={cargo.id} value={cargo.id}>{cargo.nombre}</option>
                ))}
              </select>
              <select name="id_horario" defaultValue="">
                <option value="">Horario</option>
                {crm.horarios.map((horario) => (
                  <option key={horario.id} value={horario.id}>{horario.nombre}</option>
                ))}
              </select>
              <input name="fecha_ingreso" type="date" />
              <input name="salario" type="number" min="0" step="0.01" placeholder="Salario" />
              <textarea name="notas" placeholder="Notas" />
              <button disabled={mutation.isPending}>Guardar trabajador</button>
            </form>
          </div>

          <div className="panel wide">
            <h2>Equipo</h2>
            <div className="table">
              <div className="row head">
                <span>Nombre</span>
                <span>Cargo</span>
                <span>Horario</span>
                <span>Estado</span>
              </div>
              {crm.trabajadores.map((item) => (
                <div className="row" key={item.id}>
                  <span>{item.nombres}</span>
                  <span>{item.cargos?.nombre || "-"}</span>
                  <span>{item.crm_horarios?.nombre || "-"}</span>
                  <span className={`status ${item.estado}`}>{item.estado}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        </>
      )}

      {activeTab === "whatsapp" && (
        <>
        <section className="workspace module-overview">
          <section className="metric-grid">
            <MetricCard label="Estado conexion" value={labelFor(crm.whatsappConfig?.estado || "pendiente")} detail={crm.whatsappConfig?.proveedor || "Meta Cloud API"} />
            <MetricCard label="Mensajes" value={crm.whatsappMensajes.length} detail={`${operational.whatsappPendientes.length} pendientes`} tone={operational.whatsappPendientes.length ? "warning" : "ok"} />
            <MetricCard label="Plantillas" value={analytics.totalPlantillas} detail="Bienvenida, cobro y vencimiento" />
            <MetricCard label="Automatizaciones" value={analytics.totalAutomatizaciones} detail="Reglas activas del CRM" />
          </section>
          <section className="chart-grid two">
            <ChartCard title="Mensajes por estado" subtitle="Cola de WhatsApp">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analytics.whatsappEstado}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} width={32} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#16a34a" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Contactabilidad" subtitle="Clientes listos para comunicacion">
              <div className="focus-number">
                <strong>{analytics.clientesConTelefono}</strong>
                <span>clientes con telefono registrado</span>
              </div>
            </ChartCard>
          </section>
        </section>

        <section className="workspace two-cols">
          <div className="panel">
            <h2>Conexion WhatsApp</h2>
            <form onSubmit={submitForm("whatsapp_config")}>
              <select name="proveedor" defaultValue={crm.whatsappConfig?.proveedor || "meta_cloud"}>
                <option value="meta_cloud">Meta Cloud API</option>
                <option value="openwa_n8n">OpenWA mediante n8n</option>
                <option value="manual">Manual</option>
              </select>
              <select name="estado" defaultValue={crm.whatsappConfig?.estado || "pendiente"}>
                <option value="pendiente">Pendiente</option>
                <option value="conectado">Conectado</option>
                <option value="pausado">Pausado</option>
                <option value="error">Error</option>
              </select>
              <input
                name="phone_number_id"
                placeholder="Phone number ID"
                defaultValue={crm.whatsappConfig?.phone_number_id || ""}
              />
              <input
                name="business_account_id"
                placeholder="WhatsApp Business Account ID"
                defaultValue={crm.whatsappConfig?.business_account_id || ""}
              />
              <input
                name="display_phone"
                placeholder="Telefono visible"
                defaultValue={crm.whatsappConfig?.display_phone || ""}
              />
              <input
                name="default_country_code"
                placeholder="Codigo pais, ej. 505"
                defaultValue={crm.whatsappConfig?.default_country_code || "1"}
              />
              <input
                name="default_language"
                placeholder="Idioma"
                defaultValue={crm.whatsappConfig?.default_language || "es"}
              />
              <input
                name="openwa_session_id"
                placeholder="Sesion OpenWA, ej. gimnasio-principal"
                defaultValue={crm.whatsappConfig?.metadata?.openwa_session_id || "default"}
              />
              <button disabled={mutation.isPending}>Guardar conexion</button>
            </form>
          </div>

          <div className="panel">
            <h2>Preparar mensaje</h2>
            <form onSubmit={submitForm("whatsapp_mensaje")}>
              <select name="id_cliente_crm" required defaultValue="">
                <option value="">Cliente</option>
                {crm.clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {fullName(cliente)} {cliente.telefono ? `- ${cliente.telefono}` : ""}
                  </option>
                ))}
              </select>
              <select name="tipo" defaultValue="cobro">
                {whatsappTypes.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
              <select name="id_pago" defaultValue="">
                <option value="">Pago opcional</option>
                {crm.pagos.map((pago) => (
                  <option key={pago.id} value={pago.id}>
                    {fullName(pago.clientes_crm) || "Cliente"} - {money(pago.monto, pago.moneda, dataempresa?.iso)}
                  </option>
                ))}
              </select>
              <select name="id_suscripcion" defaultValue="">
                <option value="">Suscripcion opcional</option>
                {crm.suscripciones.map((item) => (
                  <option key={item.id} value={item.id}>
                    {fullName(item.clientes_crm) || "Cliente"} - {item.fecha_fin}
                  </option>
                ))}
              </select>
              <input name="destino" placeholder="Telefono alterno opcional" />
              <textarea name="cuerpo" placeholder="Mensaje personalizado opcional" />
              <input name="scheduled_at" type="datetime-local" />
              <select name="estado" defaultValue="pendiente">
                <option value="pendiente">Pendiente</option>
                <option value="borrador">Borrador</option>
              </select>
              <button disabled={mutation.isPending}>
                <FiSend />
                Crear mensaje
              </button>
            </form>
          </div>

          <div className="panel wide">
            <h2>Plantillas</h2>
            <div className="template-grid">
              {crm.whatsappPlantillas.map((plantilla) => (
                <form key={plantilla.id} onSubmit={submitForm("whatsapp_plantilla")}>
                  <input name="id" type="hidden" value={plantilla.id} readOnly />
                  <input name="nombre" defaultValue={plantilla.nombre} />
                  <input
                    name="meta_template_name"
                    placeholder="Nombre aprobado en Meta"
                    defaultValue={plantilla.meta_template_name || ""}
                  />
                  <input name="idioma" defaultValue={plantilla.idioma || "es"} />
                  <textarea name="cuerpo" defaultValue={plantilla.cuerpo} required />
                  <label className="checkline">
                    <input name="activo" type="checkbox" defaultChecked={plantilla.activo} />
                    Activa
                  </label>
                  <button disabled={mutation.isPending}>Guardar plantilla</button>
                </form>
              ))}
              {!crm.whatsappPlantillas.length && (
                <p className="empty">No hay plantillas de WhatsApp cargadas.</p>
              )}
            </div>
          </div>

          <div className="panel wide">
            <h2>Cola de mensajes</h2>
            <div className="table">
              <div className="row message-row head">
                <span>Cliente</span>
                <span>Tipo</span>
                <span>Destino</span>
                <span>Estado</span>
                <span>Accion</span>
              </div>
              {crm.whatsappMensajes.map((item) => (
                <div className="row message-row" key={item.id}>
                  <span>{fullName(item.clientes_crm) || "Cliente"}</span>
                  <span>{whatsappTypes.find((type) => type.id === item.tipo)?.label || item.tipo}</span>
                  <span>{item.destino}</span>
                  <span className={`status ${item.estado}`}>{item.estado}</span>
                  <span className="message-actions">
                    <a
                      className="wa-link"
                      href={whatsappHref(item.destino, item.cuerpo)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FiMessageCircle />
                      Abrir
                    </a>
                    {item.estado !== "enviado" && crm.whatsappConfig?.estado === "conectado" && (
                      <form onSubmit={submitForm("whatsapp_despachar")}>
                        <input name="id" type="hidden" value={item.id} readOnly />
                        <input name="mode" type="hidden" value={item.plantilla ? "template" : "text"} readOnly />
                        <button disabled={mutation.isPending}>Enviar API</button>
                      </form>
                    )}
                    {item.estado !== "enviado" && (
                      <form onSubmit={submitForm("whatsapp_mensaje_estado")}>
                        <input name="id" type="hidden" value={item.id} readOnly />
                        <input name="estado" type="hidden" value="enviado" readOnly />
                        <button disabled={mutation.isPending}>Marcar enviado</button>
                      </form>
                    )}
                  </span>
                </div>
              ))}
              {!crm.whatsappMensajes.length && (
                <p className="empty">Todavia no hay mensajes en cola.</p>
              )}
            </div>
          </div>

          <div className="panel wide">
            <h2>Automatizaciones</h2>
            <div className="automation-grid">
              {crm.automatizaciones.map((item) => (
                <form key={item.id} onSubmit={submitForm("whatsapp_automatizacion")}>
                  <input name="evento" type="hidden" value={item.evento} readOnly />
                  <input name="tipo_mensaje" type="hidden" value={item.tipo_mensaje} readOnly />
                  <strong>{item.evento.replaceAll("_", " ")}</strong>
                  <span>{whatsappTypes.find((type) => type.id === item.tipo_mensaje)?.label}</span>
                  <input name="dias_antes" type="number" min="0" defaultValue={item.dias_antes || 0} />
                  <label className="checkline">
                    <input name="activo" type="checkbox" defaultChecked={item.activo} />
                    Activa
                  </label>
                  <button disabled={mutation.isPending}>Guardar</button>
                </form>
              ))}
              {!crm.automatizaciones.length && (
                <p className="empty">No hay automatizaciones configuradas.</p>
              )}
            </div>
          </div>
        </section>
        </>
      )}

      {activeTab === "permisos" && (
        <>
        <section className="workspace module-overview permissions-overview">
          <header className="permissions-heading">
            <div className="permissions-heading-icon"><FiShield /></div>
            <div>
              <span className="section-kicker">Seguridad y acceso</span>
              <h2>Control de permisos</h2>
              <p>Define qué módulos puede usar cada rol sin mezclar la operación del POS con el CRM.</p>
            </div>
            <div className="security-state">
              <FiLock />
              <span><strong>Acceso protegido</strong><small>Configuración por empresa</small></span>
            </div>
          </header>
          <section className="metric-grid">
            <MetricCard label="Módulos" value={crm.modulos.length} detail={`${analytics.modulosHabilitados} disponibles`} />
            <MetricCard label="Roles" value={crm.roles.length} detail="Perfiles disponibles" />
            <MetricCard label="Reglas activas" value={analytics.permisosActivos} detail="Permisos por rol" tone="ok" />
            <MetricCard label="Bloqueados" value={crm.empresaModulos.filter((item) => !item.habilitado).length} detail="Módulos restringidos" tone="warning" />
          </section>
          <section className="permission-insights">
            <article className="access-summary-card">
              <div className="card-heading">
                <span className="card-icon green"><FiLayers /></span>
                <span><strong>Disponibilidad de módulos</strong><small>Acceso habilitado para esta empresa</small></span>
              </div>
              <div className="progress-line">
                <div style={{ width: `${Math.min(100, Math.round((analytics.modulosHabilitados / Math.max(crm.modulos.length, 1)) * 100))}%` }} />
              </div>
              <footer><strong>{analytics.modulosHabilitados} de {crm.modulos.length}</strong><span>módulos disponibles</span></footer>
            </article>
            <article className="access-summary-card">
              <div className="card-heading">
                <span className="card-icon blue"><FiShield /></span>
                <span><strong>Cobertura de permisos</strong><small>Combinaciones de rol y módulo configuradas</small></span>
              </div>
              <div className="progress-line blue">
                <div style={{ width: `${Math.min(100, Math.round((analytics.permisosActivos / Math.max(crm.roles.length * crm.modulos.length, 1)) * 100))}%` }} />
              </div>
              <footer><strong>{analytics.permisosActivos} reglas</strong><span>{crm.roles.length} roles registrados</span></footer>
            </article>
          </section>
        </section>

        <section className="workspace two-cols permissions-workspace">
          <div className="panel permission-panel">
            <div className="panel-heading">
              <span className="card-icon green"><FiLayers /></span>
              <div><h2>Acceso por módulo</h2><p>Activa o bloquea una sección para toda la empresa.</p></div>
            </div>
            <form className="permission-form" onSubmit={submitForm("empresa_modulo")}>
              <label className="field-group">
                <span>Módulo del sistema</span>
                <select name="idmodulo" required defaultValue="">
                  <option value="">Selecciona un módulo</option>
                  {crm.modulos.map((modulo) => (
                    <option key={modulo.id} value={modulo.id}>{modulo.nombre}</option>
                  ))}
                </select>
              </label>
              <label className="switchline">
                <span><strong>Disponible para la empresa</strong><small>Los roles podrán recibir permisos sobre este módulo.</small></span>
                <input name="habilitado" type="checkbox" defaultChecked />
                <i aria-hidden="true" />
              </label>
              <button className="primary-action" disabled={mutation.isPending}><FiShield /> Guardar acceso</button>
            </form>
            <div className="module-status-list">
              {crm.empresaModulos.map((item) => (
                <article key={item.id}>
                  <span className={`status-dot ${item.habilitado ? "enabled" : "disabled"}`} />
                  <strong>{item.modulos?.nombre}</strong>
                  <span className={`access-badge ${item.habilitado ? "enabled" : "disabled"}`}>{item.habilitado ? "Disponible" : "Bloqueado"}</span>
                </article>
              ))}
              {!crm.empresaModulos.length && <p className="empty-state">Aún no hay módulos configurados.</p>}
            </div>
          </div>

          <div className="panel permission-panel">
            <div className="panel-heading">
              <span className="card-icon blue"><FiLock /></span>
              <div><h2>Permisos del rol</h2><p>Asigna solo las acciones necesarias para cada perfil.</p></div>
            </div>
            <form className="permission-form" onSubmit={submitForm("rol_modulo")}>
              <div className="permission-selects">
                <label className="field-group"><span>Rol</span><select name="id_rol" required defaultValue=""><option value="">Selecciona un rol</option>{crm.roles.map((rol) => (<option key={rol.id} value={rol.id}>{rol.nombre}</option>))}</select></label>
                <label className="field-group"><span>Módulo</span><select name="idmodulo" required defaultValue=""><option value="">Selecciona un módulo</option>{crm.modulos.map((modulo) => (<option key={modulo.id} value={modulo.id}>{modulo.nombre}</option>))}</select></label>
              </div>
              <fieldset className="permission-options">
                <legend>Acciones permitidas</legend>
                <label><input name="puede_ver" type="checkbox" defaultChecked /><span><FiEye /><strong>Ver</strong><small>Consultar información</small></span></label>
                <label><input name="puede_crear" type="checkbox" /><span><FiPlusCircle /><strong>Crear</strong><small>Registrar elementos</small></span></label>
                <label><input name="puede_editar" type="checkbox" /><span><FiEdit3 /><strong>Editar</strong><small>Modificar registros</small></span></label>
                <label><input name="puede_eliminar" type="checkbox" /><span><FiTrash2 /><strong>Eliminar</strong><small>Borrar información</small></span></label>
              </fieldset>
              <button className="primary-action" disabled={mutation.isPending}><FiLock /> Guardar permisos</button>
            </form>
          </div>

          <div className="panel wide permission-matrix">
            <div className="panel-heading matrix-heading">
              <span className="card-icon violet"><FiShield /></span>
              <div><h2>Matriz de acceso</h2><p>Resumen vigente de permisos por rol y módulo.</p></div>
              <span className="matrix-count">{crm.rolModulos.length} reglas</span>
            </div>
            <div className="table permission-table">
              <div className="row head">
                <span>Rol</span>
                <span>Módulo</span>
                <span>Permisos</span>
                <span>Estado</span>
              </div>
              {crm.rolModulos.map((item) => (
                <div className="row" key={item.id}>
                  <span>{item.roles?.nombre}</span>
                  <span>{item.modulos?.nombre}</span>
                  <span>
                    {[
                      item.puede_ver && "ver",
                      item.puede_crear && "crear",
                      item.puede_editar && "editar",
                      item.puede_eliminar && "eliminar",
                    ].filter(Boolean).join(", ")}
                  </span>
                  <span className="status activo">activo</span>
                </div>
              ))}
              {!crm.rolModulos.length && (
                <div className="matrix-empty"><span><FiShield /></span><strong>No hay reglas configuradas</strong><p>Selecciona un rol y un módulo para crear el primer permiso.</p></div>
              )}
            </div>
          </div>
        </section>
        </>
      )}
    </Container>
  );
}

const StateMessage = styled.div`
  min-height: calc(100vh - 80px);
  margin-top: 50px;
  display: grid;
  place-items: center;
  color: ${({ theme }) => theme.text};
  background: ${({ theme }) => theme.bgtotal};
  padding: 24px;
  text-align: center;
`;

const Container = styled.main`
  width: 100%;
  min-width: 0;
  min-height: calc(100vh - 50px);
  margin-top: 50px;
  padding: 22px 24px 48px;
  background: ${({ theme }) => theme.bgtotal};
  color: ${({ theme }) => theme.text};
  max-width: 100%;
  overflow-x: clip;

  &,
  * {
    box-sizing: border-box;
  }

  .header {
    width: min(1380px, 100%);
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    overflow: hidden;
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 18px;
    background:
      radial-gradient(circle at 82% 15%, rgba(56, 189, 248, 0.2), transparent 28%),
      linear-gradient(135deg, #111827 0%, #172554 58%, #0f3b4a 100%);
    color: #fff;
    padding: 24px 26px;
    box-shadow: 0 18px 45px rgba(15, 23, 42, 0.16);

    h1 {
      margin: 4px 0;
      font-size: clamp(28px, 3vw, 40px);
      letter-spacing: -0.04em;
    }

    p {
      margin: 0;
      color: rgba(255, 255, 255, 0.72);
      max-width: 720px;
    }
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: #7dd3fc;
    font-weight: 800;
    letter-spacing: 0.12em;
    font-size: 11px;
    text-transform: uppercase;
  }

  .pos-badge {
    min-width: 170px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 999px;
    padding: 11px 15px;
    background: rgba(255, 255, 255, 0.09);
    color: #fff;
    backdrop-filter: blur(10px);
    font-weight: 700;
  }

  .connection-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #4ade80;
    box-shadow: 0 0 0 4px rgba(74, 222, 128, 0.14);
  }

  .quick-actions {
    width: min(1380px, 100%);
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin: 12px auto 0;

    button {
      min-width: 0;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      gap: 11px;
      border: 1px solid ${({ theme }) => theme.color2};
      border-radius: 14px;
      background: ${({ theme }) => theme.bgcards};
      color: ${({ theme }) => theme.text};
      padding: 13px 15px;
      text-align: left;
      cursor: pointer;
      transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;

      > svg {
        width: 36px;
        height: 36px;
        padding: 9px;
        border-radius: 10px;
        background: ${({ theme }) => theme.bgtotal};
        color: #172554;
      }

      > span {
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        color: ${({ theme }) => theme.colorSubtitle};
      }
    }

    button:hover {
      transform: translateY(-2px);
      border-color: ${v.colorPrincipal};
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.1);
    }

    button.primary {
      border-color: ${v.colorPrincipal};
      background: ${v.colorPrincipal};
      color: #111827;

      > svg {
        background: rgba(255, 255, 255, 0.55);
        color: #111827;
      }

      small {
        color: rgba(17, 24, 39, 0.7);
      }
    }
  }

  .summary-grid {
    width: min(1320px, 100%);
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin: 14px auto;

    article {
      border-radius: 8px;
      background: ${({ theme }) => theme.bgcards};
      border: 1px solid ${({ theme }) => theme.color2};
      padding: 14px;
      display: grid;
      gap: 8px;
    }

    span {
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 13px;
    }

    strong {
      font-size: 26px;
    }
  }

  .metric-grid {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .metric-card {
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 14px;
    background: ${({ theme }) => theme.bgcards};
    padding: 16px 18px;
    display: grid;
    gap: 6px;
    min-width: 0;

    span,
    small {
      color: ${({ theme }) => theme.colorSubtitle};
    }

    span {
      font-size: 13px;
      font-weight: 700;
    }

    strong {
      font-size: 28px;
      letter-spacing: -0.04em;
      line-height: 1.1;
      overflow-wrap: anywhere;
    }

    small {
      font-size: 12px;
      line-height: 1.35;
    }
  }

  .metric-card.ok {
    border-color: rgba(22, 163, 74, 0.38);
  }

  .metric-card.warning {
    border-color: rgba(217, 119, 6, 0.45);
  }

  .metric-card.danger {
    border-color: rgba(239, 68, 68, 0.45);
  }

  .chart-grid {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .chart-grid.two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .chart-card {
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 8px;
    background: ${({ theme }) => theme.bgcards};
    padding: 14px;
    min-width: 0;
    display: grid;
    gap: 10px;

    header {
      display: grid;
      gap: 3px;
    }

    h3 {
      margin: 0;
      font-size: 15px;
      letter-spacing: 0;
    }

    header span {
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 12px;
    }
  }

  .chart-body {
    min-height: 220px;
    min-width: 0;
  }

  .chart-empty {
    min-height: 220px;
    display: grid;
    place-items: center;
    margin: 0;
    border: 1px dashed ${({ theme }) => theme.color2};
    border-radius: 8px;
  }

  .focus-number {
    min-height: 220px;
    border: 1px dashed ${({ theme }) => theme.color2};
    border-radius: 8px;
    display: grid;
    place-items: center;
    text-align: center;
    padding: 20px;

    strong {
      font-size: 52px;
      line-height: 1;
    }

    span {
      color: ${({ theme }) => theme.colorSubtitle};
      max-width: 260px;
    }
  }

  .operations-grid {
    width: min(1320px, 100%);
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    margin: 0 auto 16px;
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;

    svg {
      color: ${v.colorPrincipal};
      flex: 0 0 auto;
    }

    h2 {
      margin: 0;
    }
  }

  .process-steps,
  .action-list,
  .amount-grid {
    display: grid;
    gap: 10px;
  }

  .process-step,
  .action-line {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 10px;
    border-top: 1px solid ${({ theme }) => theme.color2};
    padding-top: 10px;
  }

  .process-step strong,
  .action-line b {
    font-size: 18px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: ${({ theme }) => theme.colorSubtitle};
  }

  .dot.activo {
    background: #16a34a;
  }

  .dot.prospecto {
    background: ${v.colorPrincipal};
  }

  .dot.inactivo {
    background: #d97706;
  }

  .dot.suspendido {
    background: ${v.colorError};
  }

  .action-line.ok svg {
    color: #16a34a;
  }

  .action-line.info svg {
    color: ${v.colorPrincipal};
  }

  .action-line.warning svg {
    color: #d97706;
  }

  .action-line.danger svg {
    color: ${v.colorError};
  }

  .action-line span {
    display: grid;
    gap: 2px;
  }

  .action-line small,
  .amount-grid small {
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .amount-grid {
    grid-template-columns: 1fr;

    span {
      display: grid;
      gap: 4px;
      border-top: 1px solid ${({ theme }) => theme.color2};
      padding-top: 10px;
    }

    strong {
      font-size: 18px;
    }
  }

  .tabs {
    width: min(1380px, 100%);
    position: sticky;
    top: 50px;
    z-index: 7;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 12px auto 18px;
    padding: 7px;
    background: color-mix(in srgb, ${({ theme }) => theme.bgcards} 92%, transparent);
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 14px;
    box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
    backdrop-filter: blur(14px);

    button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid transparent;
      border-radius: 10px;
      background: transparent;
      color: ${({ theme }) => theme.text};
      padding: 10px 13px;
      font-weight: 700;
      cursor: pointer;
      transition: background 160ms ease, color 160ms ease, transform 160ms ease;
    }

    button:hover {
      background: ${({ theme }) => theme.bgtotal};
      transform: translateY(-1px);
    }

    button.active {
      background: #172554;
      color: #fff;
      border-color: #172554;
      box-shadow: 0 6px 16px rgba(23, 37, 84, 0.22);
    }
  }

  .workspace {
    width: min(1380px, 100%);
    margin: 0 auto;
    display: grid;
    gap: 14px;
    align-items: start;
  }

  .dashboard-workspace,
  .module-overview {
    margin-bottom: 14px;
  }

  .inner-workspace {
    width: 100%;
  }

  .two-cols {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .panel {
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 16px;
    background: ${({ theme }) => theme.bgcards};
    padding: 18px;
    min-width: 0;

    h2 {
      margin: 0 0 6px;
      font-size: 18px;
      letter-spacing: 0;
    }
  }

  .invoice-checkout {
    display: grid;
    grid-template-columns: minmax(240px, 0.7fr) minmax(0, 1.3fr);
    gap: 22px;
    border-color: rgba(243, 210, 12, 0.62);
    background:
      linear-gradient(135deg, rgba(243, 210, 12, 0.08), transparent 42%),
      ${({ theme }) => theme.bgcards};
  }

  .invoice-checkout-copy {
    display: flex;
    align-items: flex-start;
    gap: 13px;

    > span {
      width: 44px;
      height: 44px;
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      border-radius: 13px;
      background: ${v.colorPrincipal};
      color: #111827;
      font-size: 20px;
    }

    h2,
    p {
      margin: 0;
    }

    p {
      max-width: 390px;
      margin-top: 6px;
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 13px;
      line-height: 1.5;
    }
  }

  .invoice-checkout > form {
    grid-template-columns: repeat(2, minmax(0, 1fr));

    textarea,
    .invoice-action {
      grid-column: 1 / -1;
    }

    .invoice-action {
      min-height: 48px;
      font-size: 14px;
    }
  }

  .hint {
    margin: 0 0 12px;
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 13px;
    line-height: 1.4;
  }

  .wide {
    grid-column: 1 / -1;
  }

  form,
  .panel > form {
    display: grid;
    gap: 10px;

    input,
    select,
    textarea {
      width: 100%;
      min-width: 0;
      border: 1px solid ${({ theme }) => theme.color2};
      border-radius: 6px;
      background: ${({ theme }) => theme.bgtotal};
      color: ${({ theme }) => theme.text};
      padding: 11px 12px;
      font: inherit;
    }

    textarea {
      min-height: 76px;
      resize: vertical;
    }

    button {
      border: 0;
      border-radius: 8px;
      background: ${v.colorPrincipal};
      color: #111;
      min-height: 42px;
      font-weight: 900;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    button:disabled {
      opacity: 0.6;
      cursor: wait;
    }
  }

  .panel > form {
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));

    textarea,
    button,
    .checkline {
      grid-column: 1 / -1;
    }
  }

  .checkline {
    display: flex;
    gap: 8px;
    align-items: center;
    font-weight: 700;

    input {
      width: 18px;
      height: 18px;
    }
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;

    .filters {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .searchbox {
      display: flex;
      align-items: center;
      gap: 8px;
      border: 1px solid ${({ theme }) => theme.color2};
      border-radius: 6px;
      background: ${({ theme }) => theme.bgtotal};
      color: ${({ theme }) => theme.colorSubtitle};
      padding-left: 10px;
    }

    input,
    select {
      max-width: 300px;
      border: 1px solid ${({ theme }) => theme.color2};
      border-radius: 6px;
      background: ${({ theme }) => theme.bgtotal};
      color: ${({ theme }) => theme.text};
      padding: 10px 12px;
    }

    .searchbox input {
      border: 0;
      max-width: 220px;
      padding-left: 0;
    }
  }

  .list {
    display: grid;
    gap: 8px;
    margin-top: 12px;

    article {
      border: 1px solid ${({ theme }) => theme.color2};
      border-radius: 8px;
      padding: 10px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;

      strong,
      span {
        min-width: 0;
      }

      span {
        color: ${({ theme }) => theme.colorSubtitle};
        text-align: right;
      }
    }
  }

  .compact article {
    font-size: 13px;
  }

  .invitation-copy {
    display: grid;
    gap: 4px;
    color: ${({ theme }) => theme.text} !important;
    text-align: left !important;

    small {
      width: fit-content;
      border-radius: 999px;
      padding: 3px 8px;
      background: ${({ theme }) => theme.bgtotal};
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 10px;
      font-weight: 800;
    }

    .enviada,
    .aceptada {
      background: rgba(22, 163, 74, 0.12);
      color: #15803d;
    }

    .error,
    .cancelada {
      background: rgba(220, 38, 38, 0.1);
      color: #dc2626;
    }

    .expirada {
      background: rgba(100, 116, 139, 0.12);
      color: #64748b;
    }
  }

  .cancel-invitation {
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 8px;
    background: ${({ theme }) => theme.bgtotal};
    color: ${({ theme }) => theme.colorSubtitle};
    padding: 0 9px;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;

    &:hover {
      border-color: #dc2626;
      color: #dc2626;
    }
  }

  .payment-copy {
    display: grid;
    gap: 3px;
    color: ${({ theme }) => theme.text} !important;
    text-align: left !important;

    small {
      color: ${({ theme }) => theme.colorSubtitle};
      line-height: 1.35;
    }
  }

  .plan-copy {
    display: grid;
    gap: 3px;
    color: ${({ theme }) => theme.text} !important;
    text-align: left !important;

    small {
      max-width: 330px;
      overflow: hidden;
      color: ${({ theme }) => theme.colorSubtitle};
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .print-invoice {
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 9px;
    background: ${({ theme }) => theme.bgtotal};
    color: ${({ theme }) => theme.text};
    padding: 0 11px;
    font-weight: 800;
    cursor: pointer;

    &:hover {
      border-color: ${v.colorPrincipal};
      color: #8a7600;
    }
  }

  .table {
    display: grid;
    overflow: auto;
    margin-top: 10px;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 8px;
  }

  .client-pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 12px;
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 12px;

    > div {
      display: flex;
      gap: 7px;
    }

    button {
      min-height: 34px;
      border: 1px solid ${({ theme }) => theme.color2};
      border-radius: 8px;
      background: ${({ theme }) => theme.bgtotal};
      color: ${({ theme }) => theme.text};
      padding: 0 10px;
      font-weight: 800;
      cursor: pointer;

      &:disabled {
        cursor: not-allowed;
        opacity: 0.35;
      }
    }
  }

  .row {
    min-width: 720px;
    display: grid;
    grid-template-columns: 1.4fr 1.2fr 1fr 0.8fr;
    gap: 10px;
    border-bottom: 1px solid ${({ theme }) => theme.color2};
    padding: 11px 12px;
    align-items: center;
  }

  .message-row {
    grid-template-columns: 1.3fr 1fr 1fr 0.8fr 1.2fr;
  }

  .head {
    font-weight: 900;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .status {
    width: max-content;
    border-radius: 999px;
    padding: 4px 10px;
    background: ${({ theme }) => theme.bg6};
    color: ${({ theme }) => theme.color1};
    font-size: 12px;
    font-weight: 900;
  }

  .status.suspendido,
  .status.vencido,
  .status.ausente {
    background: rgba(245, 78, 65, 0.16);
    color: ${v.colorError};
  }

  .status.error {
    background: rgba(245, 78, 65, 0.16);
    color: ${v.colorError};
  }

  .status.pendiente,
  .status.borrador {
    background: rgba(217, 119, 6, 0.16);
    color: #d97706;
  }

  .status.enviado {
    background: rgba(22, 163, 74, 0.16);
    color: #16a34a;
  }

  .template-grid,
  .automation-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;

    form {
      border: 1px solid ${({ theme }) => theme.color2};
      border-radius: 8px;
      padding: 12px;
      background: ${({ theme }) => theme.bgtotal};
    }

    strong {
      text-transform: capitalize;
    }
  }

  .message-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;

    form {
      display: inline-flex;
    }

    button,
    .wa-link {
      min-height: 34px;
      border: 0;
      border-radius: 8px;
      padding: 0 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-weight: 800;
      text-decoration: none;
      cursor: pointer;
    }

    button {
      background: ${({ theme }) => theme.bg6};
      color: ${({ theme }) => theme.color1};
    }

    .wa-link {
      background: #16a34a;
      color: #fff;
    }
  }

  .permissions-overview {
    gap: 12px;
  }

  .permissions-heading {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 16px;
    padding: 18px 20px;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 16px;
    background: ${({ theme }) => theme.bgcards};

    h2,
    p {
      margin: 0;
    }

    h2 {
      margin: 2px 0 4px;
      font-size: 22px;
      letter-spacing: -0.025em;
    }

    p,
    small {
      color: ${({ theme }) => theme.colorSubtitle};
    }
  }

  .permissions-heading-icon {
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    border-radius: 14px;
    background: #172554;
    color: #fff;
    font-size: 22px;
    box-shadow: 0 10px 20px rgba(23, 37, 84, 0.2);
  }

  .section-kicker {
    color: #2563eb;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .security-state {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 13px;
    border: 1px solid rgba(22, 163, 74, 0.2);
    border-radius: 12px;
    background: rgba(22, 163, 74, 0.07);
    color: #15803d;

    > span {
      display: grid;
      gap: 1px;
    }

    small {
      font-size: 11px;
    }
  }

  .permission-insights {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .access-summary-card {
    display: grid;
    gap: 15px;
    padding: 18px;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 16px;
    background: ${({ theme }) => theme.bgcards};

    footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 12px;
    }

    footer strong {
      color: ${({ theme }) => theme.text};
      font-size: 14px;
    }
  }

  .card-heading,
  .panel-heading {
    display: flex;
    align-items: center;
    gap: 12px;

    > span:last-child,
    > div {
      display: grid;
      gap: 3px;
    }

    strong {
      font-size: 14px;
    }

    small,
    p {
      margin: 0;
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 12px;
    }
  }

  .card-icon {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    border-radius: 11px;
    font-size: 17px;
  }

  .card-icon.green { background: rgba(22, 163, 74, 0.1); color: #15803d; }
  .card-icon.blue { background: rgba(37, 99, 235, 0.1); color: #2563eb; }
  .card-icon.violet { background: rgba(124, 58, 237, 0.1); color: #7c3aed; }

  .progress-line {
    height: 7px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(22, 163, 74, 0.1);

    div {
      height: 100%;
      min-width: 3px;
      border-radius: inherit;
      background: linear-gradient(90deg, #16a34a, #4ade80);
    }
  }

  .progress-line.blue {
    background: rgba(37, 99, 235, 0.1);

    div {
      background: linear-gradient(90deg, #2563eb, #38bdf8);
    }
  }

  .permissions-workspace {
    gap: 12px;
  }

  .permission-panel {
    padding: 20px;
  }

  .panel-heading {
    margin-bottom: 18px;

    h2 {
      margin: 0;
      font-size: 17px;
    }
  }

  .permission-panel > .permission-form {
    display: grid;
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .field-group {
    display: grid;
    gap: 7px;

    > span {
      font-size: 12px;
      font-weight: 800;
    }
  }

  .permission-form select {
    min-height: 46px;
    border-radius: 10px;
    background: ${({ theme }) => theme.bgcards};
  }

  .switchline {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 14px;
    position: relative;
    padding: 13px 14px;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 12px;
    cursor: pointer;

    > span {
      display: grid;
      gap: 3px;
    }

    small {
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 11px;
    }

    input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    i {
      width: 42px;
      height: 24px;
      position: relative;
      border-radius: 999px;
      background: #cbd5e1;
      transition: background 160ms ease;
    }

    i::after {
      content: "";
      width: 18px;
      height: 18px;
      position: absolute;
      top: 3px;
      left: 3px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 4px rgba(15, 23, 42, 0.24);
      transition: transform 160ms ease;
    }

    input:checked + i { background: #16a34a; }
    input:checked + i::after { transform: translateX(18px); }
    input:focus-visible + i { outline: 3px solid rgba(37, 99, 235, 0.24); }
  }

  .permission-selects {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .permission-options {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
    padding: 0;
    border: 0;

    legend {
      margin-bottom: 8px;
      font-size: 12px;
      font-weight: 800;
    }

    label {
      position: relative;
      cursor: pointer;
    }

    input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    label > span {
      min-height: 82px;
      display: grid;
      align-content: center;
      justify-items: center;
      gap: 3px;
      border: 1px solid ${({ theme }) => theme.color2};
      border-radius: 11px;
      color: ${({ theme }) => theme.colorSubtitle};
      text-align: center;
      transition: 160ms ease;
    }

    svg { font-size: 17px; }
    small { font-size: 10px; }

    input:checked + span {
      border-color: #2563eb;
      background: rgba(37, 99, 235, 0.08);
      color: #2563eb;
      box-shadow: inset 0 0 0 1px #2563eb;
    }

    input:focus-visible + span { outline: 3px solid rgba(37, 99, 235, 0.22); }
  }

  .permission-form .primary-action {
    min-height: 46px;
    border-radius: 11px;
    background: #172554;
    color: #fff;
    box-shadow: 0 8px 18px rgba(23, 37, 84, 0.18);
  }

  .module-status-list {
    display: grid;
    gap: 7px;
    max-height: 224px;
    overflow: auto;
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid ${({ theme }) => theme.color2};

    article {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 9px;
      padding: 9px 10px;
      border-radius: 10px;
      background: ${({ theme }) => theme.bgtotal};
      font-size: 12px;
    }
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .status-dot.enabled { background: #22c55e; }
  .status-dot.disabled { background: #f59e0b; }

  .access-badge,
  .matrix-count {
    border-radius: 999px;
    padding: 4px 8px;
    font-size: 10px;
    font-weight: 900;
  }

  .access-badge.enabled { background: rgba(22, 163, 74, 0.1); color: #15803d; }
  .access-badge.disabled { background: rgba(217, 119, 6, 0.1); color: #b45309; }

  .empty-state {
    margin: 0;
    padding: 18px;
    border: 1px dashed ${({ theme }) => theme.color2};
    border-radius: 10px;
    color: ${({ theme }) => theme.colorSubtitle};
    text-align: center;
  }

  .permission-matrix {
    padding: 20px;
  }

  .matrix-heading {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .matrix-count {
    background: ${({ theme }) => theme.bgtotal};
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .permission-table {
    margin-top: 0;
    border-radius: 12px;
  }

  .permission-table .head {
    background: ${({ theme }) => theme.bgtotal};
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .matrix-empty {
    min-height: 160px;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 5px;
    padding: 24px;
    color: ${({ theme }) => theme.colorSubtitle};
    text-align: center;

    > span {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      margin-bottom: 4px;
      border-radius: 12px;
      background: rgba(37, 99, 235, 0.08);
      color: #2563eb;
      font-size: 20px;
    }

    strong { color: ${({ theme }) => theme.text}; }
    p { margin: 0; font-size: 12px; }
  }

  .empty {
    color: ${({ theme }) => theme.colorSubtitle};
    margin: 8px 0 0;
  }

  .error {
    border: 1px solid ${v.colorError};
    border-radius: 8px;
    color: ${v.colorError};
    padding: 10px 12px;
    background: rgba(245, 78, 65, 0.08);
  }

  @media (max-width: 900px) {
    .header {
      align-items: flex-start;
      flex-direction: column;
    }

    .summary-grid,
    .quick-actions,
    .metric-grid,
    .operations-grid,
    .chart-grid,
    .chart-grid.two,
    .permission-insights,
    .two-cols,
    .template-grid,
    .automation-grid {
      grid-template-columns: 1fr;
    }

    .panel > form {
      grid-template-columns: 1fr;
    }

    .invoice-checkout {
      grid-template-columns: 1fr;
    }

    .wide {
      grid-column: auto;
    }

    .toolbar {
      align-items: stretch;
      flex-direction: column;

      input {
        max-width: none;
      }

      .filters,
      .searchbox,
      select {
        width: 100%;
      }

      .searchbox input {
        max-width: none;
      }
    }

    .permissions-heading {
      grid-template-columns: auto minmax(0, 1fr);

      .security-state {
        grid-column: 1 / -1;
        width: 100%;
      }
    }

    .permission-options {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 560px) {
    padding: 14px 12px 36px;

    .header {
      padding: 20px;
      border-radius: 16px;
    }

    .tabs {
      flex-wrap: nowrap;
      overflow-x: auto;
      justify-content: flex-start;

      button {
        flex: 0 0 auto;
      }
    }

    .quick-actions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .permissions-heading {
      grid-template-columns: 1fr;

      .permissions-heading-icon {
        width: 42px;
        height: 42px;
      }
    }

    .permission-selects,
    .permission-options {
      grid-template-columns: 1fr;
    }

    .matrix-heading {
      grid-template-columns: auto minmax(0, 1fr);

      .matrix-count {
        grid-column: 1 / -1;
        width: max-content;
      }
    }
  }
`;
