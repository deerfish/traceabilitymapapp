<script>
  import { Map, View, Overlay } from "ol";
  import { fromLonLat, toLonLat, transform } from "ol/proj.js";
  import TileLayer from "ol/layer/Tile";
  import OSM from "ol/source/OSM";
  import VectorLayer from 'ol/layer/Vector.js';
  import VectorSource from 'ol/source/Vector.js';
  import GeoJSON from 'ol/format/GeoJSON.js';
  import Style from "ol/style/Style";
  import Fill from "ol/style/Fill";
  import Stroke from "ol/style/Stroke";
  import Text from "ol/style/Text";
  import {createEmpty, extend, getHeight, getWidth} from 'ol/extent.js';
  // import { Polygon } from "ol/geom";
  import Icon from "ol/style/Icon";
  import Layer from "ol/layer/Layer";

  let map = null;
  let mapDiv = "viz-map";
  let resourceButtons; // will be set on map init.

  // Init the maps view.
  const mapView = new View({
    center: [0, 0],
    zoom: 4,
  });


  // The cotton icon
  // The path here is as it will be on the website. 
  // Relative, because it will work in the vite testing 
  // environment with the same folder structure as with TYPO3.
  const cottonIcon = new Icon({
    anchor: [0.5, 1],
    anchorXUnits: 'fraction',
    anchorYUnits: 'fraction',
    width: 40,
    src: '/fileadmin/user_upload/Traceability/pikto_cotton_for_map.svg'
  });


  // Set the styles for the mapping features.
  let styleForVectorLayer = {
    // Style for the polygon that wraps all the overlay map elements.
    // For testing purpose, set stroke and fill to a color.
    'mapChainElementsPolygon': new Style({
        stroke: new Stroke({
          color: 'transparent',
          lineDash: [4],
          width: 2,
        }),
        fill: new Fill({
          color: 'rgba(0, 0, 255, 0)',
        }),
      })
   };


   /**
    * Creates the style for the cotton feature.
    * 
    * @param feature
    */
   function cottonIconWithTextStyle(feature) {
    return new Style({
      image: cottonIcon,
      text: createText(feature)
    });
   }


   /**
    * Wraps text with linebreaks.
    *  
    * https://stackoverflow.com/questions/14484787/wrap-text-in-javascript
    *
    * @param str
    * @param width
    * @param spaceReplacer
    */
  function stringDivider(str, width, spaceReplacer) {
    if (str.length > width) {
      let p = width;
      while (p > 0 && str[p] != ' ' && str[p] != '-') {
        p--;
      }
      if (p > 0) {
        let left;
        if (str.substring(p, p + 1) == '-') {
          left = str.substring(0, p + 1);
        } else {
          left = str.substring(0, p);
        }
        const right = str.substring(p + 1);
        return left + spaceReplacer + stringDivider(right, width, spaceReplacer);
      }
    }
    return str;
  }


  /**
   * Creates the text label for a features on the map.
   * The text itself is derived by the "desc" property of the feature.
   * 
   * @param feature
   */
  function createText(feature) {
    // Get the labels text from the feature an wrap 
    // it with line breaks every such length.
    let labelText = stringDivider(feature.getProperties().desc, 16, '\n');

    return new Text({
      textAlign: 'center',
      textBaseline: 'bottom',
      font: '1rem sans-serif',
      text: labelText,
      fill: new Fill({color: '#686058'}),
      stroke: new Stroke({color: '#ffffff', width: 3}),
      offsetX: 0,
      offsetY: -40,
      // placement: placement,
      // maxAngle: maxAngle,
      // overflow: overflow,
      // rotation: rotation,
    });
  };


  /**
   * Create the chain overlay with the boxes.
   * 
   * @param chainEl: HTMLElement
   */
  const showChainOverlay = (chainEl) => {

    if (chainEl.attributes.length > 0 && chainEl.dataset.lonlat) {
      const lonLatData = chainEl.dataset.lonlat.split(",");

      if (lonLatData.length > 0 && lonLatData[0]) {
        const pos = fromLonLat(lonLatData);

        const overlayEl = new Overlay({
          position: pos,
          positioning: "bottom-center",
          element: chainEl,
        });

        map.addOverlay(overlayEl);
      }
    }
  };


  /**
   * Creates overlays for all the chain elements shown on the map.
   * Also, creates a vector layer with al polygon, made by the
   * positions of the chain elements on the map.
   * From this polygon, we get the extent and zoom in to this area.
   * This way, the user always sees all the elements on the map
   * within its view area.
   */
  function createChainOverlays() {
    // Possibly, multiple resource chains are rendered.
    // For each chain we need to place the map items
    // on the map and crate a vector layer with a 
    // polygon that marks the area used by the overlay
    // items.
    // To find out how many chains are rendered, we
    // look at the number of buttons in the resource button list.
    // Every button has a data attribute named resourcechain.
    // The value of this attribute binds all the map elements
    // of a chain together in a class of the attributes value.

    // const resourceButtons = document.querySelectorAll('#viz-chain-main-resources-button-list .viz-chain-resource-button');
    let resourceChains = [];
    
    for (let idx = 0; idx < resourceButtons.length; idx++) {
      let chainName = resourceButtons[idx].dataset.mapchainelements;
      let chainInfo = {
        'chainName': chainName,
        'active': resourceButtons[idx].classList.contains('active') ? true : false,
        'polygonLayerName': 'polygonLayer' + chainName,
        'polygonCoordinates': []
      };
      resourceChains.push(chainInfo);
    }

    // console.log(resourceChains);

    // For every chain, add the map items as overlay on the map
    // and create a vector layer with a polygon.
    for(let idx = 0; idx < resourceChains.length; idx++) {
      let currentResourceChain = resourceChains[idx];

      // Get all the elements that should be shown as overlays.
      const chainElements = document.querySelectorAll(
        '.viz-map-chain-item-container' + '.' + currentResourceChain.chainName
      );

      // console.log(chainElements);

      if(chainElements.length > 0) {

        // Collection of all positions on the map.
        let polygonCoordinates = [];

        for (let idx = 0; idx < chainElements.length; idx++) {
          const elId = chainElements[idx].id;
          const chainEl = document.getElementById(elId);

          // We have to transform the lon/lat values to the destination projection.
          polygonCoordinates.push(transform(chainEl.dataset.lonlat.split(","), 'EPSG:4326', 'EPSG:3857'));
          
          // Place the chain element on the map as an overlay.
          showChainOverlay(chainEl);
        }

        // Add the first point of the polygon again in order to close it.
        polygonCoordinates.push(polygonCoordinates[0]);
        
        currentResourceChain.polygonCoordinates = polygonCoordinates;

        // Create the feature collection for the vector layer.
        let featureData = {
          'type': 'FeatureCollection',
          'features': [
            {
              'type': 'Feature',
              'geometry': {
                'type': 'Polygon',
                'coordinates': [
                  currentResourceChain.polygonCoordinates,
                ],
              }
            }
          ]
        };

        // Create a polygon geometry feature out of all the chain elements positions.
        
        // Create the vector source object with the feature collection.
        const vectorSource = new VectorSource({
          features: new GeoJSON().readFeatures(featureData),
        });

          // ... and the vector layer for the polygon.
        const mapOverlyItemsVectorLayerPolygon = new VectorLayer({
          properties: {
            name: currentResourceChain.chainName
          }, 
          source: vectorSource,
          style: function (feature) {
                  // console.log(feature);
                  return styleForVectorLayer['mapChainElementsPolygon'];
                },
        });
        map.addLayer(mapOverlyItemsVectorLayerPolygon);

        // If the current chain is active, zoom to it.
        if(currentResourceChain.active) {
          const vectorLayerExtent = mapOverlyItemsVectorLayerPolygon.getSource().getExtent();
          const featureExtent = createEmpty();
          extend(featureExtent, vectorLayerExtent);
          map.getView().fit(featureExtent, {duration: 800, padding: [150, 250, 150, 100]});      
        }
        
      }
    }
  }


  /**
   * Looks for the layer with the layer name passed by layerName
   * and zooms the map to its extent.
   * 
   * @param layerName
   */
  function zoomToLayer(layerName) {
    // Zoom to the extent of the vector layer that belongs to the active resource chain.
    let layerToZoomTo = map.getLayers().getArray().find(layer => layer.get('name') == layerName); // viz-map-chain-yarn-159
    const vectorLayerExtent = layerToZoomTo.getSource().getExtent();
    const featureExtent = createEmpty();
    extend(featureExtent, vectorLayerExtent);
    map.getView().fit(featureExtent, {duration: 800, padding: [150, 250, 150, 100]});
  }



  /**
   * When a resource button is clicked, zoom to the area where the overlay items for this specific resource chain are set on the map.
   * In order to make this work create a vector layer with a polygon for every chain 
   * Map the resource button for the chain with the corresponding vector layer (with the polygon for this chain.)
   */
  function addClickEventToResourceButtons() {
    for (let idx = 0; idx < resourceButtons.length; idx++) {
      let buttonEl = resourceButtons[idx];
      buttonEl.addEventListener("click", function (e) {
        const currentEl = e.currentTarget;
        const chainName = currentEl.dataset.mapchainelements;
        zoomToLayer(chainName);
        // Always remove the layers with loaded data from the map elements.
        removeLayersByName('featuresLoadedByMapElement');
      });
    }
  }


  function removeLayersByName(layerName) {
    let layers = map.getLayers();

    layers.forEach(layer => {
        if (layer != undefined) {
            if (layer.get('name') != undefined) {
                if (layer.get('name') == layerName) {
                    if (layer.getSource()) {
                        layer.getSource().clear();
                    }
                }
            }
        }
    });

    // ... then remove the layers.
    layers.forEach(layer => {
        if (layer != undefined) {
            if (layer.get('name') != undefined) {
                if (layer.get('name') == layerName) {
                    map.removeLayer(layer)
                }
            }
        }
    });
    
  }



   /**
   * Looks for chain map boxes that have a special class set.
   * This boxes get a click event to load JSON data and add the received
   * data to the map on a individual vector layer.
   * TODO: Ones loaded, the layer will only be toggled on click.
   */
  function createDataLoadingForChainElements() {

    const chainResourceItemsForMapPlaces = document.getElementsByClassName(
      "viz-chain-element viz-load-map-places",
    );
    const mapChainResourceItemsForMapPlaces = document.getElementsByClassName(
      "viz-map-chain-item-container viz-load-map-places",
    );

    // Add the data loading click event on the chain items.
    for (let i = 0; i < chainResourceItemsForMapPlaces.length; i++) {
      addDataLoaderEvents(chainResourceItemsForMapPlaces[i]);
    }

    for (let i = 0; i < mapChainResourceItemsForMapPlaces.length; i++) {
      addDataLoaderEvents(mapChainResourceItemsForMapPlaces[i]);
    }
  }


  /**
   * Add a click event to an element that looks for 
   * data url that is used to load additional data
   * to show on a vector layer.
   * 
   * @param chainItem
   */
  function addDataLoaderEvents(chainItem) {

    chainItem.addEventListener("click", function (e) {
      e.preventDefault();
      const currentEl = e.currentTarget;
      // The URL to load additional "feature data" is saved on the elements data-load property.
      let dataUrl = currentEl.dataset.loadplaces;

      removeLayersByName('featuresLoadedByMapElement');
      
      if (dataUrl) {
        // First of all, delete already created layers made by map elements.
        let layerSource = new VectorSource({
          url: dataUrl,
          format: new GeoJSON(),
        });
        layerSource.on('featuresloadend', function(e) {
          // Zoom the map to the extent of the features loaded.
          let vectorLayerExtent = mapPlacesVectorLayer.getSource().getExtent();
          const featureExtent = createEmpty();
          extend(featureExtent, vectorLayerExtent);
          map.getView().fit(featureExtent, {duration: 800, padding: [100, 100, 100, 100]});
        });
        // The data loading is managed by the VectorSource object!
        const mapPlacesVectorLayer = new VectorLayer({
          source: layerSource,
          properties: {
            name: 'featuresLoadedByMapElement'
          },
          style: function (feature) {
              // return styleForVectorLayer['cottonIcon'];
              return cottonIconWithTextStyle(feature);
            },
        });
        map.addLayer(mapPlacesVectorLayer);
      }
    });
  }


  /**
   * Initialize an OpenStreetMap map and create an overlay for the chain icons.
   *
   * @param _id
   */
  const initMap = (_id) => {

    map = new Map({
      target: 'viz-map',
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
      ],
      view: mapView,
    });

    // Create a layer for the traceability elements.
    resourceButtons = document.querySelectorAll('#viz-chain-main-resources-button-list .viz-chain-resource-button');
    createChainOverlays();
    createDataLoadingForChainElements();
    addClickEventToResourceButtons();

  };

</script>

<div id={mapDiv} class="viz-map" use:initMap={mapDiv} />
