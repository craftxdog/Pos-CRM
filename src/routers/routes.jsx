import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "../hooks/ProtectedRoute";
import { Layout } from "../hooks/Layout";
import { Spinner1 } from "../components/moleculas/Spinner1";

const lazyNamed = (loader, exportName) =>
  lazy(() => loader().then((module) => ({ default: module[exportName] })));

const Categorias = lazyNamed(() => import("../pages/Categorias"), "Categorias");
const Configuraciones = lazyNamed(() => import("../pages/Configuraciones"), "Configuraciones");
const Home = lazyNamed(() => import("../pages/Home"), "Home");
const Login = lazyNamed(() => import("../pages/Login"), "Login");
const Productos = lazyNamed(() => import("../pages/Productos"), "Productos");
const POS = lazyNamed(() => import("../pages/POS"), "POS");
const PageNot = lazyNamed(() => import("../components/templates/404"), "PageNot");
const Empresa = lazyNamed(() => import("../pages/Empresa"), "Empresa");
const ClientesProveedores = lazyNamed(() => import("../pages/ClientesProveedores"), "ClientesProveedores");
const CRM = lazyNamed(() => import("../pages/CRM"), "CRM");
const OnboardingCliente = lazyNamed(() => import("../pages/OnboardingCliente"), "OnboardingCliente");
const BasicosConfig = lazyNamed(() => import("../components/organismos/EmpresaConfigDesign/BasicosConfig"), "BasicosConfig");
const MonedaConfig = lazyNamed(() => import("../components/organismos/EmpresaConfigDesign/MonedaConfig"), "MonedaConfig");
const MetodosPago = lazyNamed(() => import("../pages/MetodosPago"), "MetodosPago");
const Dashboard = lazyNamed(() => import("../pages/Dashboard"), "Dashboard");
const SucursalesCaja = lazyNamed(() => import("../pages/SucursalesCaja"), "SucursalesCaja");
const Impresoras = lazyNamed(() => import("../pages/Impresoras"), "Impresoras");
const Usuarios = lazyNamed(() => import("../pages/Usuarios"), "Usuarios");
const Almacenes = lazyNamed(() => import("../pages/Almacenes"), "Almacenes");
const Inventario = lazyNamed(() => import("../pages/Inventario"), "Inventario");
const ConfiguracionTicket = lazyNamed(() => import("../pages/ConfiguracionTicket"), "ConfiguracionTicket");
const MiPerfil = lazyNamed(() => import("../pages/MiPerfil"), "MiPerfil");
const SerializacionComprobantes = lazyNamed(() => import("../pages/SerializacionComprobantes"), "SerializacionComprobantes");
const Reportes = lazyNamed(() => import("../pages/Reportes"), "Reportes");
const ReportInventarios = lazyNamed(() => import("../components/organismos/reports/ReportInventarios"), "ReportInventarios");
const ReportVentas = lazy(() => import("../components/organismos/reports/ReportVentas"));
const ReportStockBajoMinimo = lazy(() => import("../components/organismos/reports/ReportStockBajoMinimo"));

export function MyRoutes() {
  return (
    <Suspense fallback={<Spinner1 />}>
    <Routes>
      <Route
        path="/login"
        element={
          <ProtectedRoute accessBy="non-authenticated">
            <Login />
          </ProtectedRoute>
        }
      />
      <Route path="/onboarding-cliente" element={<OnboardingCliente />} />

      <Route
        path="/configuracion"
        element={
          <Layout>
            <ProtectedRoute accessBy="authenticated">
              <Configuraciones />
            </ProtectedRoute>
          </Layout>
        }
      />
      <Route
        path="/miperfil"
        element={
          <Layout>
            <ProtectedRoute accessBy="authenticated">
              <MiPerfil />
            </ProtectedRoute>
          </Layout>
        }
      />
      
      <Route
        path="/inventario"
        element={
          <Layout>
            <ProtectedRoute accessBy="authenticated">
              <Inventario />
            </ProtectedRoute>
          </Layout>
        }
      />
       <Route
        path="/reportes"
        element={
          <Layout>
            <ProtectedRoute accessBy="authenticated">
              <Reportes />
            </ProtectedRoute>
          </Layout>
        }
      >
        <Route path="inventario_valorado" element={<ReportInventarios/>}  />
        <Route path="report_ventas" element={<ReportVentas/>}  />
         <Route path="report_stock_bajo_minimo" element={<ReportStockBajoMinimo />} />
      </Route>
      <Route
        path="/configuracion/categorias"
        element={
          <Layout>
            <ProtectedRoute accessBy="authenticated">
              <Categorias />
            </ProtectedRoute>
          </Layout>
        }
      />
      <Route
        path="/configuracion/serializacion"
        element={
          <Layout>
            <ProtectedRoute accessBy="authenticated">
              <SerializacionComprobantes />
            </ProtectedRoute>
          </Layout>
        }
      />
      <Route
        path="/configuracion/ticket"
        element={
          <Layout>
            <ProtectedRoute accessBy="authenticated">
              <ConfiguracionTicket />
            </ProtectedRoute>
          </Layout>
        }
      />
      <Route
        path="/configuracion/productos"
        element={
          <Layout>
            <ProtectedRoute accessBy="authenticated">
              <Productos />
            </ProtectedRoute>
          </Layout>
        }
      />
      <Route
        path="/configuracion/empresa"
        element={
          <Layout>
            <ProtectedRoute accessBy="authenticated">
              <Empresa />
            </ProtectedRoute>
          </Layout>
        }
      >
        <Route index element={<Navigate to="empresabasicos" />} />
        <Route path="empresabasicos" element={<BasicosConfig />} />
        <Route path="monedaconfig" element={<MonedaConfig />} />
      </Route>
      <Route
        path="/pos"
        element={
          <Layout>
            <ProtectedRoute accessBy="authenticated">
              <POS />
            </ProtectedRoute>
          </Layout>
        }
      />
      {[
        "/crm",
        "/crm/clientes",
        "/crm/pagos",
        "/crm/horarios",
        "/crm/trabajadores",
        "/crm/whatsapp",
        "/crm/permisos",
        "/configuracion/crm",
      ].map((path) => (
        <Route
          key={path}
          path={path}
          element={
            <Layout>
              <ProtectedRoute accessBy="authenticated">
                <CRM />
              </ProtectedRoute>
            </Layout>
          }
        />
      ))}
      <Route path="*" element={<PageNot />} />
      <Route
        path="/configuracion/clientes"
        element={
          <Layout>
            <ProtectedRoute accessBy="authenticated">
              <ClientesProveedores />
            </ProtectedRoute>
          </Layout>
        }
      />
      <Route
        path="/configuracion/proveedores"
        element={
          <Layout>
            <ProtectedRoute accessBy="authenticated">
              <ClientesProveedores />
            </ProtectedRoute>
          </Layout>
        }
      />
      <Route
        path="/configuracion/metodospago"
        element={
          <Layout>
            <ProtectedRoute accessBy="authenticated">
              <MetodosPago />
            </ProtectedRoute>
          </Layout>
        }
      />
      <Route
        path="/"
        element={
          <Layout>
            <ProtectedRoute accessBy="authenticated">
              <Home />
            </ProtectedRoute>
          </Layout>
        }
      />
      <Route
        path="/dashboard"
        element={
          <Layout>
            <ProtectedRoute accessBy="authenticated">
              <Dashboard />
            </ProtectedRoute>
          </Layout>
        }
      />
      <Route
        path="/configuracion/sucursalcaja"
        element={
          <Layout>
            <ProtectedRoute accessBy="authenticated">
              <SucursalesCaja />
            </ProtectedRoute>
          </Layout>
        }
      />
      <Route
        path="/configuracion/impresoras"
        element={
          <Layout>
            <ProtectedRoute accessBy="authenticated">
              <Impresoras />
            </ProtectedRoute>
          </Layout>
        }
      />
      <Route
        path="/configuracion/usuarios"
        element={
          <Layout>
            <ProtectedRoute accessBy="authenticated">
              <Usuarios />
            </ProtectedRoute>
          </Layout>
        }
      />
      <Route
        path="/configuracion/almacenes"
        element={
          <Layout>
            <ProtectedRoute accessBy="authenticated">
              <Almacenes />
            </ProtectedRoute>
          </Layout>
        }
      />
    </Routes>
    </Suspense>
  );
}
