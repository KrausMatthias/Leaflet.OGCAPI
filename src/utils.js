
export function get_link(links, rel, type=null, def=null){
  let link = links.find((link) => link.rel == rel && (!type || link.type == type))?.href;
  if(link){
    return link;
  }else if(def){
    console.warn("Using fallback: "+def);
    return def;
  }
}

export function fetch_with(url, options={}, fetch_options={}) {
  options = {
    ...fetch_options,
    ...options
  };

    if(fetch_options.headers){
      options.headers = {
        ...fetch_options.headers,
        ...options.headers
      }
    }

    return fetch(url, options).then((response) => {
      if (response.ok) {
        return response
      } else {
        return Promise.reject(response)
      }
  })
}
