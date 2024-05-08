import { useEffect, useState } from 'react';
import CountUp from 'react-countup';
import ConfettiExplosion from 'react-confetti-explosion';

export function ScorePanel({ systemDocData, isFullscreen }) {
  const [isExploding, setIsExploding] = useState(false);
  const [startValue, setStartValue] = useState(0);
  const [endValue, setEndValue] = useState(0);

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
    }, 3000);
  }

  if (!systemDocData || !('score' in systemDocData)) return;

  return (
    <div className={`ScorePanel ScorePanel--${isFullscreen ? 'hidden' : 'displayed'} Focus`}>
      <div className='ScorePanel-countUp'>
        <CountUp
          start={startValue}
          end={endValue}
          duration={Math.min(Math.abs(endValue - startValue) / 10, 2)}
          onEnd={handleChange}
        />

        <div className='ScorePanel-confetti'>
          {isExploding && (
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
    </div>
  );
}
