import {simplestyle} from '../simplestyle/simplestyle.js';
import {getPoiPopupHTML} from '../BootstrapOverpassLayer.js';

export let SyncedLayer = L.GeoJSON.extend({

  initialize: function(endpoint, options) {


    L.setOptions(this, {
      endpoint: endpoint,
      style: simplestyle,
      ...options,
    });

    this._layers = {};
    this.loaded = false;

    // this token is used to ignore updates via the subscription for changes made by this layer instance.
    this.sync_token = "" + Math.random();

  },

  load(){
    fetch(this.options.endpoint + "/" + this.options.id, {
      method: 'GET',
      headers: {
        "Content-Type": "application/json",
        // Authorization: 'Bearer ' + this.options.jwt,
      },
      credentials: 'include',
    }).then((response) => {
      if(response.ok) {
        return response.json()
      } else {
        return Promise.reject(response);
      }})
    .then((json) => {
      this.clearLayers();
      this.addData(json);
      this.fire("loaded");
      this.loaded = true;
    });
  },

  subscribe(){
    this.evtSource = new EventSource(this.options.endpoint + "/" + this.options.id + "/subscribe", {
      withCredentials: true,
    });
    this.evtSource.onmessage = (event) => {
      let feature = JSON.parse(event.data);
      if(feature.properties._sync_token && feature.properties._sync_token == this.sync_token){
        // ignore this update
        console.log("Ignored update");
      } else if(feature.properties.deleted){
        let layer = this.getLayer(feature.id); 
        if(layer){
          this.removeLayer(layer);
        }
      } else {
        this.addData(feature);
      }
    };
  },

  unsubscribe(){
    if(this.evtSource){
      this.evtSource.close();
    }
  },

  configure(new_metadata){
    // FIXME workaround for mixed metadata / feature collection endpoint
    return sendData(this.options.endpoint + "/layers/" + this.options.id, {...new_metadata, type: "FeatureCollection", features:[]}, this.options.jwt).then((data) => {
      this.options = {...this.options, ...new_metadata};
    });
  },
  
  delete(){
    return sendData(this.options.endpoint + "/layers/" + this.options.id, {}, this.options.jwt, "DELETE");
  },

  getLayerId(layer){
    return layer.feature.id;
  },

  addOnlineLayer: function(layer) {
      let feature = layer.toGeoJSON(5);
      layer.feature = feature;
      feature.properties._sync_token = this.sync_token;
      if(this.options.feature_time_to_live) {
        feature.properties.expiretime = feature.properties.expiretime || Math.floor(new Date().getTime()/1000 + this.options.feature_time_to_live)
      }
      try{ layer.setStyle({'color': "grey"}); }catch{}

      return sendData(this.options.endpoint + "/" + this.options.id + "/features", feature, this.options.jwt, 'POST').then((data) => {
        layer.feature['id'] = data;
        layer.feature['properties'] = feature.properties;

        this.addLayer(layer);
        try{ layer.setStyle(simplestyle(layer.feature)); }catch{console.error("Failed to style"); console.error(layer.feature)}

        if(this.options.onEachFeature){
          this.options.onEachFeature(layer.feature, layer);
        }
      });
  },

  updateOnlineLayer: function(layer) {
    try{ layer.setStyle({'color': "grey"}); }catch{}
    let feature = layer.toGeoJSON(5);
    feature.properties._sync_token = this.sync_token;
    debounce(sendData(this.options.endpoint + "/" + this.options.id + "/features/" + feature.id, feature, this.options.jwt).then((data) => {
      try{ layer.setStyle(simplestyle(layer.feature)); }catch{console.error("Failed to style"); console.error(layer.feature)}
    }), 500);
  },

  addLayer: function (layer) {
		if (this.hasLayer(layer)) {
			L.GeoJSON.prototype.removeLayer.call(this, this.getLayer(layer.feature.id));
		}
    layer.addEventParent(this);

		L.LayerGroup.prototype.addLayer.call(this, layer);

		// @event layeradd: LayerEvent
		// Fired when a layer is added to this `FeatureGroup`
		return this.fire('layeradd', {layer: layer});
	},

  removeOnlineLayer(layer) {
    // let feature = layer.toGeoJSON(5);
    sendData(this.options.endpoint + "/" + this.options.id + "/features/" + layer.feature.id, {}, this.options.jwt, 'DELETE').then((data) => {
      L.GeoJSON.prototype.removeLayer.call(this, layer);
    });
  },

  onAdd(map) {
    this.load();
    L.LayerGroup.prototype.onAdd.call(this, map);
    this.subscribe();
  },

  onRemove(map) {
    L.LayerGroup.prototype.onRemove.call(this, map);
    this.unsubscribe();
  }
});

function debounce(func, waitFor) {
    let timeout;
    return (...args) => new Promise(resolve => {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => resolve(func(...args)), waitFor);
    });
}

export async function sendData(url = "", data = {}, token="", method='PUT') {
  // Default options are marked with *
  const response = await fetch(url, {
    method: method, // *GET, POST, PUT, DELETE, etc.
    mode: "cors", // no-cors, *cors, same-origin
    headers: {
      "Content-Type": "application/json",
      // Authorization: 'Bearer ' + token,
    },
    credentials: "include",
    referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    body: JSON.stringify(data), // body data type must match "Content-Type" header
  });
  if (response.ok) {
    return response.json().catch((response) => response.text); // parses JSON response into native JavaScript objects
  } else {
    throw new Error(response);
  }
}


export function syncedLayerFromMetadata(endpoint, metadata){

      let slayer = new SyncedLayer(false, {
        endpoint: endpoint,
        id: metadata.id, title: metadata.title, description: metadata.description || "", feature_time_to_live: metadata.feature_time_to_live, 
        permissions: metadata.permissions,
        acl: metadata.acl,
        // jwt: parameters['jwt'],
        pointToLayer: (geoJsonPoint, latlng) => {
          if(geoJsonPoint.properties.radius){
            return L.circle(latlng, {radius: geoJsonPoint.properties.radius});
          } else if(geoJsonPoint.properties.textMarker) {
            let textmarker =  L.marker(latlng, {pmIgnore: false, textMarker: true, text: geoJsonPoint.properties.text || ""});
            return textmarker;
          } else {
            return L.marker(latlng);
          }
        },
        onEachFeature: (feature, l) => {
          if(!l.feature.properties.textMarker){
            let edit_callback = false;
            if(slayer.options.permissions.write){
              edit_callback = (new_properties) => {
                l.feature.properties = new_properties;
                return slayer.updateOnlineLayer(l);
              };
            };

            let popup_content =  () => getPoiPopupHTML(l.feature.properties, null, 'name', l.feature?.geometry, edit_callback, l.pm);
            l.bindPopup(popup_content, {minWidth: 230, closeButton: false});
        }
      }
      });
  return slayer;
}
