import {SyncedLayer, syncedLayerFromMetadata} from "./SyncedLayer.js"

export class LayerClient {

  endpoint;
  jwt;
  layers;
  map;

  constructor(endpoint, jwt=undefined){
    this.endpoint = endpoint;
    this.jwt = jwt;
    this.layers = {};
  }

  addTo(map){
    this.map = map;
    this._load_layers();
  }

  _load_layers(){
    let headers = {
      "Content-Type": "application/json"
    };
    if(this.jwt){
      // headers["Authorization"] = 'Bearer ' + this.jwt;
    }

    return fetch(this.endpoint + '/layers', {
      method: 'GET',
      headers: headers,
      credentials: 'include',
    }).then((response) => response.json())
    .then((json) => {
      json.forEach((metadata) => {
        let layer = syncedLayerFromMetadata(this.endpoint, metadata);
        this.layers[metadata.id] = layer;
        let event = new CustomEvent("lc:new-layer", {detail: layer});
        document.dispatchEvent(event);
      });
    })
    .then(() => {
      let event = new CustomEvent("lc:loaded", {detail: this});
      document.dispatchEvent(event);
    })
    .catch((error) => {
      console.log(error);
      let event = new CustomEvent("lc:load-error", {detail: error});
      document.dispatchEvent(event);
    });
  }

  getLayers(){
    return Object.values(this.layers);
  }

  getLayer(layer_id){
    return this.layers[layer_id]
  }
}
