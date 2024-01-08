import React, { useState, useContext, useEffect } from 'react';

import { DeviceContext } from '/util/deviceContext.js';

export function MapStyles({ mapStyleOverride = '', setMapStyleOverride = () => {}}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { isMobile } = useContext(DeviceContext);

  useEffect(() => {
    if (isMobile && !isCollapsed) {
      setIsCollapsed(true);
    } else if (!isMobile && isCollapsed) {
      setIsCollapsed(false);
    }
  }, [isMobile])

  return (
    <div className="MapStyles">
      {isMobile && (
        <button className={`MapStyles-toggle MapStyles-toggle--${isCollapsed ? 'collapsed' : 'expanded'} Link`}
                onClick={() => setIsCollapsed(curr => !curr)}>
          {isCollapsed ? 'Open styles' : 'Close styles'}
          <i className="fas fa-chevron-down"></i>
        </button>
        )}
      <div className={`MapStyles-options MapStyles-options--${isCollapsed ? 'collapsed' : 'expanded'}`}>
        <label className="MapStyles-label MapStyles-label--default Link">
          <input type="radio" className="MapStyles-input MapStyles-input--default" name="default" value=""
                checked={mapStyleOverride === ''}
                onChange={() => setMapStyleOverride('')} />
          <span className="MapStyles-check"></span>
          Default
        </label>

        <label className="MapStyles-label MapStyles-label--satellite Link">
          <input type="radio" className="MapStyles-input MapStyles-input--satellite" name="satellite" value="satellite"
                checked={mapStyleOverride === 'satellite'}
                onChange={() => setMapStyleOverride('satellite')} />
          <span className="MapStyles-check"></span>
          Satellite
        </label>

        <label className="MapStyles-label MapStyles-label--topographic Link">
          <input type="radio" className="MapStyles-input MapStyles-input--topographic" name="topographic" value="topographic"
                checked={mapStyleOverride === 'topographic'}
                onChange={() => setMapStyleOverride('topographic')} />
          <span className="MapStyles-check"></span>
          Topographic
        </label>

        <label className="MapStyles-label MapStyles-label--railways Link">
          <input type="radio" className="MapStyles-input MapStyles-input--railways" name="railways" value="railways"
                checked={mapStyleOverride === 'railways'}
                onChange={() => setMapStyleOverride('railways')} />
          <span className="MapStyles-check"></span>
          Railways
        </label>
      </div>
    </div>
  )
}
