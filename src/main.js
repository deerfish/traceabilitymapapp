import "../node_modules/ol/ol.css";
import '../../cms/packages/extensions/mytrace/Resources/Public/Css/map.css'
import App from './App.svelte'

const app = new App({
  target: document.getElementById('viz-map-app'),
})

export default app