import {FeatureCollection} from "./FeatureCollection.js"
import {get_link, fetch_with} from "./utils.js"

export class Collections extends L.FeatureGroup {

  endpoint;
  layers;
  map;

  constructor(endpoint, options={}){
    super(options);
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
        metadata["endpoint"] = this.endpoint;

        let items_url = get_link(metadata.links, "items", "application/geo+json");
        if(items_url){
          let layer = new FeatureCollection(metadata, this.options);

          // TODO move this to addLayer??
          this.layers[metadata.id] = layer;
          
          this.fire("layeradd", {layer: layer});
        }else{
          console.info("Skipped collection without geojson items: " + metadata.title)
        }

      });
    })
    .then(() => {
      this.fire("load", this);
    })
    .catch((error) => {
      console.log(error);
      let event = new CustomEvent("lc:load-error", {detail: error});
      this.dispatchEvent(event);
    });
  }

  getLayers(){
    return Object.values(this.layers);
  }

  getLayer(layer_id){
    return this.layers[layer_id]
  }

  createCollection(layer_details){

    return fetch_with(
      this.endpoint + '/collections', 
      {
        method: 'POST',
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(layer_details),
      },
      this.options.fetch_options
    ).then((response) => response.json())
    .then((metadata) => {
      metadata["endpoint"] = this.endpoint;
      let layer = new FeatureCollection(metadata, this.options);

      this.layers[metadata.id] = layer;
      this.fire("layeradd", {layer: layer});
      return layer;
    });
  }
}
