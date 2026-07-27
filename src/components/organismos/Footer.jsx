import styled from "styled-components";
import { FiHelpCircle, FiLock, FiShield } from "react-icons/fi";

export function Footer() {
  return <Container>
    <section className="security"><span className="icon"><FiShield /></span><div><b>Sitio protegido</b><p>Tu sesión y la información operativa se gestionan de forma segura.</p></div><a href="mailto:soporte@alphaby.cloud"><FiHelpCircle /> Soporte</a></section>
    <section className="rights"><span><FiLock /> ActiveSelfControl · ASC</span><span>© {new Date().getFullYear()} ActiveSelfControl</span><span>Todos los derechos reservados</span></section>
  </Container>;
}

const Container = styled.footer`
  width:min(760px,calc(100% - 24px));display:grid;gap:11px;margin:18px auto 12px;color:#64748b;font-size:12px;.security{display:flex;align-items:center;gap:10px;padding:11px 13px;border:1px solid rgba(148,163,184,.28);background:rgba(255,255,255,.58);border-radius:12px}.icon{display:grid;place-items:center;width:31px;height:31px;border-radius:9px;background:#e0f2fe;color:#0284c7;flex:none}.security b{display:block;color:#334155;font-size:12px}.security p{margin:2px 0 0;line-height:1.35}.security a{display:flex;align-items:center;gap:5px;margin-left:auto;color:#0369a1;font-weight:750;text-decoration:none;white-space:nowrap}.rights{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;color:#94a3b8;font-size:11px}.rights span{display:flex;align-items:center;gap:5px}.rights svg{width:13px;height:13px}@media(max-width:520px){.security{align-items:flex-start}.security a{margin-left:0;align-self:center}.security{flex-wrap:wrap}.rights{justify-content:flex-start}}
`;
