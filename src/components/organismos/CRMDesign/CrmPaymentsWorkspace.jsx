import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiAlertCircle, FiCreditCard, FiDollarSign, FiFileText, FiPrinter, FiRefreshCw } from "react-icons/fi";
import styled from "styled-components";
import { toast } from "sonner";
import FacturaCliente from "../../../reports/FacturaCliente";
import { v } from "../../../styles/variables";

const methods = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "deposito", label: "Depósito" },
  { value: "otro", label: "Otro" },
];

function money(value, currency, locale) {
  try { return new Intl.NumberFormat(locale || "es-NI", { style: "currency", currency: currency || "USD" }).format(Number(value || 0)); }
  catch { return `${currency || "USD"} ${Number(value || 0).toFixed(2)}`; }
}

function nameOf(item) { return [item?.nombres, item?.apellidos].filter(Boolean).join(" ") || "Cliente"; }
function todayMonth() { return new Date().toISOString().slice(0, 7); }

function PaymentFields({ method, total, received, setReceived }) {
  const isCash = method === "efectivo";
  const requiresReference = ["transferencia", "deposito"].includes(method);
  const change = Math.max(0, Number(received || 0) - Number(total || 0));
  return <>
    {isCash ? <label>Recibido en caja<input name="monto_recibido" type="number" min={total || 0} step="0.01" value={received} onChange={(event) => setReceived(event.target.value)} required /></label> : null}
    {requiresReference ? <label>Referencia bancaria<input name="referencia_pago" placeholder="N.º de operación" required /></label> : null}
    {isCash ? <div className="change"><span>Vuelto</span><strong>{money(change, undefined, "es-NI")}</strong></div> : null}
  </>;
}

export function CrmPaymentsWorkspace({ crm, dataempresa, initialClientId = "", onClientHandled }) {
  const queryClient = useQueryClient();
  const [subscriptionId, setSubscriptionId] = useState("");
  const [invoiceMethod, setInvoiceMethod] = useState("efectivo");
  const [invoiceReceived, setInvoiceReceived] = useState("");
  const [directClientId, setDirectClientId] = useState(initialClientId);
  const [directSubscriptionId, setDirectSubscriptionId] = useState("");
  const [directMethod, setDirectMethod] = useState("efectivo");
  const [directAmount, setDirectAmount] = useState("");
  const [directReceived, setDirectReceived] = useState("");
  const [month, setMonth] = useState(todayMonth());

  useEffect(() => { if (initialClientId) setDirectClientId(String(initialClientId)); }, [initialClientId]);

  const invoiceSubscription = crm.suscripciones.find((item) => String(item.id) === String(subscriptionId));
  const invoiceTotal = Number(invoiceSubscription?.precio_pactado || invoiceSubscription?.crm_planes?.precio || 0);
  const directSubscriptions = crm.suscripciones.filter((item) => !directClientId || String(item.id_cliente_crm) === String(directClientId));
  const reportQuery = useQuery({ queryKey: ["crm-monthly-income", month], queryFn: () => crm.mostrarReporteIngresosMensual({ mes: `${month}-01` }), enabled: Boolean(month), refetchOnWindowFocus: false });
  const monthlyRows = reportQuery.data || [];
  const monthlyTotal = monthlyRows.reduce((sum, item) => sum + Number(item.total_ingresos || 0), 0);
  const monthlyPayments = monthlyRows.reduce((sum, item) => sum + Number(item.cantidad_pagos || 0), 0);

  const handleSuccess = async (result, message) => {
    toast.success(message);
    queryClient.invalidateQueries({ queryKey: ["crm-data"] });
    queryClient.invalidateQueries({ queryKey: ["crm-clients-directory"] });
    queryClient.invalidateQueries({ queryKey: ["crm-subscriptions"] });
    queryClient.invalidateQueries({ queryKey: ["crm-monthly-income"] });
    if (result?.pago) await FacturaCliente("print", { dataempresa, pago: result.pago, cliente: result.cliente, suscripcion: result.suscripcion, plan: result.plan });
  };
  const invoiceMutation = useMutation({ mutationFn: (payload) => crm.cobrarSuscripcionPos(payload), onSuccess: (data) => { void handleSuccess(data, "Cobro registrado e impresión preparada"); setSubscriptionId(""); setInvoiceReceived(""); }, onError: (error) => toast.error(error.message) });
  const directMutation = useMutation({ mutationFn: (payload) => crm.registrarPagoPos(payload), onSuccess: (data) => { void handleSuccess(data, "Pago registrado e impresión preparada"); setDirectAmount(""); setDirectReceived(""); setDirectSubscriptionId(""); onClientHandled?.(); }, onError: (error) => toast.error(error.message) });

  return <Container>
    <header className="hero"><div><span className="eyebrow"><FiCreditCard /> Caja CRM</span><h2>Cobros con lógica de POS</h2><p>El total, recibido, vuelto y referencias quedan registrados en la factura y en el reporte mensual.</p></div></header>
    <section className="metric-grid"><article><span>Ingresos del mes</span><strong>{money(monthlyTotal, dataempresa?.currency, dataempresa?.iso)}</strong><small>{month}</small></article><article><span>Cobros registrados</span><strong>{monthlyPayments}</strong><small>Pagos efectivamente cobrados</small></article><article><span>Vuelto entregado</span><strong>{money(monthlyRows.reduce((sum, item) => sum + Number(item.total_vuelto || 0), 0), dataempresa?.currency, dataempresa?.iso)}</strong><small>Control de efectivo</small></article></section>
    <section className="workspace">
      <article className="panel invoice"><header><span><FiFileText /></span><div><h3>Facturar una suscripción</h3><p>Solo selecciona una membresía vigente y cobra como en el POS.</p></div></header><form onSubmit={(event) => { event.preventDefault(); invoiceMutation.mutate({ id_suscripcion: subscriptionId, metodo_pago: invoiceMethod, monto_recibido: invoiceMethod === "efectivo" ? invoiceReceived : null, referencia_pago: new FormData(event.currentTarget).get("referencia_pago"), notas: new FormData(event.currentTarget).get("notas") }); }}>
        <label>Cliente y suscripción<select value={subscriptionId} onChange={(event) => { setSubscriptionId(event.target.value); const value = crm.suscripciones.find((item) => String(item.id) === event.target.value); setInvoiceReceived(value ? String(Number(value.precio_pactado || value.crm_planes?.precio || 0)) : ""); }} required><option value="">Selecciona una suscripción</option>{crm.suscripciones.filter((item) => item.estado !== "cancelada").map((item) => <option key={item.id} value={item.id}>{nameOf(item.clientes_crm)} · {item.crm_planes?.nombre} · {money(item.precio_pactado, dataempresa?.currency, dataempresa?.iso)}</option>)}</select></label>
        <div className="total"><span>Total a cobrar</span><strong>{money(invoiceTotal, dataempresa?.currency, dataempresa?.iso)}</strong></div>
        <label>Método<select value={invoiceMethod} onChange={(event) => setInvoiceMethod(event.target.value)}>{methods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></label>
        <PaymentFields method={invoiceMethod} total={invoiceTotal} received={invoiceReceived} setReceived={setInvoiceReceived} />
        <label className="wide">Notas<input name="notas" placeholder="Observación opcional" /></label><button disabled={invoiceMutation.isPending || !subscriptionId || (invoiceMethod === "efectivo" && Number(invoiceReceived || 0) < invoiceTotal)}><FiPrinter /> {invoiceMutation.isPending ? "Cobrando…" : "Cobrar e imprimir factura"}</button>
      </form></article>
      <article className="panel direct"><header><span><FiDollarSign /></span><div><h3>Registrar cobro directo</h3><p>Para abonos o servicios fuera de una suscripción.</p></div></header><form onSubmit={(event) => { event.preventDefault(); directMutation.mutate({ id_cliente_crm: directClientId, id_suscripcion: directSubscriptionId || null, monto: directAmount, metodo_pago: directMethod, monto_recibido: directMethod === "efectivo" ? directReceived : null, referencia_pago: new FormData(event.currentTarget).get("referencia_pago"), fecha_vencimiento: new FormData(event.currentTarget).get("fecha_vencimiento"), notas: new FormData(event.currentTarget).get("notas") }); }}>
        <label>Cliente<select value={directClientId} onChange={(event) => { setDirectClientId(event.target.value); setDirectSubscriptionId(""); }} required><option value="">Selecciona un cliente</option>{crm.clientes.map((client) => <option key={client.id} value={client.id}>{nameOf(client)}</option>)}</select></label>
        <label>Suscripción (opcional)<select value={directSubscriptionId} onChange={(event) => { setDirectSubscriptionId(event.target.value); const item = crm.suscripciones.find((subscription) => String(subscription.id) === event.target.value); if (item) { const total = Number(item.precio_pactado || item.crm_planes?.precio || 0); setDirectAmount(String(total)); setDirectReceived(String(total)); } }}><option value="">Sin suscripción</option>{directSubscriptions.map((item) => <option key={item.id} value={item.id}>{item.crm_planes?.nombre || `Suscripción #${item.id}`}</option>)}</select></label>
        <label>Monto a cobrar<input type="number" min="0.01" step="0.01" value={directAmount} onChange={(event) => { setDirectAmount(event.target.value); if (directMethod === "efectivo" && !directReceived) setDirectReceived(event.target.value); }} required /></label><label>Método<select value={directMethod} onChange={(event) => setDirectMethod(event.target.value)}>{methods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></label>
        <PaymentFields method={directMethod} total={Number(directAmount || 0)} received={directReceived} setReceived={setDirectReceived} />
        <label>Vencimiento<input name="fecha_vencimiento" type="date" /></label><label className="wide">Notas<input name="notas" placeholder="Detalle u observación" /></label><button disabled={directMutation.isPending || !directClientId || Number(directAmount || 0) <= 0 || (directMethod === "efectivo" && Number(directReceived || 0) < Number(directAmount || 0))}>{directMutation.isPending ? "Registrando…" : "Registrar e imprimir"}</button>
      </form></article>
    </section>
    <section className="report panel"><header><div><h3>Entradas mensuales</h3><p>Resumen contable de los pagos cobrados.</p></div><label>Mes<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label></header>{reportQuery.isLoading ? <p className="empty">Cargando reporte…</p> : <div className="report-table"><div className="report-row head"><span>Método</span><span>Cobros</span><span>Ingresos</span><span>Recibido</span><span>Vuelto</span></div>{monthlyRows.map((item) => <div className="report-row" key={item.metodo_pago}><span>{item.metodo_pago}</span><span>{item.cantidad_pagos}</span><b>{money(item.total_ingresos, dataempresa?.currency, dataempresa?.iso)}</b><span>{money(item.total_recibido, dataempresa?.currency, dataempresa?.iso)}</span><span>{money(item.total_vuelto, dataempresa?.currency, dataempresa?.iso)}</span></div>)}{!monthlyRows.length ? <p className="empty"><FiAlertCircle /> No hay entradas para este mes.</p> : null}</div>}</section>
  </Container>;
}

const Container = styled.section`
  width:min(1380px,100%);margin:0 auto;display:grid;gap:16px;color:${({theme})=>theme.text};.hero,.panel,.metric-grid article{border:1px solid ${({theme})=>theme.color2};background:${({theme})=>theme.bgcards};border-radius:18px}.hero{padding:23px;background:linear-gradient(120deg,rgba(243,210,12,.15),transparent 48%),${({theme})=>theme.bgcards}}.eyebrow{display:inline-flex;gap:7px;align-items:center;color:#b45309;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}h2,h3,p{margin:0}.hero h2{margin:7px 0;font-size:clamp(23px,3vw,32px)}.hero p,.panel header p{color:${({theme})=>theme.colorSubtitle};line-height:1.45}.metric-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.metric-grid article{padding:16px;display:grid;gap:5px}.metric-grid span,.metric-grid small{color:${({theme})=>theme.colorSubtitle}}.metric-grid strong{font-size:23px}.workspace{display:grid;grid-template-columns:1.2fr .8fr;gap:16px}.panel{padding:18px}.panel>header,.report header{display:flex;justify-content:space-between;gap:12px;align-items:start;margin-bottom:15px}.panel>header>span{display:grid;place-items:center;width:39px;height:39px;border-radius:11px;background:#fef3c7;color:#b45309}.panel>header>div{flex:1}form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}label{display:grid;gap:6px;font-size:12px;font-weight:800}input,select{min-width:0;border:1px solid ${({theme})=>theme.color2};border-radius:10px;background:${({theme})=>theme.bgtotal};color:${({theme})=>theme.text};padding:11px}.invoice form>label:first-child,.wide,form>button{grid-column:span 2}.total,.change{border-radius:11px;background:${({theme})=>theme.bgtotal};padding:11px;display:flex;justify-content:space-between;align-items:center}.total span,.change span{font-size:12px;color:${({theme})=>theme.colorSubtitle}}.total strong{font-size:20px}.change strong{color:#15803d}button{border:0;border-radius:10px;background:${v.colorPrincipal};color:#111827;padding:12px;font-weight:900;cursor:pointer;display:inline-flex;justify-content:center;align-items:center;gap:7px}button:disabled{opacity:.55;cursor:not-allowed}.report header label{display:flex;align-items:center;gap:8px}.report header input{padding:7px}.report-table{overflow-x:auto;border:1px solid ${({theme})=>theme.color2};border-radius:12px}.report-row{min-width:720px;display:grid;grid-template-columns:1.2fr .7fr 1fr 1fr 1fr;gap:10px;padding:12px 14px;border-bottom:1px solid ${({theme})=>theme.color2};font-size:13px}.report-row:last-child{border:0}.report-row.head{background:${({theme})=>theme.bgtotal};font-size:11px;font-weight:900;text-transform:uppercase}.empty{padding:22px;text-align:center;color:${({theme})=>theme.colorSubtitle};display:flex;justify-content:center;align-items:center;gap:7px}@media(max-width:900px){.metric-grid,.workspace{grid-template-columns:1fr}.panel>header{align-items:start}}@media(max-width:560px){form{grid-template-columns:1fr}form>*{grid-column:span 1!important}.metric-grid{grid-template-columns:1fr}.report header{flex-direction:column}}
`;
