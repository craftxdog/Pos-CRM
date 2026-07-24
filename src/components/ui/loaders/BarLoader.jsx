import styled from "styled-components";

export function BarLoader({ color = "#6d6d6d" }) {
  return (
    <Track role="status" aria-label="Cargando" $color={color}>
      <span />
    </Track>
  );
}

const Track = styled.div`
  position: relative;
  width: min(220px, 100%);
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, ${({ $color }) => $color} 20%, transparent);

  span {
    position: absolute;
    inset: 0 auto 0 0;
    width: 42%;
    border-radius: inherit;
    background: ${({ $color }) => $color};
    animation: asc-bar-loader 0.9s ease-in-out infinite;
  }

  @keyframes asc-bar-loader {
    from { transform: translateX(-110%); }
    to { transform: translateX(340%); }
  }
`;
