import { useEffect } from "react";
import {HomeTemplate, useAuthStore, UserAuth, useUsuariosStore} from "../index"
import { useQueryClient } from "@tanstack/react-query";
export function Home() {
   const {datausuarios} = useUsuariosStore()
   const queryClient = useQueryClient()
useEffect(()=>{
  if(!datausuarios?.id){
    queryClient.invalidateQueries(["mostrar usuarios"])
    //  window.location.reload();
  }
 
},[datausuarios])
  return (<HomeTemplate/>);
}
