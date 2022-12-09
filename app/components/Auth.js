import React, { useContext } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

import { FirebaseContext } from '/lib/firebase.js';
import { LOGO, LOGO_INVERTED } from '/lib/constants.js';

import { Modal } from 'components/Modal.js';

export const Auth = ({ open = false, onClose = () => {} }) => {
  const firebaseContext = useContext(FirebaseContext);

  if (!firebaseContext.auth || !firebaseContext.database) return;
  if (firebaseContext.user) return;

  const signInWithGoogle = async () => {
    console.log(firebaseContext.auth)
    const googleProvider = new GoogleAuthProvider();
    signInWithPopup(firebaseContext.auth, googleProvider).catch((error) => {
      console.log('signInWithGoogle error:', error)
    });
  };

  const renderContent = () => {
    return <>
      <div className="Auth-logoWrap">
        <img className="Auth-logo" src={firebaseContext.settings.lightMode ? LOGO_INVERTED : LOGO} alt="MetroDreamin' logo" />
      </div>

      <h2 className="Auth-description">
        Sign up to build and share your dream transportation system.
      </h2>

      <div className="Auth-signInOptions">
        <button className="Auth-signInOption Auth-signInOption--google"
                onClick={signInWithGoogle}>
          Sign in with Google
        </button>
      </div>

      <div className="Auth-guestWrap">
        <button className="Auth-guestButton Link"
                onClick={() => alert('TODO')}>
          Continue as a guest
        </button>
      </div>
    </>;
  }

  return (
    <Modal animKey='auth' baseClass='Auth' open={open}
           heading={`MetroDreamin'`} content={renderContent()} onClose={onClose} />
  )
}
