import styled from "styled-components";

export function Lottieanimacion({ alto = 200, ancho = 200 }) {
  const height = Number(alto) || 200;
  const width = Number(ancho) || 200;

  return (
    <Container
      aria-hidden="true"
      style={{
        height: `${height}px`,
        width: `${width}px`,
        maxWidth: "100%",
      }}
    >
      <div className="pulse" />
      <div className="mark">ASC</div>
      <div className="line line-a" />
      <div className="line line-b" />
      <div className="line line-c" />
    </Container>
  );
}

const Container = styled.div`
  position: relative;
  display: grid;
  place-items: center;
  margin: 0 auto;
  color: ${({ theme }) => theme.text};

  .pulse {
    width: 58%;
    aspect-ratio: 1;
    border-radius: 999px;
    background:
      radial-gradient(circle at 35% 35%, rgba(24, 166, 242, 0.28), transparent 38%),
      radial-gradient(circle at 70% 70%, rgba(255, 194, 15, 0.28), transparent 34%),
      ${({ theme }) => theme.bg3};
    border: 1px solid ${({ theme }) => theme.color2};
    box-shadow: 0 18px 42px rgba(0, 0, 0, 0.18);
    animation: asc-pulse 2.2s ease-in-out infinite;
  }

  .mark {
    position: absolute;
    font-size: clamp(1rem, 16%, 1.85rem);
    font-weight: 900;
    color: ${({ theme }) => theme.text};
  }

  .line {
    position: absolute;
    left: 18%;
    right: 18%;
    height: 7px;
    border-radius: 999px;
    background: ${({ theme }) => theme.color2};
    opacity: 0.45;
  }

  .line-a {
    bottom: 18%;
    width: 58%;
  }

  .line-b {
    bottom: 12%;
    width: 42%;
  }

  .line-c {
    bottom: 6%;
    width: 28%;
  }

  @keyframes asc-pulse {
    0%,
    100% {
      transform: scale(0.96);
      opacity: 0.82;
    }

    50% {
      transform: scale(1);
      opacity: 1;
    }
  }
`;
