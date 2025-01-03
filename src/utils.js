
export function get_link(links, rel, type=null, def=null){
  let link = links.find((link) => link.rel == rel && (!type || link.type == type))?.href;
  if(link){
    return link;
  }else if(def){
    console.warn("Using fallback: "+def);
    return def;
  }
}

