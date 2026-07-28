import { createGlobalStyle } from "styled-components";
export const GlobalStyles = createGlobalStyle`
    *,
    *::before,
    *::after {
        box-sizing: border-box;
    }

    html {
        min-width: 320px;
        min-height: 100%;
        overflow-x: hidden;
        text-size-adjust: 100%;
    }

    body{
        margin:0;
        padding:0;
        min-width:320px;
        min-height:100%;
        overflow-x:hidden;
        background-color:${({ theme }) => theme.bgtotal};
        font-family:"Poppins",sans-serif;
        color:#fff;
    }

    #root {
        width:100%;
        min-height:100vh;
        min-height:100dvh;
        overflow-x:clip;
    }

    img,
    picture,
    video,
    canvas,
    svg {
        max-width:100%;
    }

    img,
    picture,
    video,
    canvas {
        height:auto;
    }

    button,
    input,
    select,
    textarea {
        max-width:100%;
        font:inherit;
    }

    button,
    [role="button"],
    a {
        -webkit-tap-highlight-color:transparent;
    }

    input,
    select,
    textarea {
        min-width:0;
    }

    @media (max-width: 767px) {
        input,
        select,
        textarea {
            font-size:16px;
        }
    }
    
    body::-webkit-scrollbar {
  width: 12px;
  background: rgba(24, 24, 24, 0.2);
}

body::-webkit-scrollbar-thumb {
  background: rgba(148, 148, 148, 0.9);
  border-radius: 10px;
  filter: blur(10px);
}

    
    

`;
