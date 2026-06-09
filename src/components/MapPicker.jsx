import React, { useState, useRef, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function LocationMarker({ position, setPosition }) {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  const markerRef = useRef(null);
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          setPosition(marker.getLatLng());
        }
      },
    }),
    [setPosition],
  );

  return position === null ? null : (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
    >
      <Popup>Delivery Location</Popup>
    </Marker>
  );
}

export default function MapPicker({ onAddressSelect }) {
  const [position, setPosition] = useState({ lat: 28.6139, lng: 77.2090 }); // Default New Delhi
  const [loading, setLoading] = useState(false);

  // Mock Geocoding function (since no API key was provided)
  const fetchAddress = async (latlng) => {
    setLoading(true);
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Generate a fake address based on coordinates
    const mockAddress = {
      line1: `Plot ${Math.floor(Math.abs(latlng.lat * 100))}, Sector ${Math.floor(Math.abs(latlng.lng * 10))}`,
      city: 'Cyber City',
      state: 'Neon State',
      pincode: `1100${Math.floor(Math.random() * 90) + 10}`,
      lat: latlng.lat,
      lng: latlng.lng
    };
    
    setLoading(false);
    onAddressSelect(mockAddress);
  };

  return (
    <div className="map-picker-container" style={{ width: '100%', height: '400px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--wire-glow)' }}>
      <MapContainer center={position} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" // Dark theme map
        />
        <LocationMarker position={position} setPosition={setPosition} />
      </MapContainer>
      <div style={{ padding: '15px', background: '#111', borderTop: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: '#888' }}>Drag pin to exact location</span>
        <button 
          onClick={() => fetchAddress(position)}
          disabled={loading}
          style={{
            background: 'var(--wire-glow)',
            color: '#000',
            border: 'none',
            padding: '8px 16px',
            fontFamily: 'var(--font-wireframe)',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'LOCATING...' : 'CONFIRM LOCATION'}
        </button>
      </div>
    </div>
  );
}
