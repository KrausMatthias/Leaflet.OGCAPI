# Leaflet OGC API -- Features

Pragmatic implementation of OGC API -- Features Parts [1](https://docs.ogc.org/is/17-069r4/17-069r4.html) and [4](https://docs.ogc.org/DRAFTS/20-002r1.html)

## Demo

See [demo.html](https://krausmatthias.github.io/Leaflet.OGCAPI/demo.html) for a minimal demo.

## Features

 * Set fetch options to include headers or credentials for authentication
 * Subscribe to Feature Updates via SSE (not yet compliant to OGC API Spec, planned: [EDR - PubSub](https://docs.ogc.org/DRAFTS/23-057.html))

* [FeatureCollections](https://docs.ogc.org/is/17-069r4/17-069r4.html#_collections_)
     * Get all Collections from OGC API Server
     * Setup a Layer for each FeatureCollection
     * Create/Update/Delete Collections on the Server
 * [OGC API - Features - Part 4: Create, Replace, Update and Delete](https://docs.ogc.org/DRAFTS/20-002r1.html)

## TODO
 * Use [link-relations](https://docs.ogc.org/is/17-069r4/17-069r4.html#_link_relations) for resolving resources

 ## Alternative implementations

 * https://gitlab.com/IvanSanchez/leaflet.featuregroup.ogcapi/-/tree/main?ref_type=heads
 * https://github.com/opengeospatial/ogcapi-features/tree/master/implementations/clients
