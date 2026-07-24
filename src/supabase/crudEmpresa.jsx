import { supabase } from "./supabase.config";
const tabla = "empresa";
export async function InsertarEmpresa(p) {
  const { data, error } = await supabase
    .from(tabla)
    .insert(p)
    .select()
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function MostrarEmpresaXidsuario(p) {
  if (!p?.id_empresa && !p?._id_usuario) return null;

  let query = supabase.from(tabla).select("*");
  query = p.id_empresa
    ? query.eq("id", p.id_empresa)
    : query.eq("id_usuario", p._id_usuario);

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`No se pudo cargar la empresa: ${error.message}`);
  }
  return data;
}
export async function EditarMonedaEmpresa(p){
  const {error}= await supabase.from(tabla).update(p).eq("id",p.id)
  if(error){
    throw new Error(error.message);
  }
}
export async function EditarLogoEmpresa(p){
  const {error}= await supabase.from(tabla).update(p).eq("id",p.id)
  if(error){
    throw new Error(error.message);
  }
}
export async function EditarEmpresa(p,fileold,filenew){
  const {error}= await supabase.from(tabla).update(p).eq("id",p.id)
  if(error){
    throw new Error(error.message);
  }
  if( filenew!=="-" && filenew.size !==undefined){
    if(fileold!="-"){
      await EditarIconoStorage(p.id,filenew)
    }else{
      const dataImagen = await subirImagen(p.id,filenew)
      const plogoeditar={
        logo:dataImagen.publicUrl,
        id:p.id
      }
      await EditarLogoEmpresa(plogoeditar)
    }
  }
}

export async function EditarIconoStorage(id,file){
  const ruta = "empresa/"+id
  const { error } = await supabase.storage.from("imagenes").update(ruta,file,{
    cacheControl:"0",
    upsert:true
  })
  if (error) throw new Error(`No se pudo actualizar el logo: ${error.message}`);
}
async function subirImagen (idempresa,file){
  const ruta = "empresa/"+idempresa
  const {data, error}= await supabase.storage.from("imagenes").upload(ruta,file,{
    cacheControl:"0",
    upsert:true
  })
  if(error){
    throw new Error(error.message);
  }
  if(data){
    const {data:urlimagen} = await supabase.storage.from("imagenes").getPublicUrl(ruta)
    return urlimagen
  }

}
