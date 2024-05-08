import { useState } from 'react';
import CountUp from 'react-countup';
import ConfettiExplosion from 'react-confetti-explosion';

export function ScorePanel({ systemDocData, isFullscreen }) {
  const [isExploding, setIsExploding] = useState(false);

  if (!systemDocData || !('score' in systemDocData)) return;

  return (
    <div className={`ScorePanel ScorePanel--${isFullscreen ? 'hidden' : 'displayed'} Focus`}>
      <div className='ScorePanel-countUp'>
        <CountUp end={systemDocData.score || 0}
          onEnd={() => {
            setIsExploding(true);
            setTimeout(() => setIsExploding(false), 1000);
          }} />

        <div className='ScorePanel-confetti'>
          {isExploding && (
            <ConfettiExplosion
              colors={['#fc72f3', '#f74aeb', '#e632db', '#bd28b4']}
              duration={3000}
              force={0.2}
              particleCount={Math.sqrt(systemDocData.score || 0)}
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
