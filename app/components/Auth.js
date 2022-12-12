import React, { useContext, useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import ReactTooltip from 'react-tooltip';

import { FirebaseContext, updateUserDoc } from '/lib/firebase.js';
import { LOGO, LOGO_INVERTED } from '/lib/constants.js';

import { Modal } from '/components/Modal.js';

export const Auth = ({ open = false, onClose = () => {} }) => {
  const [emailSelected, setEmailSelected] = useState(false);
  const [inSignIn, setInSignIn] = useState(false);
  const [inSignUp, setInSignUp] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailIsValid, setEmailIsValid] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordIsValid, setPasswordIsValid] = useState(false);
  const [passwordIsVisible, setPasswordIsVisible] = useState(false);
  const [goBackIterator, setGoBackIterator] = useState(0);

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    ReactTooltip.rebuild();
  }, []);

  useEffect(() => {
    setEmailSelected(false);
    setInSignIn(false);
    setInSignUp(false);
    setEmailInput('');
    setEmailIsValid(false);
    setUsernameInput('');
    setPasswordInput('');
    setPasswordIsValid(false);
    setPasswordIsVisible(false);
  }, [open, goBackIterator]);

  useEffect(() => {
    setEmailIsValid(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(emailInput));
  }, [emailInput]);

  useEffect(() => {
    setPasswordIsValid(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,}$/.test(passwordInput));
  }, [passwordInput]);

  useEffect(() => {
    ReactTooltip.rebuild();
  }, [inSignUp]);

  if (!firebaseContext.auth || !firebaseContext.database) return;
  if (firebaseContext.user) return;

  const signInWithGoogle = async () => {
    const googleProvider = new GoogleAuthProvider();
    signInWithPopup(firebaseContext.auth, googleProvider).catch((error) => {
      console.log('signInWithGoogle error:', error)
    });
  };

  const handleEmailSubmit = (event) => {
    event.preventDefault();

    if (emailIsValid) {
      const usersCollection = collection(firebaseContext.database, 'users');
      const usersQuery = query(usersCollection, where('email', '==', emailInput.toLowerCase()));
      getDocs(usersQuery)
        .then((usersSnapshot) => {
          if (usersSnapshot.empty) {
            setInSignUp(true);
          } else {
            const userDocData = usersSnapshot.docs[0].data();
            setUsernameInput(userDocData.displayName ? userDocData.displayName : 'Anon')
            setInSignIn(true);
          }
        })
        .catch((error) => {
          console.log("Error getting documents: ", error);
        });
    }
  }

  const handleSignIn = (event) => {
    event.preventDefault();

    signInWithEmailAndPassword(firebaseContext.auth, emailInput, passwordInput)
      .catch((error) => {
        console.error('signInWithEmailAndPassword error:', error);
      });
  }

  const handleSignUp = (event) => {
    event.preventDefault();

    createUserWithEmailAndPassword(firebaseContext.auth, emailInput, passwordInput)
      .then((userCredential) => {
        const user = userCredential.user;
        updateUserDoc(user.uid, { displayName: usernameInput });
      })
      .catch((error) => {
        console.error('createUserWithEmailAndPassword error:', error);
      });
  }

  const renderPasswordInput = () => {
    const valid = !inSignUp || !passwordInput || passwordIsValid;
    return (
      <div className="Auth-passwordWrap">
        <input className="Auth-input Auth-input--password" value={passwordInput} placeholder="Password"
              data-valid={valid} type={passwordIsVisible ? 'text' : 'password'}
              onChange={(e) => setPasswordInput(e.target.value)} />
        <button className="Auth-toggleShowPassword" data-password-visible={passwordIsVisible}
                onClick={(e) => {
                          e.preventDefault();
                          setPasswordIsVisible(visible => !visible);
                        }}>
          <i className={!passwordIsVisible ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
        </button>
        {/* {!valid && <i className="Auth-errorIcon far fa-circle-question"
                      data-tip="Password must include an uppercase letter, a lowercase letter, a number, and be at least 8 characters">
                   </i>} */}
        {inSignUp && <i className={'Auth-errorIcon far fa-circle-question' + (valid ? '' : ' Auth-errorIcon--red')}
                        data-tip="Password must include an uppercase letter, a lowercase letter, a number, and be at least 8 characters">
                     </i>}
      </div>
    );
  }

  const renderSubmitButton = (text, disabled) => {
    return (
      <button className="Auth-submitButton Button--primary" type="submit" disabled={disabled}>
        {text}
      </button>
    );
  }

  const renderEmailForm = () => {
    if (inSignUp) {
      return (
        <form className="Auth-emailForm" onSubmit={handleSignUp}>
          <div className="Auth-input Auth-input--email">
            {emailInput}
          </div>
          <input className="Auth-input Auth-input--username" value={usernameInput} type="text" placeholder="Username"
                 onChange={(e) => setUsernameInput(e.target.value)} />
          {renderPasswordInput()}
          {renderSubmitButton('Sign up', !passwordIsValid)}
        </form>
      );
    } else if (inSignIn) {
      return (
        <form className="Auth-emailForm" onSubmit={handleSignIn}>
          {renderPasswordInput()}
          {renderSubmitButton('Log in', false)}
        </form>
      );
    } else {
      return (
        <form className="Auth-emailForm" onSubmit={handleEmailSubmit}>
          <input className="Auth-input Auth-input--email" data-valid={!emailInput || emailIsValid} value={emailInput} type="email" placeholder="Email"
                 onChange={(e) => setEmailInput(e.target.value)} />
          {renderSubmitButton('Next', false)}
        </form>
      );
    }
  }

  const renderEmailFormWrapper = () => {
    return (
      <div className="Auth-emailFormWrapper">
        {renderEmailForm()}

        <button className="Auth-goBack Link" onClick={() => setGoBackIterator(i => i + 1)}>
          Back
        </button>
      </div>
    );
  }

  const renderSignInButtons = () => {
    return <>
      <div className="Auth-signInOptions">
        <button className="Auth-signInOption Auth-signInOption--email"
                onClick={() => setEmailSelected(true)}>
          Sign in with email
        </button>

        <button className="Auth-signInOption Auth-signInOption--google"
                onClick={signInWithGoogle}>
          Sign in with Google
        </button>
      </div>

      <div className="Auth-guestWrap">
        <button className="Auth-guestButton Link"
                onClick={() => onClose()}>
          Continue as a guest
        </button>
      </div>
    </>;
  }

  const renderDescription = () => {
    let text = 'Log in or create an account to build and share your dream transportation system.';
    if (inSignIn) {
      text = `Welcome back, ${usernameInput}!`
    } else if (inSignUp) {
      text = 'Sign up to build and share your dream transportation system.';
    }

    return (
      <div className="Auth-description">
        {text}
      </div>
    );
  }

  const renderContent = () => {
    return <>
      <div className="Auth-logoWrap">
        <img className="Auth-logo" src={firebaseContext.settings.lightMode ? LOGO_INVERTED : LOGO} alt="MetroDreamin' logo" />
      </div>

      {renderDescription()}

      {emailSelected ? renderEmailFormWrapper() : renderSignInButtons()}
    </>;
  }

  return (
    <Modal animKey='auth' baseClass='Auth' open={open}
           heading={`MetroDreamin'`} content={renderContent()} onClose={onClose} />
  )
}
