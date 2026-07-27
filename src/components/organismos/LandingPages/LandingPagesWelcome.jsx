import { useEffect } from "react";
import { FiArchive, FiBookOpen, FiBriefcase, FiDatabase, FiMapPin, FiPrinter, FiShield, FiTool, FiTrendingUp } from "react-icons/fi";
import styled from "styled-components";
import ScrollReveal from "scrollreveal";
import { CardFuncion } from "./CardFuncion";
import { Device } from "../../../styles/breakpoints";
import { BtnLink } from "../../moleculas/BtnLink";
import { useUsuariosStore } from "../../../store/UsuariosStore";

const steps = [
  { icon: FiBookOpen, title: "Aprende desde cero", text: "Gestiona clientes, ventas, pagos y asistencia desde un mismo sistema." },
  { icon: FiTool, title: "Domina herramientas esenciales", text: "Administra productos, trabajadores, roles y permisos." },
  { icon: FiTrendingUp, title: "Aplica lo aprendido", text: "Usa el POS existente junto al control completo de clientes." },
];

export const LandingPagesWelcome = () => {
  const { datausuarios } = useUsuariosStore();
  useEffect(() => {
    const reveal = ScrollReveal();
    reveal.reveal(".left-section", { origin: "left", distance: "40px", duration: 700, easing: "ease-in-out" });
    reveal.reveal(".right-section", { origin: "right", distance: "40px", duration: 700, easing: "ease-in-out" });
    reveal.reveal(".footer-section", { origin: "bottom", distance: "28px", duration: 700, easing: "ease-in-out", delay: 120 });
    return () => reveal.destroy();
  }, []);

  return <Container>
    <ContentSection>
      <SubContentSection>
        <LeftSection className="left-section">
          <span className="eyebrow"><FiShield /> Espacio operativo</span>
          <h1>ActiveSelfControl{datausuarios?.id ? ` · ${datausuarios.id}` : ""}</h1>
          <p className="intro">Todo lo necesario para vender, cobrar y cuidar la relación con cada cliente.</p>
          {steps.map(({ icon: Icon, title, text }) => <Step key={title}><IconPlaceholder><Icon /></IconPlaceholder><Text><Title>{title}</Title><Description>{text}</Description></Text></Step>)}
          <Actions><BtnLink url="/crm" color="#fff" bgcolor="#f97316" titulo="Abrir CRM" /><BtnLink url="/pos" color="#0f172a" bgcolor="#fff" titulo="Abrir POS" /></Actions>
        </LeftSection>
        <RightSection className="right-section"><MockupImage>
          <CardFuncion top="12px" left="-50px" title="Multi-empresa" icon={FiBriefcase} bgcontentimagen="#fccdb8" />
          <CardFuncion top="112px" left="-20px" title="Multi-sucursal" icon={FiMapPin} bgcontentimagen="#e3d4cc" />
          <CardFuncion top="212px" left="-50px" title="Multi-caja" icon={FiDatabase} bgcontentimagen="#aee0fd" />
          <CardFuncion top="312px" left="-20px" title="Multi-almacén" icon={FiArchive} bgcontentimagen="#fdc2b7" />
          <CardFuncion top="412px" left="-50px" title="Imprime directo" subtitle="Comprobantes y reportes listos" icon={FiPrinter} bgcontentimagen="#b8f1fa" />
        </MockupImage></RightSection>
      </SubContentSection>
    </ContentSection>
    <Footer className="footer-section"><div><span><FiShield /></span><section><b>Operación protegida</b><p>Roles, permisos y trazabilidad para que cada equipo trabaje con claridad.</p></section></div><div><span><FiDatabase /></span><section><b>Datos siempre conectados</b><p>POS, CRM y reportes comparten una sola fuente operativa.</p></section></div><small>ActiveSelfControl · Plataforma de gestión</small></Footer>
  </Container>;
};

const Container = styled.div`
  display:flex;flex-direction:column;align-items:center;min-height:100%;padding:clamp(16px,3vw,32px);gap:22px;
  background:linear-gradient(145deg,${({ theme }) => theme.bgtotal},${({ theme }) => theme.bg2});
`;
const ContentSection = styled.div`display:flex;justify-content:center;align-items:center;flex:1;width:100%;`;
const SubContentSection = styled.div`
  display:flex;flex-direction:column;align-items:center;width:min(1040px,100%);gap:44px;
  @media ${Device.desktop}{flex-direction:row;justify-content:space-between;gap:80px;}
`;
const LeftSection = styled.section`
  display:flex;flex-direction:column;gap:16px;width:100%;max-width:490px;.eyebrow{display:flex;align-items:center;gap:7px;text-transform:uppercase;letter-spacing:.08em;font-size:11px;font-weight:900;color:#0284c7}h1{margin:0;font-size:clamp(31px,4vw,48px);letter-spacing:-.04em;color:${({ theme }) => theme.text}}.intro{margin:-5px 0 6px;color:${({ theme }) => theme.colorSubtitle};line-height:1.55}.eyebrow svg{width:15px;height:15px}
`;
const Step = styled.div`
  display:flex;align-items:flex-start;gap:12px;
`;
const IconPlaceholder = styled.div`
  width:42px;height:42px;flex:none;display:grid;place-items:center;border-radius:13px;background:${({ theme }) => theme.bg3};border:1px solid ${({ theme }) => theme.bordercolorDash};box-shadow:0 7px 15px rgba(15,23,42,.12);color:#0ea5e9;svg{width:21px;height:21px}
`;
const Text = styled.div`display:flex;flex-direction:column;gap:3px;`;
const Title = styled.h3`font-size:17px;font-weight:850;margin:0;color:${({ theme }) => theme.text};`;
const Description = styled.p`font-size:14px;margin:0;color:${({ theme }) => theme.colorSubtitle};line-height:1.45;`;
const Actions = styled.div`display:flex;gap:10px;flex-wrap:wrap;margin-top:5px;`;
const RightSection = styled.section`width:100%;display:flex;justify-content:center;position:relative;`;
const MockupImage = styled.div`
  width:250px;height:500px;background:linear-gradient(180deg,${({ theme }) => theme.bg3},${({ theme }) => theme.bg});border-radius:24px;border:6px solid ${({ theme }) => theme.bg3};box-shadow:0 22px 46px rgba(15,23,42,.3);position:relative;&::before{content:"";height:330px;width:330px;background:rgba(14,165,233,.13);position:absolute;z-index:-1;bottom:76px;left:-49px;border-radius:50%;animation:palpitar 3s infinite}@keyframes palpitar{50%{transform:scale(1.08)}}
`;
const Footer = styled.footer`
  width:min(1200px,100%);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:18px 22px;border-radius:16px;background:${({ theme }) => theme.bg3};color:${({ theme }) => theme.text};box-shadow:0 15px 30px rgba(15,23,42,.2);border:1px solid ${({ theme }) => theme.bordercolorDash};>div{display:flex;align-items:flex-start;gap:10px}>div>span{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:${({ theme }) => theme.bg4};color:#7dd3fc;flex:none}svg{width:18px;height:18px}b{font-size:14px}p{margin:3px 0 0;font-size:12px;color:${({ theme }) => theme.colorSubtitle};line-height:1.45}small{grid-column:1/-1;padding-top:10px;border-top:1px solid ${({ theme }) => theme.bordercolorDash};font-size:11px;color:${({ theme }) => theme.colorSubtitle};text-align:center}@media(max-width:620px){grid-template-columns:1fr;}
`;
