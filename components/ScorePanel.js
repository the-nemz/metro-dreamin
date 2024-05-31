import { useEffect, useState } from 'react';
import CountUp from 'react-countup';
import ConfettiExplosion from 'react-confetti-explosion';
import ReactGA from 'react-ga4';

import { displayLargeNumber } from '/util/helpers.js';
import { MILES_TO_KMS_MULTIPLIER } from '/util/constants.js';

export function ScorePanel({ systemDocData, isFullscreen, viewOnly }) {
  const [isExploding, setIsExploding] = useState(false);
  const [startValue, setStartValue] = useState(0);
  const [endValue, setEndValue] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [usesImperial, setUsesImperial] = useState(false);

  useEffect(() => {
    setUsesImperial((navigator?.language ?? 'en').toLowerCase() === 'en-us');
  }, []);

  useEffect(() => {
    if (systemDocData.score) {
      setStartValue(endValue)
      setEndValue(systemDocData.score)
    }
  }, [systemDocData.score]);

  const handleChange = () => {
    setIsExploding(true);
    setTimeout(() => {
      setIsExploding(false)
    }, 2000);
  }

  const renderDetails = () => {

    let ridership;
    if ('ridership' in systemDocData) {
      ridership = (
        <div className='ScorePanel-item ScorePanel-item--ridership'>
          <div className='ScorePanel-label'>Ridership</div>
          <div className='ScorePanel-value'>{displayLargeNumber(systemDocData.ridership, 3)}</div>
        </div>
      );
    }

    let cost;
    if ('cost' in systemDocData) {
      cost = (
        <div className='ScorePanel-item ScorePanel-item--cost'>
          <div className='ScorePanel-label'>Cost</div>
          <div className='ScorePanel-value'>$ {displayLargeNumber(systemDocData.cost * 1_000_000, 3)}</div>
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

    return (
      <div className={`ScorePanel-details ScorePanel-details--${detailsOpen ? 'expanded' : 'collapsed'}`}>
        <div className={`ScorePanel-items`}>
          {ridership}
          {cost}
          {numStations}
          {numLines}
          {numModes}
          {trackLength}
        </div>

        <div className='ScorePanel-help'>
          <div className='ScorePanel-helpText'>
            Where do these numbers come from?
          </div>

          <i className="far fa-question-circle"
             data-tooltip-content="The score takes into account all of the values above, and more. It also considers the characteristics of the area that the map is located in. Ridership is annual. Cost refers to construction cost, adjusted by country.">
          </i>
        </div>
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

  if (!systemDocData || !('score' in systemDocData)) return;

  return (
    <div className={`ScorePanel ScorePanel--${isFullscreen ? 'hidden' : 'displayed'} Focus`}>
      <div className='ScorePanel-scoreLabel'>
        Score
      </div>
      <div className='ScorePanel-countUp'>
        <CountUp
          start={startValue}
          end={endValue}
          duration={Math.min(Math.abs(endValue - startValue) / 10, 2)}
          onEnd={handleChange}
        />

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

      <div className='ScorePanel-lower'>
          {renderDropdown()}
      </div>
    </div>
  );
}
