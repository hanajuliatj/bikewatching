// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoiaGFuYWp1bGlhdGoiLCJhIjoiY203YmJoN2w1MDh0NTJrb3RkdjlpdTJ4NyJ9.nV4dWbnSKYDwVXqsee3oTg';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // Map style
  center: [-71.0589, 42.3601], // [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18 // Maximum allowed zoom
});