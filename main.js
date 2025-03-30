let points = [];
let map;

// Initialize the map with a default center (will be updated when points load)
map = L.map('map').setView([-27.3621, -55.9013], 13); // Centered in Posadas initially

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Sort points by distance from map center with a threshold for local events
function sortPointsByDistance() {
    const mapCenter = map.getCenter();
    const localThreshold = 10; // 10km radius to consider "local" events

    points.sort((a, b) => {
        const distA = calculateDistance(
            mapCenter.lat, 
            mapCenter.lng, 
            a.position[0], 
            a.position[1]
        );
        const distB = calculateDistance(
            mapCenter.lat, 
            mapCenter.lng, 
            b.position[0], 
            b.position[1]
        );
        
        // If one point is local and the other isn't, prioritize the local one
        const aIsLocal = distA <= localThreshold;
        const bIsLocal = distB <= localThreshold;
        
        if (aIsLocal && !bIsLocal) return -1;
        if (!aIsLocal && bIsLocal) return 1;
        
        // If both are local or both are distant, sort by distance
        return distA - distB;
    });

    // Update the points list to reflect the new order
    createPointsList();
}

// Debounce function to limit how often we update during map moves
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Load points from JSON file
async function loadPoints() {
    try {
        const response = await fetch('points.json');
        const data = await response.json();
        points = data.map(item => ({
            id: item.json.id,
            title: item.json.event_details.titulo,
            description: item.json.event_details.descripcion,
            image: item.json.event_details.imagen_url,  // Map the new imagen_url field
            position: [
                item.json.location_data.geo.latitude, 
                item.json.location_data.geo.longitude
            ],
            location: item.json.location_data.lugar,
            address: item.json.event_details.direccion,
            date: new Date(item.json.event_details.fecha),
            time: item.json.event_details.hora,
            price: item.json.event_details.precio,
            organizer: item.json.event_details.organizador,
            contact: item.json.event_details.contacto
        }));

        createMarkers();
        sortPointsByDistance();
        createPointsList();

        // If there are points, center the map on the first one
        if (points.length > 0) {
            map.setView(points[0].position, 13);
        }
    } catch (error) {
        console.error('Error loading points:', error);
    }
}

function createMarkers() {
    points.forEach(point => {
        const marker = L.marker(point.position)
            .bindPopup(`<div class="popup-content">${point.title}</div>`)
            .addTo(map);

        marker.on('click', () => selectPoint(point));
        point.marker = marker; // Store the marker in the point object
    });
}

function formatDate(date) {
    return new Intl.DateTimeFormat('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(date);
}

function createPointCard(point) {
    return `
        <div class="point-card">
            <div class="point-card-thumbnail">
                ${point.image ? `<img src="${point.image}" alt="${point.title}">` : ''}
            </div>
            <div class="point-card-content">
                <h3 class="point-card-title">${point.title}</h3>
                <div class="point-details">
                    <p class="point-date">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                        ${formatDate(point.date)} - ${point.time}
                    </p>
                    <p class="point-location">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                        ${point.location}
                    </p>
                    <p class="point-address">${point.address}</p>
                    ${point.price ? `<p class="point-price">Precio: ${point.price}</p>` : ''}
                </div>
                <p class="point-card-description">${point.description}</p>
                ${point.contact ? `<p class="point-contact">Contacto: ${point.contact}</p>` : ''}
                ${point.organizer ? `<p class="point-organizer">Organizador: ${point.organizer}</p>` : ''}
            </div>
        </div>
    `;
}

function createPointsList() {
    const pointsList = document.getElementById('points-list');
    // Only create list items for points that have markers
    pointsList.innerHTML = points
        .filter(point => point.marker) // Ensure the point has a marker
        .map(point => `
            <div class="point-item" data-id="${point.id}">
                ${point.image ? `<img src="${point.image}" alt="${point.title}" class="point-item-image">` : ''}
                <div class="point-item-content">
                    <h3 class="point-item-title">${point.title}</h3>
                    <p class="point-item-date">${formatDate(point.date)} - ${point.time}</p>
                    <p class="point-item-location">${point.location}</p>
                    ${point.price ? `<p class="point-item-price">Precio: ${formatPrice(point.price)}</p>` : ''}
                </div>
            </div>
        `).join('');

    // Add click event listeners to point items
    pointsList.querySelectorAll('.point-item').forEach(item => {
        item.addEventListener('click', () => {
            const pointId = Number(item.dataset.id); // Convert dataset ID to number
            const point = points.find(p => p.id === pointId);
            if (point) {
                selectPoint(point);
            }
        });
    });
}

function formatPrice(price) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS'
    }).format(price);
}

function selectPoint(point) {
    // Update selected point card
    const selectedPointElement = document.getElementById('selected-point');
    selectedPointElement.innerHTML = createPointCard(point);

    // Update points list selection
    document.querySelectorAll('.point-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.id === point.id);
    });

    // Pan map to selected point
    map.panTo(point.position);
}

// Update points list when map moves (debounced)
const debouncedSort = debounce(() => {
    sortPointsByDistance();
}, 300);

// Replace the existing map.on('moveend') with this:
map.on('moveend', debouncedSort);
map.on('zoomend', debouncedSort);

// Load points when the page loads
loadPoints();
