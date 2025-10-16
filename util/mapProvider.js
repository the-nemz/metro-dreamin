import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
  console.error('Missing NEXT_PUBLIC_MAPBOX_TOKEN');
}
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const MapCtx = createContext(null);

export function MapProvider({ children }) {
  const [ map, setMap ] = useState(null);
  const initializedRef = useRef(false);
  const mapRootElRef = useRef(null);
  const mapParkElRef = useRef(null);

  useEffect(() => {
    if (initializedRef.current) return;
    // refs will be assigned by the JSX elements we render below
    const container = mapRootElRef.current;
    if (!container || !process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return;

    const m = new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/dark-v10',
      projection: 'globe',
      zoom: 1
    });

    m.once('styledata', () => setMap(m));
    initializedRef.current = true;
    return () => m.remove();
  }, []);

  const value = useMemo(() => ({ map, mapRootElRef, mapParkElRef }), [map]);

  return (
    <MapCtx.Provider value={value}>
      <div ref={mapParkElRef} id="map-park" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', left: -99999, top: 0 }}>
        <div ref={mapRootElRef} id="map-root" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', left: -99999, top: 0 }} />
      </div>
      {children}
    </MapCtx.Provider>
  );
}

export function useMapbox() {
  return useContext(MapCtx);
}
