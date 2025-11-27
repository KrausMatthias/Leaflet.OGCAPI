import {get_link, fetch_with} from "./utils.js"

export let FeatureCollection = L.GeoJSON.extend({

  initialize: function(metadata, options) {

    let self_url = get_link(metadata.links, "self", "application/json", metadata.endpoint + "/collections/" + metadata.id);
    let items_url = get_link(metadata.links, "items", "application/geo+json", metadata.endpoint + "/collections/" + metadata.id + "/items");
    let pubsub_url = get_link(metadata.links, "hub");

    L.setOptions(this, {
      fetch_options: {},
      pagination_limit: undefined, // set a pagination limit when requesting items, default undefined (uses server default limit)
      feature_limit: undefined, // set a maximum number of features to load per collection, default undefined (unlimited number of features)
      ...options,
      self_url: self_url,
      items_url: items_url,
      pubsub_url: pubsub_url,
      metadata: metadata,
    });

    this._layers = {};
    this.loaded = false;

    // this token is used to ignore updates via the subscription for changes made by this layer instance.
    this.sync_token = "" + Math.random();

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.unsubscribe();
      } else {
        // Update if layer is currently added to the map 
        if (this._map) {
          this.load();
          this.subscribe();
        }
      }
    });

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
    
    if(!url){
      url = new URL(this.options.items_url);
      if(this.options.pagination_limit){
        url.searchParams.set("limit", this.options.pagination_limit);
      }
    }

    this._loadPage(url)
      .then((json) => {

        if (this.options.feature_limit){
          json.features = json.features.slice(0, this.options.feature_limit - offset);
        }

        this.addData(json);

        if(!this._map || document.hidden){
          console.debug("Aborted pagination as layer is no longer visible on the map");
        } else if((this.options.feature_limit && offset + json.features.length >= this.options.feature_limit)){
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
    // this currently only supports SSE
    if(this.options.pubsub_url && this.options.pubsub_url.startsWith("http")){
      this.evtSource = new EventSource(this.options.pubsub_url, {
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
    }
  },

  unsubscribe(){
    if(this.evtSource){
      this.evtSource.close();
    }
  },

  configure(new_metadata){
    return fetch_with(
      this.options.self_url, {
        method: 'PUT',
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(new_metadata), // body data type must match "Content-Type" header
      },
      this.options.fetch_options
    ).then(() => {
      this.options.metadata = {...this.options.metadata, ...new_metadata};
    });
  },
  
  delete(){
    return fetch_with(this.options.self_url, {method: 'DELETE'},this.options.fetch_options).then(() => {
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

      return fetch_with(
        this.options.items_url.split(/[?#]/)[0], {
          method: 'POST',
          headers: {
            "Content-Type": "application/geo+json",
          },
          body: JSON.stringify(feature), // body data type must match "Content-Type" header
        },
        this.options.fetch_options
      ).then((resp) => resp.text()).then((data) => {
        layer.feature['id'] = data;
        layer.feature['properties'] = feature.properties;

        this.addLayer(layer);

        if(this.options.onEachFeature){
          this.options.onEachFeature(layer.feature, layer, this);
        }
      });
  },

  updateFeature: function(layer) {
    let feature = layer.toGeoJSON(5);
    feature.properties._sync_token = this.sync_token;
    return debounce(() => fetch_with(
      this.options.items_url.split(/[?#]/)[0] + "/" + feature.id, 
      {
        method: 'PUT',
        headers: {
          "Content-Type": "application/geo+json",
        },
        body: JSON.stringify(feature)
      }, 
      this.options.fetch_options
    ).then((data) => {
        if(this.options.onEachFeature){
          this.options.onEachFeature(layer.feature, layer, this);
        }
    }), 500)();
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
    return fetch_with(
      this.options.items_url.split(/[?#]/)[0] + "/" + layer.feature.id, 
      {method: 'DELETE'},
      this.options.fetch_options
    ).then(() => {
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

