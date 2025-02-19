mapboxgl.accessToken = 'pk.eyJ1IjoiaGFuYWp1bGlhdGoiLCJhIjoiY203YmJoN2w1MDh0NTJrb3RkdjlpdTJ4NyJ9.nV4dWbnSKYDwVXqsee3oTg';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', 
  style: 'mapbox://styles/mapbox/streets-v12', 
  center: [-71.0589, 42.3601], 
  zoom: 12, 
  minZoom: 5, 
  maxZoom: 18 
});

// Select the SVG overlay and initialize data arrays
const svg = d3.select('#overlay');  
let stations = [];
let trips = [];  
let filteredTrips = [];
let filteredArrivals = new Map();
let filteredDepartures = new Map();
let filteredStations = [];
let timeFilter = -1; 

// Select the slider elements
const timeSlider = document.getElementById('time-slider');
const selectedTime = document.getElementById('selected-time');
const anyTimeLabel = document.getElementById('any-time');

// Format time from minutes into HH:MM AM/PM
function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes);
    return date.toLocaleString('en-US', { timeStyle: 'short' });
}

// Update time display and filter data
function updateTimeDisplay() {
    timeFilter = Number(timeSlider.value);
    if (timeFilter === -1) {
        selectedTime.textContent = '';
        anyTimeLabel.style.display = 'block';
    } else {
        selectedTime.textContent = formatTime(timeFilter);
        anyTimeLabel.style.display = 'none';
    }
    filterTripsByTime();
}

// Event listener for slider
timeSlider.addEventListener('input', updateTimeDisplay);
updateTimeDisplay(); 

// Convert station coordinates to pixel positions
function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat);
    const { x, y } = map.project(point);
    return { cx: x, cy: y };
}

// Convert Date object to minutes since midnight
function minutesSinceMidnight(date) {
    return date instanceof Date && !isNaN(date) ? date.getHours() * 60 + date.getMinutes() : null;
}

// Filter trips based on selected time
function filterTripsByTime() {
    filteredTrips = timeFilter === -1
        ? trips
        : trips.filter(trip => {
            const startedMinutes = minutesSinceMidnight(trip.started_at);
            const endedMinutes = minutesSinceMidnight(trip.ended_at);
            return (
                (startedMinutes !== null && Math.abs(startedMinutes - timeFilter) <= 60) ||
                (endedMinutes !== null && Math.abs(endedMinutes - timeFilter) <= 60)
            );
        });

    // Compute filtered arrivals and departures
    filteredDepartures = d3.rollup(filteredTrips, v => v.length, d => d.start_station_id);
    filteredArrivals = d3.rollup(filteredTrips, v => v.length, d => d.end_station_id);

    // Update filtered station data
    filteredStations = stations.map(station => {
        let id = station.short_name;
        return {
            ...station,
            arrivals: filteredArrivals.get(id) ?? 0,
            departures: filteredDepartures.get(id) ?? 0,
            totalTraffic: (filteredArrivals.get(id) ?? 0) + (filteredDepartures.get(id) ?? 0)
        };
    });

    updateMapWithFilteredData();
}

// Update map based on filtered data
function updateMapWithFilteredData() {
    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(filteredStations, d => d.totalTraffic)])
        .range(timeFilter === -1 ? [2, 25] : [3, 50]);

    svg.selectAll('circle')
        .data(filteredStations)
        .join('circle')
        .attr('r', d => radiusScale(d.totalTraffic))
        .attr('cx', d => getCoords(d).cx)
        .attr('cy', d => getCoords(d).cy)
        .select('title')
        .text(d => `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
}

// Load map data
map.on('load', () => { 
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...'
    });

    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
    });

    // Fetch station data
    const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
    d3.json(jsonurl).then(jsonData => {
        stations = jsonData.data.stations;
        console.log('Stations Array:', stations);

        // Fetch traffic data
        const trafficUrl = "https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv";
        d3.csv(trafficUrl).then(data => {
            trips = data.map(trip => ({
                ...trip,
                started_at: new Date(trip.started_at),  
                ended_at: new Date(trip.ended_at)       
            }));

            console.log("Loaded traffic data:", trips);

            // Compute departures and arrivals
            const departures = d3.rollup(trips, v => v.length, d => d.start_station_id);
            const arrivals = d3.rollup(trips, v => v.length, d => d.end_station_id);

            // Add traffic data to stations
            stations = stations.map(station => ({
                ...station,
                arrivals: arrivals.get(station.short_name) ?? 0,
                departures: departures.get(station.short_name) ?? 0,
                totalTraffic: (arrivals.get(station.short_name) ?? 0) + (departures.get(station.short_name) ?? 0)
            }));

            // Create square root scale for marker size
            const radiusScale = d3.scaleSqrt()
                .domain([0, d3.max(stations, d => d.totalTraffic)])
                .range([2, 25]);

            // Append circles to SVG
            const circles = svg.selectAll('circle')
                .data(stations)
                .enter()
                .append('circle')
                .attr('r', d => radiusScale(d.totalTraffic))
                .attr('fill', 'steelblue')
                .attr('stroke', 'white')
                .attr('stroke-width', 1)
                .attr('opacity', 0.6)
                .style('pointer-events', 'auto')
                .each(function(d) {
                    d3.select(this)
                      .append('title')
                      .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
                });

            function updatePositions() {
                circles
                    .attr('cx', d => getCoords(d).cx)
                    .attr('cy', d => getCoords(d).cy);
            }

            updatePositions();
            map.on('move', updatePositions);     
            map.on('zoom', updatePositions);     
            map.on('resize', updatePositions);   
            map.on('moveend', updatePositions);  

        }).catch(error => {
            console.error("Error loading traffic CSV:", error);
        });

    }).catch(error => {
        console.error('Error loading JSON:', error);
    });
});

// Add map layers
map.on('sourcedata', (e) => {
    if (e.sourceId === 'boston_route' && e.isSourceLoaded && !map.getLayer('bike-lanes')) {
        map.addLayer({
            id: 'bike-lanes',
            type: 'line',
            source: 'boston_route',
            paint: { 'line-color': '#32D400', 'line-width': 5, 'line-opacity': 0.5 }
        });
    }
    if (e.sourceId === 'cambridge_route' && e.isSourceLoaded && !map.getLayer('cambridge-bike-lanes')) {
        map.addLayer({
            id: 'cambridge-bike-lanes',
            type: 'line',
            source: 'cambridge_route',
            paint: { 'line-color': '#32D400', 'line-width': 5, 'line-opacity': 0.5 }
        });
    }
});
