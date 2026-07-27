import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FiAlertTriangle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiCreditCard,
  FiEdit3,
  FiEye,
  FiMail,
  FiPlus,
  FiSearch,
  FiUserCheck,
  FiUserX,
  FiX,
} from "react-icons/fi";
import styled from "styled-components";
import { v } from "../../../styles/variables";

const financialCopy = {
  al_dia: { label: "Al día", tone: "ok", icon: FiUserCheck },
  por_vencer: { label: "Por vencer", tone: "warning", icon: FiClock },
  moroso: { label: "Moroso", tone: "danger", icon: FiAlertTriangle },
  inactiva: { label: "Inactiva", tone: "muted", icon: FiUserX },
  sin_suscripcion: { label: "Sin suscripción", tone: "neutral", icon: FiUserX },
};

function currency(value, code, locale) {
  try {
    return new Intl.NumberFormat(locale || "es-NI", {
      style: "currency",
      currency: code || "USD",
    }).format(Number(value || 0));
  } catch {
    return `${code || "USD"} ${Number(value || 0).toFixed(2)}`;
  }
}

function fullName(item) {
  return [item?.nombres, item?.apellidos].filter(Boolean).join(" ") || "Cliente";
}

function formatDate(value, locale = "es-NI") {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function FinancialBadge({ value }) {
  const status = financialCopy[value] || financialCopy.sin_suscripcion;
  const Icon = status.icon;
  return <span className={`financial-badge ${status.tone}`}><Icon />{status.label}</span>;
}

function Pagination({ pagination, onPage }) {
  return (
    <footer className="pagination">
      <span>
        {pagination.total
          ? `${pagination.from}–${pagination.to} de ${pagination.total} clientes`
          : "Sin clientes con estos filtros"}
      </span>
      <div>
        <button type="button" onClick={() => onPage(pagination.page - 1)} disabled={!pagination.hasPreviousPage}>
          <FiChevronLeft /> Anterior
        </button>
        <b>{pagination.page} / {pagination.totalPages}</b>
        <button type="button" onClick={() => onPage(pagination.page + 1)} disabled={!pagination.hasNextPage}>
          Siguiente <FiChevronRight />
        </button>
      </div>
    </footer>
  );
}

export function CrmClientsWorkspace({
  crm,
  dataempresa,
  mutation,
  submitForm,
  onNavigate,
  onCharge,
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [clientStatus, setClientStatus] = useState("todos");
  const [financialStatus, setFinancialStatus] = useState("todos");
  const [planId, setPlanId] = useState("todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => setPage(1), [clientStatus, financialStatus, planId, pageSize]);

  const directoryQuery = useQuery({
    queryKey: ["crm-clients-directory", dataempresa?.id, page, pageSize, debouncedSearch, clientStatus, financialStatus, planId],
    queryFn: () => crm.mostrarClientesPage({
      id_empresa: dataempresa.id,
      page,
      pageSize,
      search: debouncedSearch,
      clientStatus,
      financialStatus,
      planId,
    }),
    enabled: Boolean(dataempresa?.id),
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
  });

  const result = directoryQuery.data || {
    data: [],
    pagination: { page, totalPages: 1, total: 0, from: 0, to: 0, hasPreviousPage: false, hasNextPage: false },
  };

  const selectedClient = useMemo(
    () => result.data.find((item) => item.id === selected?.id) || selected,
    [result.data, selected]
  );

  const invitationSummary = crm.invitaciones.filter((item) => item.estado === "pendiente").slice(0, 3);

  return (
    <Container>
      <header className="hero">
        <div>
          <span className="eyebrow"><FiUserCheck /> Directorio operativo</span>
          <h2>Clientes, cobros y membresías en orden</h2>
          <p>Gestiona la relación con cada cliente. La suscripción se administra en su módulo; desde aquí ves su salud financiera y actúas rápido.</p>
        </div>
        <button type="button" className="primary" onClick={() => document.getElementById("crm-new-client")?.scrollIntoView({ behavior: "smooth", block: "center" })}>
          <FiPlus /> Nuevo cliente
        </button>
      </header>

      <section className="onboarding-grid" id="crm-new-client">
        <article className="quick-card">
          <header><span><FiPlus /></span><div><h3>Registrar cliente</h3><p>Alta rápida para atención o POS.</p></div></header>
          <form onSubmit={submitForm("cliente")}>
            <input name="nombres" placeholder="Nombres" required />
            <input name="apellidos" placeholder="Apellidos" />
            <input name="email" type="email" placeholder="Correo" />
            <input name="telefono" placeholder="Teléfono" />
            <select name="estado" defaultValue="activo"><option value="activo">Activo</option><option value="prospecto">Prospecto</option><option value="inactivo">Inactivo</option><option value="suspendido">Suspendido</option></select>
            <button disabled={mutation.isPending}>Guardar cliente</button>
          </form>
        </article>

        <article className="quick-card invitation">
          <header><span><FiMail /></span><div><h3>Invitar con plan</h3><p>La cuenta se activa al aceptar el correo.</p></div></header>
          <form onSubmit={submitForm("invitacion")}>
            <input name="email" type="email" placeholder="cliente@correo.com" required />
            <select name="id_plan" defaultValue="" required>
              <option value="">Selecciona el plan obligatorio</option>
              {crm.planes.filter((plan) => plan.activo).map((plan) => <option key={plan.id} value={plan.id}>{plan.nombre} · {currency(plan.precio, dataempresa?.currency, dataempresa?.iso)}</option>)}
            </select>
            <button disabled={mutation.isPending || !crm.planes.some((plan) => plan.activo)}><FiMail /> Enviar invitación</button>
          </form>
          {invitationSummary.length ? <div className="pending-invitations">{invitationSummary.map((item) => <span key={item.id}>{item.email} · {item.estado_envio === "error" ? "Revisar envío" : "Pendiente"}</span>)}</div> : null}
        </article>
      </section>

      <section className="directory">
        <div className="directory-header">
          <div><h3>Directorio de clientes</h3><p>Filtra por estado comercial, salud de pago o plan.</p></div>
          <label className="page-size">Mostrar <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label>
        </div>
        <div className="filters">
          <label className="search"><FiSearch /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Código, cliente, correo o teléfono" /></label>
          <select value={financialStatus} onChange={(event) => setFinancialStatus(event.target.value)}><option value="todos">Salud financiera: todas</option><option value="al_dia">Al día</option><option value="por_vencer">Por vencer</option><option value="moroso">Morosos</option><option value="sin_suscripcion">Sin suscripción</option><option value="inactiva">Inactivos</option></select>
          <select value={clientStatus} onChange={(event) => setClientStatus(event.target.value)}><option value="todos">Estado comercial: todos</option><option value="activo">Activos</option><option value="prospecto">Prospectos</option><option value="inactivo">Inactivos</option><option value="suspendido">Suspendidos</option></select>
          <select value={planId} onChange={(event) => setPlanId(event.target.value)}><option value="todos">Todos los planes</option>{crm.planes.map((plan) => <option key={plan.id} value={plan.id}>{plan.nombre}</option>)}</select>
        </div>

        <div className="table-wrap">
          <div className="row head"><span>Cliente</span><span>Plan y vigencia</span><span>Estado financiero</span><span>Contacto</span><span>Acciones</span></div>
          {directoryQuery.isLoading ? <p className="empty">Cargando directorio…</p> : null}
          {!directoryQuery.isLoading && result.data.map((item) => (
            <div className="row" key={item.id}>
              <span className="customer"><b>{fullName(item)}</b><small>{item.codigo || "Sin código"} · {item.estado_cliente}</small></span>
              <span className="plan"><b>{item.plan_nombre || "Sin suscripción"}</b><small>{item.fecha_fin ? `Vence ${formatDate(item.fecha_fin, dataempresa?.iso)}` : "Sin vigencia"}</small></span>
              <span><FinancialBadge value={item.estado_financiero} />{item.estado_financiero === "moroso" && Number(item.saldo_vencido) > 0 ? <small className="debt">{currency(item.saldo_vencido, dataempresa?.currency, dataempresa?.iso)} vencido</small> : null}</span>
              <span className="contact"><b>{item.email || "Sin correo"}</b><small>{item.telefono || "Sin teléfono"}</small></span>
              <span className="actions"><button type="button" title="Ver ficha" onClick={() => { setSelected(item); setEditing(false); }}><FiEye /></button><button type="button" title="Editar cliente" onClick={() => { setSelected(item); setEditing(true); }}><FiEdit3 /></button><button type="button" title="Cobrar" onClick={() => onCharge(item)}><FiCreditCard /></button></span>
            </div>
          ))}
          {!directoryQuery.isLoading && !result.data.length ? <p className="empty">No hay clientes que coincidan con los filtros.</p> : null}
        </div>
        <Pagination pagination={result.pagination} onPage={setPage} />
      </section>

      {selectedClient ? <aside className="drawer" aria-label="Ficha del cliente">
        <header><div><span className="eyebrow">Ficha de cliente</span><h3>{fullName(selectedClient)}</h3><p>{selectedClient.codigo || "Sin código"} · {selectedClient.origen || "manual"}</p></div><button type="button" className="icon-close" onClick={() => setSelected(null)}><FiX /></button></header>
        {editing ? (
          <form className="edit-form" onSubmit={(event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries()); mutation.mutate({ action: "editar_cliente", values: { ...values, id: selectedClient.id } }, { onSuccess: () => setEditing(false) }); }}>
            <input name="nombres" defaultValue={selectedClient.nombres || ""} required />
            <input name="apellidos" defaultValue={selectedClient.apellidos || ""} placeholder="Apellidos" />
            <input name="email" type="email" defaultValue={selectedClient.email || ""} placeholder="Correo" />
            <input name="telefono" defaultValue={selectedClient.telefono || ""} placeholder="Teléfono" />
            <input name="direccion" defaultValue={selectedClient.direccion || ""} placeholder="Dirección" />
            <select name="estado" defaultValue={selectedClient.estado_cliente || "activo"}><option value="activo">Activo</option><option value="prospecto">Prospecto</option><option value="inactivo">Inactivo</option><option value="suspendido">Suspendido</option></select>
            <div><button type="button" className="ghost" onClick={() => setEditing(false)}>Cancelar</button><button disabled={mutation.isPending}>Guardar cambios</button></div>
          </form>
        ) : (
          <>
            <div className="facts"><span><small>Estado financiero</small><FinancialBadge value={selectedClient.estado_financiero} /></span><span><small>Plan actual</small><b>{selectedClient.plan_nombre || "Sin suscripción"}</b></span><span><small>Vigencia</small><b>{formatDate(selectedClient.fecha_fin, dataempresa?.iso)}</b></span><span><small>Último pago</small><b>{selectedClient.ultimo_pago_at ? currency(selectedClient.ultimo_pago_monto, dataempresa?.currency, dataempresa?.iso) : "Sin pagos"}</b></span></div>
            <div className="drawer-actions"><button type="button" onClick={() => onCharge(selectedClient)}><FiCreditCard /> Cobrar</button><button type="button" className="ghost" onClick={() => onNavigate("suscripciones")}><FiEdit3 /> Gestionar suscripción</button></div>
          </>
        )}
      </aside> : null}
    </Container>
  );
}

const Container = styled.section`
  width: min(1380px, 100%); margin: 0 auto; display: grid; gap: 16px;
  .hero, .quick-card, .directory, .drawer { border: 1px solid ${({ theme }) => theme.color2}; background: ${({ theme }) => theme.bgcards}; color: ${({ theme }) => theme.text}; border-radius: 18px; }
  .hero { display:flex; justify-content:space-between; align-items:center; gap:20px; padding:24px; background:linear-gradient(120deg,rgba(56,189,248,.13),transparent 48%),${({ theme }) => theme.bgcards}; }
  .eyebrow { display:inline-flex; align-items:center; gap:6px; color:#0284c7; font-size:11px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; }
  h2,h3,p { margin:0; } .hero h2 { margin:7px 0; font-size:clamp(23px,3vw,32px); } .hero p,.directory-header p,.quick-card header p { color:${({ theme }) => theme.colorSubtitle}; line-height:1.45; }
  button { border:0; border-radius:10px; background:${v.colorPrincipal}; color:#111827; font-weight:850; padding:11px 14px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:7px; } button:disabled{opacity:.52;cursor:not-allowed}.primary{white-space:nowrap}.ghost{background:${({ theme }) => theme.bgtotal};color:${({ theme }) => theme.text};border:1px solid ${({ theme }) => theme.color2}!important}
  .onboarding-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.quick-card{padding:18px}.quick-card header{display:flex;gap:11px;margin-bottom:14px}.quick-card header>span{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;background:#eff6ff;color:#0284c7}.quick-card form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.quick-card form input:first-child,.quick-card form input:nth-child(3),.quick-card form select,.quick-card form button{grid-column:span 2}.quick-card input,.quick-card select,.filters input,.filters select,.edit-form input,.edit-form select{min-width:0;border:1px solid ${({ theme }) => theme.color2};border-radius:10px;background:${({ theme }) => theme.bgtotal};color:${({ theme }) => theme.text};padding:11px}.pending-invitations{display:grid;gap:5px;margin-top:11px;font-size:12px;color:${({ theme }) => theme.colorSubtitle}}
  .directory{padding:20px}.directory-header{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:16px}.page-size{display:flex;align-items:center;gap:7px;font-size:13px}.page-size select{border:1px solid ${({ theme }) => theme.color2};border-radius:8px;background:${({ theme }) => theme.bgtotal};color:${({ theme }) => theme.text};padding:6px}.filters{display:grid;grid-template-columns:minmax(220px,1.5fr) repeat(3,minmax(150px,1fr));gap:9px;margin-bottom:14px}.search{display:flex;align-items:center;gap:8px;border:1px solid ${({ theme }) => theme.color2};border-radius:10px;background:${({ theme }) => theme.bgtotal};padding-left:11px}.search input{border:0;background:transparent;width:100%;outline:0}
  .table-wrap{overflow-x:auto;border:1px solid ${({ theme }) => theme.color2};border-radius:13px}.row{min-width:930px;display:grid;grid-template-columns:1.2fr 1fr 1fr 1.25fr 122px;gap:13px;align-items:center;padding:13px 15px;border-bottom:1px solid ${({ theme }) => theme.color2};font-size:13px}.row:last-child{border-bottom:0}.row.head{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;background:${({ theme }) => theme.bgtotal}}.row span{min-width:0}.row b,.row small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.row small{margin-top:4px;color:${({ theme }) => theme.colorSubtitle}}.financial-badge{width:max-content;display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;font-size:11px;font-weight:900}.financial-badge.ok{background:#dcfce7;color:#166534}.financial-badge.warning{background:#fef3c7;color:#92400e}.financial-badge.danger{background:#fee2e2;color:#b91c1c}.financial-badge.muted{background:#e2e8f0;color:#475569}.financial-badge.neutral{background:#e0f2fe;color:#0369a1}.debt{color:#dc2626!important;font-weight:800}.actions{display:flex;gap:6px}.actions button{padding:8px;background:${({ theme }) => theme.bgtotal};color:${({ theme }) => theme.text};border:1px solid ${({ theme }) => theme.color2}}.empty{padding:24px;text-align:center;color:${({ theme }) => theme.colorSubtitle}}
  .pagination{display:flex;justify-content:space-between;align-items:center;gap:14px;padding-top:14px;font-size:13px;color:${({ theme }) => theme.colorSubtitle}}.pagination div{display:flex;align-items:center;gap:8px}.pagination button{padding:8px 10px;background:${({ theme }) => theme.bgtotal};color:${({ theme }) => theme.text};border:1px solid ${({ theme }) => theme.color2}}
  .drawer{position:fixed;z-index:30;right:22px;bottom:22px;width:min(470px,calc(100vw - 32px));padding:20px;box-shadow:0 18px 45px rgba(15,23,42,.22)}.drawer header{display:flex;justify-content:space-between;gap:10px}.drawer h3{margin:5px 0}.drawer p{color:${({ theme }) => theme.colorSubtitle};font-size:13px}.icon-close{padding:8px;background:${({ theme }) => theme.bgtotal};color:${({ theme }) => theme.text}}.facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:18px 0}.facts span{border-radius:11px;background:${({ theme }) => theme.bgtotal};padding:11px}.facts small{display:block;margin-bottom:5px;color:${({ theme }) => theme.colorSubtitle};font-size:11px}.drawer-actions,.edit-form>div{display:flex;gap:9px}.drawer-actions button,.edit-form>div button{flex:1}.edit-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:17px}.edit-form input:nth-child(5),.edit-form select,.edit-form>div{grid-column:span 2}
  @media(max-width:860px){.hero,.directory-header{align-items:start;flex-direction:column}.onboarding-grid{grid-template-columns:1fr}.filters{grid-template-columns:1fr}.drawer{right:16px;bottom:16px}.quick-card form{grid-template-columns:1fr}.quick-card form>*{grid-column:span 1!important}}
`;
