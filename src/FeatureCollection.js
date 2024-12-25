
export let FeatureCollection = L.GeoJSON.extend({

  initialize: function(endpoint, options) {


    L.setOptions(this, {
      endpoint: endpoint,
      fetch_options: {},
      pagination_limit: undefined, // set a pagination limit when requesting items, default undefined (uses server default limit)
      feature_limit: undefined, // set a maximum number of features to load per collection, default undefined (unlimited number of features)
      ...options,
    });

    this._layers = {};
    this.loaded = false;

    // this token is used to ignore updates via the subscription for changes made by this layer instance.
    this.sync_token = "" + Math.random();

  },

  _loadPage(url){
    return fetch(url, {
      method: 'GET',
      ...this.options.fetch_options,
    }).then((response) => {
      if(response.ok) {
        return response.json()
      } else {
        return Promise.reject(response);
      }})
  },

  load(url=null, first=true, offset=0){
    let pagination_limit = (this.options.pagination_limit ? "?limit=" + this.options.pagination_limit : "" );
    this._loadPage(url ? url : this.options.endpoint + "/collections/" + this.options.id + "/items" + pagination_limit)
      .then((json) => {
        if (this.options.feature_limit){
          json.features = json.features.slice(0, this.options.feature_limit);
        }
        this.addData(json);
        if(!this._map){
          console.debug("Aborted pagination as layer is no longer visible on the map");
        } else if(!this.options.feature_limit || offset + json.features.length < this.options.feature_limit){
          console.warn("Maximum number of features reached. There might be features not shown.")
        } else if (json.links){
          json.links.forEach((link) => {
            if(link.rel == "next"){
              this.load(link.href, false, offset + json.features.length)
            }
          })
        }

        if(first){
          this.fire("loaded");
          this.loaded = true;
        }
      });

  },

  subscribe(){
    this.evtSource = new EventSource(this.options.endpoint + "/collections/" + this.options.id + "/subscribe", {
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
    return sendData(this.options.endpoint + "/collections/" + this.options.id, {...new_metadata, type: "FeatureCollection", features:[]}, this.options.jwt).then((data) => {
      this.options = {...this.options, ...new_metadata};
    });
  },
  
  delete(){
    return sendData(this.options.endpoint + "/collections/" + this.options.id, {}, this.options.jwt, "DELETE").then(() => {
      let event = new CustomEvent("lc:deleted-layer", {detail: this});
      document.dispatchEvent(event);
    })
  },

  getLayerId(layer){
    return layer.feature.id;
  },

  createFeature: function(layer) {
      let feature = layer.toGeoJSON(5);
      layer.feature = feature;
      feature.properties._sync_token = this.sync_token;
      if(this.options.feature_time_to_live) {
        feature.properties.expiretime = feature.properties.expiretime || Math.floor(new Date().getTime()/1000 + this.options.feature_time_to_live)
      }
      try{ layer.setStyle({'color': "grey"}); }catch{}

      return sendData(this.options.endpoint + "/collections/" + this.options.id + "/items", feature, this.options.jwt, 'POST').then((data) => {
        layer.feature['id'] = data;
        layer.feature['properties'] = feature.properties;

        this.addLayer(layer);

        if(this.options.onEachFeature){
          this.options.onEachFeature(layer.feature, layer);
        }
      });
  },

  updateFeature: function(layer) {
    try{ layer.setStyle({'color': "grey"}); }catch{}
    let feature = layer.toGeoJSON(5);
    feature.properties._sync_token = this.sync_token;
    debounce(sendData(this.options.endpoint + "/collections/" + this.options.id + "/items/" + feature.id, feature, this.options.jwt).then((data) => {
        if(this.options.onEachFeature){
          this.options.onEachFeature(layer.feature, layer);
        }
    }), 500);
  },

  addLayer: function (layer) {
		if (this.hasLayer(layer)) {
			L.GeoJSON.prototype.removeLayer.call(this, this.getLayer(layer.feature.id));
		}
    layer.collection = this;
    layer.addEventParent(this);
		L.LayerGroup.prototype.addLayer.call(this, layer);

		// @event layeradd: LayerEvent
		// Fired when a layer is added to this `FeatureGroup`
		return this.fire('layeradd', {layer: layer});
	},

  deleteFeature(layer) {
    sendData(this.options.endpoint + "/collections/" + this.options.id + "/items/" + layer.feature.id, {}, this.options.jwt, 'DELETE').then((data) => {
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


export function syncedLayerFromMetadata(endpoint, metadata, options){

      options = {
        ...options,
        ...metadata
      }

      return new FeatureCollection(false, {
        endpoint: endpoint,
        id: metadata.id, title: metadata.title, description: metadata.description || "", feature_time_to_live: metadata.feature_time_to_live, 
        permissions: metadata.permissions,
        acl: metadata.acl,
        pointToLayer: (geoJsonPoint, latlng) => {
          if(geoJsonPoint.properties.radius){
            return L.circle(latlng, {...options, radius: geoJsonPoint.properties.radius});
          } else if(geoJsonPoint.properties.textMarker) {
            let textmarker =  L.marker(latlng, {...options, pmIgnore: false, textMarker: true, text: geoJsonPoint.properties.text || ""});
            return textmarker;
          } else {
            let marker = L.marker(latlng, options);
            return marker;
          }
        },
      ...options,
      });
}
