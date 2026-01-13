import { useEffect, useRef } from 'react';

import { useMapbox } from '/util/mapProvider.js';

export default function MapSlot({ className, style }) {
  const { map, mapRootElRef, mapParkElRef } = useMapbox();
  const hostRef = useRef(null);

  useEffect(() => {
    const root = mapRootElRef?.current;
    if (!root || !hostRef.current) return;

    Object.assign(root.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      left: '',
      top: '',
      overflow: 'hidden'
    });
    if (getComputedStyle(hostRef.current).position === 'static') {
      hostRef.current.style.position = 'relative';
    }

    hostRef.current.appendChild(root);
    map?.resize();

    return () => {
      Object.assign(root.style, { position: 'absolute', width: '0', height: '0', overflow: 'hidden', left: '-99999px', top: '0' });
      const park = mapParkElRef?.current;
      if (park) {
        park.appendChild(root);
      } else {
        document.body.appendChild(root);
      }
      map?.resize();
    };
  }, [map]);

  return <div ref={hostRef} className={className} style={style} />;
}
