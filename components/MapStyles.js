import React, { useState } from 'react';

export function MapStyles({ mapStyleOverride = '', setMapStyleOverride = () => {}}) {
  return (
    <div className="MapStyles">
      <label className="MapStyles-label MapStyles-label--default">
        <input type="radio" className="MapStyles-input MapStyles-input--default" name="default" value=""
               checked={mapStyleOverride === ''}
               onClick={() => setMapStyleOverride('')} />
        <span className="MapStyles-check"></span>
        Default
      </label>

      <label className="MapStyles-label MapStyles-label--satellite">
        <input type="radio" className="MapStyles-input MapStyles-input--satellite" name="satellite" value="satellite"
               checked={mapStyleOverride === 'satellite'}
               onClick={() => setMapStyleOverride('satellite')} />
        <span className="MapStyles-check"></span>
        Satellite
      </label>

      <label className="MapStyles-label MapStyles-label--topographic">
        <input type="radio" className="MapStyles-input MapStyles-input--topographic" name="topographic" value="topographic"
              checked={mapStyleOverride === 'topographic'}
              onClick={() => setMapStyleOverride('topographic')} />
        <span className="MapStyles-check"></span>
        Topographic
      </label>
    </div>
  )
}
