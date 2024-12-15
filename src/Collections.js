import {FeatureCollection, syncedLayerFromMetadata} from "./FeatureCollection.js"

export class Collections {

  endpoint;
  layers;
  map;

  constructor(endpoint, options={}, jwt=undefined){
    this.endpoint = endpoint;

    this.options = {
      fetch_options: {},
      ...options
    }
    this.layers = {};
  }

  addTo(map){
    this.map = map;
    this._load_layers();
  }

  _load_layers(){

    return fetch(this.endpoint + '/collections', {
      ...this.options.fetch_options,
      method: 'GET',
    }).then((response) => response.json())
    .then((json) => {
      json.collections.forEach((metadata) => {
        let layer = syncedLayerFromMetadata(this.endpoint, metadata, this.options);
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

  newLayer(layer_details){
    let headers = {
      "Content-Type": "application/json"
    };
    if(this.options.fetch_options.headers){
      headers = {
        ...this.options.fetch_options.headers,
        headers
      }
    }


    return fetch(this.endpoint + '/collections', {
        ...this.options.fetch_options,
        method: 'POST',
        headers: headers,
        body: JSON.stringify(layer_details),
      }).then((response) => response.json())
    .then((metadata) => {
      let layer = syncedLayerFromMetadata(this.endpoint, metadata, this.options)
      this.layers[metadata.id] = layer;
      let event = new CustomEvent("lc:new-layer", {detail: layer});
      document.dispatchEvent(event);
      return layer;
    });
  }
}
