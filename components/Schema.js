import React, { useMemo } from 'react';

import { getUserDisplayName, getMode, getLevel } from '/util/helpers.js';

const DEFAULT_KEYWORDS = [
  'map maker', 'metro map maker', 'subway map maker', 'transit map maker', 'rail map maker', 'bus map maker',
  'map creator', 'metro map creator', 'subway map creator', 'transit map creator', 'rail map creator', 'bus map creator',
  'dream map', 'fantasy map', 'fantasy metro', 'fantasy subway', 'map sketch', 'map tool', 'transit tool', 'public transportation map'
];

export function Schema({ systemDocData, ownerDocData, fullSystem, thumbnail }) {
  const keywords = useMemo(() => {
    return [
      ...(systemDocData?.keywords ?? []),
      ...DEFAULT_KEYWORDS
    ].join(', ');
  }, [ systemDocData.keywords ]);

  const level = useMemo(() => getLevel({ key: systemDocData.level }), [ systemDocData.level ]);

  const linesText = useMemo(() => {
    const lines = fullSystem.map?.lines ?? {};
    const stations = fullSystem.map?.stations ?? {};

    let lineTexts = [];
    for (const line of Object.values(lines)) {

      let stationNames = [];
      for (const sId of (line.stationIds || [])) {
        const isWaypointForLine = stations[sId].isWaypoint || (line.waypointOverrides || []).includes(sId);
        if (isWaypointForLine) continue;

        stationNames.push(`${stations[sId].name ? stations[sId].name : 'Station'}`);
      }

      const parenthetical = `${getMode(line.mode).label}, ${stationNames.length} stations`;
      const lineText = `* ${line.name ? line.name : 'Line'}: (${parenthetical}) ${stationNames.join(', ')}`;
      lineTexts.push(lineText);
    }

    return lineTexts.join('\n');
  }, [fullSystem.map]);

  if (!systemDocData || !ownerDocData) return;

  const title = systemDocData.title ? systemDocData.title : 'Map';

  return (
    <article className="Schema sr-only">
      <div>
        <span itemProp="name">{title}</span> by <span itemProp="author" itemScope itemType="https://schema.org/Person">
                                                  <span itemProp="name">{getUserDisplayName(ownerDocData)}</span>
                                                  <meta itemProp="url" content={`https://metrodreamin.com/user/${systemDocData.userId}`} />
                                                </span>
      </div>
      {systemDocData.creationDate && <div>created at <span itemProp="datePublished">{(new Date(systemDocData.creationDate).toISOString())}</span></div>}
      {systemDocData.lastUpdated && <div>updated at <span itemProp="dateModified">{(new Date(systemDocData.lastUpdated).toISOString())}</span></div>}
      <div itemProp="abstract">{systemDocData.caption ? systemDocData.caption : 'Map created on MetroDreamin.com'}</div>
      <div itemProp="text">
        {level?.label && <span>Map type: {level.label} | </span>}
        <span>Total track length: {Math.round(systemDocData.trackLength || 0)} miles | </span>
        {systemDocData.centroid?.lat && systemDocData.centroid?.lng &&
          <span>Center coordinate: {systemDocData.centroid.lat}, {systemDocData.centroid.lng} | </span>}
        {linesText && <span>{linesText}</span>}
      </div>
      <div itemProp="keywords">{keywords}</div>
      <meta itemProp="image" content={thumbnail} />
      <meta itemProp="headline" content={title} />
      <meta itemProp="url" content={`https://metrodreamin.com/view/${encodeURIComponent(systemDocData.systemId)}`} />
      <meta itemProp="commentCount" content={systemDocData.commentsCount || 0} />
      <div itemProp="interactionStatistic" itemType="https://schema.org/InteractionCounter" itemScope>
        <meta itemProp="userInteractionCount" content={systemDocData.stars || 0} />
        <meta itemProp="interactionType" content="https://schema.org/LikeAction" />
      </div>
    </article>
  )
}
