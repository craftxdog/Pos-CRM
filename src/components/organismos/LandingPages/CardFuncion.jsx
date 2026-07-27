import styled from "styled-components";

export const CardFuncion = ({ top, bottom, left, right, title, icon: Icon, bgcontentimagen, subtitle }) => (
  <Card $bottom={bottom} $top={top} $left={left} $right={right}>
    <CardIcon $bgcontentimagen={bgcontentimagen}>{Icon ? <Icon aria-hidden="true" /> : null}</CardIcon>
    <CardText><CardTitle>{title}</CardTitle>{subtitle ? <CardDescription>{subtitle}</CardDescription> : null}</CardText>
    <Badge $bgcontentimagen={bgcontentimagen} />
  </Card>
);

const Card = styled.div`
  width:220px;min-height:50px;display:flex;align-items:center;background:#fff;border:1px solid #dbe4ee;border-radius:12px;padding:14px;gap:14px;position:absolute;top:${({$top})=>$top};bottom:${({$bottom})=>$bottom};left:${({$left})=>$left};right:${({$right})=>$right};box-shadow:0 10px 24px rgba(15,23,42,.11);transition:transform .25s ease,box-shadow .25s ease;
  &:hover{transform:translateX(8px) translateY(-2px);box-shadow:0 14px 28px rgba(15,23,42,.16)}
`;
const CardIcon = styled.div`
  width:50px;height:50px;flex:none;border-radius:50%;background:${({$bgcontentimagen})=>$bgcontentimagen};display:grid;place-items:center;color:#0f172a;
  svg{width:25px;height:25px}
`;
const CardText = styled.div`display:flex;flex-direction:column;min-width:0;`;
const CardTitle = styled.span`font-size:16px;font-weight:800;color:#0f172a;`;
const CardDescription = styled.p`font-size:12px;margin:3px 0 0;color:#64748b;`;
const Badge = styled.span`position:absolute;top:12px;right:12px;width:18px;height:5px;background:${({$bgcontentimagen})=>$bgcontentimagen};border-radius:99px;`;
