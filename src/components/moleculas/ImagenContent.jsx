import styled from "styled-components";
import { LazyLoadImage } from "react-lazy-load-image-component";
import 'react-lazy-load-image-component/src/effects/blur.css';
import {v} from "../../styles/variables"
import { getSafeImageUrl } from "../../utils/catalogImages";
export function ImagenContent({imagen}) {
  const safeImage = getSafeImageUrl(imagen);
  return (
    <Container>
      {safeImage ? (
        <LazyLoadImage
          effect="blur"
          src={safeImage}
          alt=""
          width={50}
          height={50}
        />
      ) : (
        <v.iconoimagenvacia aria-label="Sin imagen" />
      )}
    </Container>
  );
}
const Container = styled.div`
width:50px;
height:50px;
border-radius:10%;
overflow:hidden;
img {
  object-fit:cover;
}
`;
