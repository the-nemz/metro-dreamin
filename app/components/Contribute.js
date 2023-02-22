import React, { useEffect } from 'react';

import { Modal } from '/components/Modal';

export function Contribute(props) {

  const renderContent = () => {
    return <>
      <iframe className="Contribute-kofi"
              id='kofiframe'
              src='https://ko-fi.com/metrodreamin/?hidefeed=true&widget=true&embed=true&preview=true'
              height='680'
              title='metrodreamin' />
    </>;
  }

  return (
    <Modal animKey='support' baseClass='Contribute' open={props.open}
           heading={`Support MetroDreamin'`} content={renderContent()} onClose={props.onClose} />
  )
}
