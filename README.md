# Leaflet OGC API -- Features

Pragmatic implementation of OGC API -- Features Parts [1](https://docs.ogc.org/is/17-069r4/17-069r4.html) and [4](https://docs.ogc.org/DRAFTS/20-002r1.html)

Visualize and modify Layers from OGC API -- Features Servers in [Leaflet](https://leafletjs.com/).

This is still work in progress and takes some assumptions which are not fully standard compliant.

## Demo

See [demo.html](https://krausmatthias.github.io/Leaflet.OGCAPI/demo.html) for a minimal demo.

## Collections

Represents FeatureCollections offered by an OGC API as described in [OGC API -- Features 7.13 Collections](https://docs.ogc.org/is/17-069r4/17-069r4.html#_collections_)
as a list of [FeatureCollection](#FeatureCollection) Leaflet Layers.
This currently filters for collections with at least a link-relation ["items"](http://www.opengis.net/def/rel/ogc/1.0/items).

### Methods

|Method|Parameters|Response|
|---|---|---|
|constructor| <ul><li>URL to OGC API Basepath</li><li>[Collections Options](#options)</li></ul>| Collections instance |
|getLayers|None|List of all [FeatureCollection](#featurecollection) layers.|
|getLayer|collection_id|[FeatureCollection](#featurecollection) for the given collection id|
|createCollection|[Collection Metadata](http://schemas.opengis.net/ogcapi/features/part1/1.0/openapi/schemas/collection.yaml)|Promise returning a [FeatureCollection](#featurecollection) on success.|

### Options

| Option | Description |
| --- | --- |
| fetch_options | Options applied to all fetch operations. Use this if you need to set e.g. Headers. |
| pagination_limit | Maximum number of features to fetch in one batch. Default: Use Server default. |
| feature_limit | Maximum total number of features to load. Default: unlimited. |

Options from [Leaflet.GeoJSON](https://leafletjs.com/reference.html#geojson-option). These are applied to each [FeatureCollection](#featurecollection).

## FeatureCollection

Extends [Leaflet.GeoJSON](https://leafletjs.com/reference.html#geojson). Uses Feature IDs from the server to allow for seamless updates.

### Methods

|Method|Parameters|Response|
|---|---|---|
| constructor | <ul><li>[Collection Metadata](http://schemas.opengis.net/ogcapi/features/part1/1.0/openapi/schemas/collection.yaml)</li><li>[FeatureCollection Options](#options)</li></ul>| FeatureCollection instance |
| configure | [Collection Metadata](http://schemas.opengis.net/ogcapi/features/part1/1.0/openapi/schemas/collection.yaml) | Promise. Updates the metadata of this FeatureCollection on success | 
| subscribe | None. Requires link with relation ["hub"](https://docs.ogc.org/DRAFTS/23-057.html#link-relations) pointing to a SSE endpoint in metadata of this FeatureCollection. | None. Updates features in this FeatureCollection based on SSE events |
| unsubscribe || None. Drops SSE stream |
| delete || Promise. Deletes this collection from the server |
| createFeature | Leaflet Layer implementing toGeojson | Promise. Creates this Layer as new Item in the FeatureCollection on the server. Adds the given layer to this FeatureCollection |
| updateFeature | Leaflet Layer from this FeatureCollection | Promise. Updates this Layer on the server |
| deleteFeature | Leaflet Layer from this FeatureCollection | Promise. Deletes this Layer on the server and removes it from this FeatureCollection  |

More methods inherited from [Leaflet.GeoJSON](https://leafletjs.com/reference.html#geojson-option).

## Options

| Option | Description |
| --- | --- |
| fetch_options | Options applied to all fetch operations. Use this if you need to set e.g. Headers. |
| pagination_limit | Maximum number of features to fetch in one batch. Default: Use Server default. |
| feature_limit | Maximum total number of features to load. Default: unlimited. |

Options from [Leaflet.GeoJSON](https://leafletjs.com/reference.html#geojson-option).

## Tested OGC API Implementations

* [pygeoapi](https://pygeoapi.io/)
* [GeoServer](https://geoserver.org/)
* [MapServer](https://www.mapserver.org/)

 ## Alternative implementations

 * https://gitlab.com/IvanSanchez/leaflet.featuregroup.ogcapi/-/tree/main?ref_type=heads
 * https://github.com/opengeospatial/ogcapi-features/tree/master/implementations/clients
