import { useEffect, useState } from 'react';
import CountUp from 'react-countup';
import ConfettiExplosion from 'react-confetti-explosion';
import ReactGA from 'react-ga4';
import classNames from 'classnames';

import { displayLargeNumber } from '/util/helpers.js';
import { MILES_TO_KMS_MULTIPLIER } from '/util/constants.js';

import { Toggle } from '/components/Toggle.js';
import { Revenue } from '/components/Revenue.js';

export function ScorePanel({ systemDocData, isFullscreen, viewOnly, isMobile, onToggleScoreIsHidden }) {
  const [isExploding, setIsExploding] = useState(false);
  const [startValue, setStartValue] = useState(0);
  const [endValue, setEndValue] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [usesImperial, setUsesImperial] = useState(false);
  const [showRevenue, setShowRevenue] = useState(false);

  const scoreIsHidden = !systemDocData || systemDocData.scoreIsHidden || (viewOnly && !('score' in systemDocData));

  useEffect(() => {
    setUsesImperial((navigator?.language ?? 'en').toLowerCase() === 'en-us');
  }, []);

  useEffect(() => {
    if ('score' in systemDocData || 'hiddenScore' in systemDocData) {
      setStartValue(endValue);
      setEndValue(systemDocData.score || systemDocData.hiddenScore || 0);
      setShowRevenue(false)
      setTimeout(() => setShowRevenue(true), 1000);
    }
  }, [systemDocData.score, systemDocData.hiddenScore]);

  const handleChange = () => {
    setIsExploding(true);
    setTimeout(() => setIsExploding(false), 2000);
  }

  const renderHelp = () => {
    if (scoreIsHidden) return;

    return (
      <div className='ScorePanel-help'>
        <div className='ScorePanel-helpText'>
          Where do these numbers come from?
        </div>

        <i className="far fa-question-circle"
          data-tooltip-content="The score takes into account all of the values above, and more. It also considers the characteristics of the area that the map is located in. Ridership is annual. Cost refers to construction and vehicle cost, adjusted by country.">
        </i>
      </div>
    )
  }

  const renderDetails = () => {

    let ridership;
    if (!scoreIsHidden) {
      const ridershipText = 'ridership' in systemDocData || 'hiddenRidership' in systemDocData ?
                            displayLargeNumber(systemDocData.ridership ?? systemDocData.hiddenRidership, 3) :
                            '–';
      ridership = (
        <div className='ScorePanel-item ScorePanel-item--ridership'>
          <div className='ScorePanel-label'>Ridership</div>
          <div className='ScorePanel-value'>{ridershipText}</div>
        </div>
      );
    }

    let cost;
    if (!scoreIsHidden) {
      const costText = 'cost' in systemDocData || 'hiddenCost' in systemDocData ?
                       displayLargeNumber((systemDocData.cost ?? systemDocData.hiddenCost) * 1_000_000, 3) :
                       '–';
      cost = (
        <div className='ScorePanel-item ScorePanel-item--cost'>
          <div className='ScorePanel-label'>Cost</div>
          <div className='ScorePanel-value'>$ {costText}</div>
        </div>
      );
    }

    let numStations;
    if ('numStations' in systemDocData) {
      numStations = (
        <div className='ScorePanel-item ScorePanel-item--numStations'>
          <div className='ScorePanel-label'>Stations</div>
          <div className='ScorePanel-value'>{displayLargeNumber(systemDocData.numStations)}</div>
        </div>
      );
    }

    let numLines;
    if ('numLines' in systemDocData) {
      numLines = (
        <div className='ScorePanel-item ScorePanel-item--numLines'>
          <div className='ScorePanel-label'>Lines</div>
          <div className='ScorePanel-value'>{displayLargeNumber(systemDocData.numLines)}</div>
        </div>
      );
    }

    let numModes;
    if ('numModes' in systemDocData) {
      numModes = (
        <div className='ScorePanel-item ScorePanel-item--numModes'>
          <div className='ScorePanel-label'>Modes</div>
          <div className='ScorePanel-value'>{displayLargeNumber(systemDocData.numModes)}</div>
        </div>
      );
    }

    let trackLength;
    if ('trackLength' in systemDocData) {
      const multiplier = usesImperial ? 1 : MILES_TO_KMS_MULTIPLIER;
      const distanceText = `${displayLargeNumber(systemDocData.trackLength * multiplier)} ${usesImperial ? 'mi' : 'km'}`;

      trackLength = (
        <div className='ScorePanel-item ScorePanel-item--trackLength'>
          <div className='ScorePanel-label'>Length</div>
          <div className='ScorePanel-value'>{distanceText}</div>
        </div>
      );
    }

    let numWaypoints;
    if ('numWaypoints' in systemDocData) {
      numWaypoints = (
        <div className='ScorePanel-lesserItem'>
          Waypoints: <span className='ScorePanel-lesserValue'>{displayLargeNumber(systemDocData.numWaypoints)}</span>
        </div>
      )
    }

    let numInterchanges;
    if ('numInterchanges' in systemDocData) {
      numInterchanges = (
        <div className='ScorePanel-lesserItem'>
          Interchanges: <span className='ScorePanel-lesserValue'>{displayLargeNumber(systemDocData.numInterchanges)}</span>
        </div>
      )
    }

    let detailsClasses = classNames('ScorePanel-details', {
      'ScorePanel-details--expanded': scoreIsHidden || detailsOpen,
      'ScorePanel-details--collapsed': !scoreIsHidden && !detailsOpen,
      'ScorePanel-details--viewOnly': viewOnly,
      'ScorePanel-details--scoreIsHidden': scoreIsHidden,
    })
    return (
      <div className={detailsClasses}>
        <div className='ScorePanel-items'>
          {ridership}
          {cost}
          {numStations}
          {numLines}
          {numModes}
          {trackLength}
        </div>

        {!viewOnly && (
          <div className='ScorePanel-lesserItems'>
            {numWaypoints}
            {numInterchanges}
          </div>
        )}

        {!viewOnly && (
          <div className='ScorePanel-toggle'>
            <Toggle onClick={onToggleScoreIsHidden}
                    tip={systemDocData.scoreIsHidden ? 'Click show score, ridership, and cost' : 'Click to hide score, ridership, and cost'}
                    isOn={!systemDocData.scoreIsHidden}
                    text={systemDocData.scoreIsHidden ? 'Score hidden' : 'Score visible'} />

            <i className="far fa-question-circle"
              data-tooltip-content="Hide the score, ridership, and construction cost for all users. This option is useful for experimental or fun maps not intended to be practical.">
            </i>
          </div>
        )}

        {renderHelp()}
      </div>
    )
  }

  const renderDropdown = () => {
    return (
      <div className="ScorePanel-dropdown">
        <button className={`ScorePanel-trigger ScorePanel-trigger--${detailsOpen ? 'expanded' : 'collapsed'}`}
                onClick={() => {
                  setDetailsOpen(curr => !curr);

                  ReactGA.event({
                    category: 'System',
                    action: detailsOpen ? 'Hide Score Details' : 'Show Score Details'
                  });
                }}>
          <i className="fa fa-angle-down"></i>

          <div className="ScorePanel-triggerText">
            {detailsOpen ? 'Hide' : 'Show'} details
          </div>
        </button>

        {renderDetails()}
      </div>
    )
  }

  const renderScore = () => {
    if (scoreIsHidden) return;

    let countUpElem;
    if (!viewOnly && !('score' in systemDocData) && !('hiddenScore' in systemDocData)) {
      countUpElem = (
        <div className='ScorePanel-unscored'>
          <div>{'–'}</div>
          <div className='ScorePanel-unscoredText'>Save to calculate</div>
        </div>
      )
    } else {
      countUpElem = (
        <CountUp
          start={startValue}
          end={endValue}
          duration={Math.min(Math.abs(endValue - startValue) / 10, 2)}
          onEnd={handleChange}
        />
      )
    }

    return <>
      <div className='ScorePanel-scoreLabel'>
        Score
      </div>
      <div className='ScorePanel-countUp'>
        {countUpElem}

        <div className='ScorePanel-confetti'>
          {!viewOnly && isExploding && (
            <ConfettiExplosion
              colors={['#fc72f3', '#f74aeb', '#e632db', '#bd28b4']}
              duration={3000}
              force={0.2}
              particleCount={Math.round(Math.sqrt(Math.max(endValue - startValue, 0)))}
              particleSize={8}
              width={350}
              zIndex={4}
            />
          )}
        </div>
      </div>
    </>
  }

  if (!systemDocData) return;

  return (
    <div className={`ScorePanel ScorePanel--${isFullscreen ? 'hidden' : 'displayed'} Focus`}>
      {renderScore()}

      <div className='ScorePanel-lower'>
        {scoreIsHidden ? renderDetails() : renderDropdown()}

        {showRevenue && isMobile && <Revenue unitName='scorePanelMobile' />}
        {showRevenue && !isMobile && <Revenue unitName='scorePanelDesktop' />}
      </div>
    </div>
  );
}
