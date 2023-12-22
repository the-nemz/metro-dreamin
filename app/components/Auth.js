import React, { useContext, useEffect, useState } from 'react';
import { collectionGroup, query, where, getDocs, doc, getDoc, limit } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import ReactGA from 'react-ga4';

import { FirebaseContext, updateUserDoc } from '/lib/firebase.js';
import { LOGO, LOGO_INVERTED, EMAIL, GOOGLE } from '/lib/constants.js';

import { Modal } from '/components/Modal.js';

export const Auth = ({ open = false, onClose = () => {} }) => {
  const [emailSelected, setEmailSelected] = useState(false);
  const [inSignIn, setInSignIn] = useState(false);
  const [inSignUp, setInSignUp] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailIsValid, setEmailIsValid] = useState(false);
  const [userdataIsLoading, setUserdataIsLoading] = useState(false);
  const [otherProviders, setOtherProviders] = useState();
  const [accountIsDisabled, setAccountIsDisabled] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordIsValid, setPasswordIsValid] = useState(false);
  const [passwordIsVisible, setPasswordIsVisible] = useState(false);
  const [passwordIsIncorrect, setPasswordIsIncorrect] = useState(false);
  const [goBackIterator, setGoBackIterator] = useState(0);

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    setEmailSelected(false);
    setInSignIn(false);
    setInSignUp(false);
    setEmailInput('');
    setEmailIsValid(false);
    setUserdataIsLoading(false);
    setOtherProviders();
    setAccountIsDisabled(false);
    setUsernameInput('');
    setPasswordInput('');
    setPasswordIsValid(false);
    setPasswordIsVisible(false);
    setPasswordIsIncorrect(false);
  }, [open, goBackIterator]);

  useEffect(() => {
    // validates that there is an @ and a TLD with >= 2 characters
    setEmailIsValid(/^.+@.+\..{2,}$/.test(emailInput));
  }, [emailInput]);

  useEffect(() => {
    // validates it is at least 8 characters and there is an uppercase letter, a lowercase letter, and a number and/or special character
    setPasswordIsValid(/^.*(?=.{8,})(?=.*[a-z])(?=.*[A-Z])(?=.*[ !"#$%&'()*+,:;<=>?@^_`{|}~_\-\.\/\\\[\]0-9]).*$/.test(passwordInput));
    setPasswordIsIncorrect(false);
  }, [passwordInput]);

  if (!firebaseContext.auth || !firebaseContext.database) return;
  if (firebaseContext.user) return;

  const signInWithGoogle = async () => {
    const googleProvider = new GoogleAuthProvider();
    signInWithPopup(firebaseContext.auth, googleProvider).catch((error) => {
      console.log('signInWithGoogle error:', error)
    });
    ReactGA.event({
      category: 'Auth',
      action: 'Sign in with Google'
    });
  };

  const handleUserQueryData = (userQueryData) => {
    if (!userQueryData) {
      setInSignUp(true);
      return;
    };

    if (userQueryData.error) {
      switch (userQueryData.error) {
        case 'User not found':
          setInSignUp(true);
          break;
        case 'Email address is malformed':
          console.error('handleUserQueryData: Email address is malformed');
          setEmailIsValid(false);
          break;
        default:
          console.error('Unexpected response error from user email query:', userQueryData.error);
          setInSignUp(true);
          break;
      }
      return;
    }

    if (userQueryData.authRecord?.disabled) {
      setAccountIsDisabled(true);
      return;
    }

    if ((userQueryData.authRecord?.providerData ?? []).length) {
      setUsernameInput(userQueryData.userDocData?.displayName ? userQueryData.userDocData.displayName : 'Anonymous');

      const hasPasswordAuth = userQueryData.authRecord.providerData.find(pData => (pData?.providerId ?? '') === 'password');
      if (hasPasswordAuth) {
        setInSignIn(true);
        return;
      } else {
        setOtherProviders(userQueryData.authRecord.providerData.map(pData => (pData?.providerId ?? '').replace('.com', '')));

        ReactGA.event({
          category: 'Auth',
          action: 'Using Other Provider'
        });
      }
    } else {
      setInSignUp(true);
      return;
    }
  }

  const handleEmailSubmit = async (event) => {
    event.preventDefault();

    if (emailIsValid) {
      setUserdataIsLoading(true);

      try {
        const qParams = new URLSearchParams({ email: emailInput });
        const userQueryResponse = await fetch(`${firebaseContext.apiBaseUrl}/users?${qParams}`);
        const userQueryData = await userQueryResponse.json();

        handleUserQueryData(userQueryData);
      } catch (e) {
        console.error('Unexpected error getting userId for email', e);
      }

      setUserdataIsLoading(false);

      ReactGA.event({
        category: 'Auth',
        action: 'Email Submit'
      });
    }
  }

  const handleSignIn = (event) => {
    event.preventDefault();

    signInWithEmailAndPassword(firebaseContext.auth, emailInput, passwordInput)
      .then(() => {
        ReactGA.event({
          category: 'Auth',
          action: 'Email/Password Sign In'
        });
      })
      .catch((error) => {
        console.error('signInWithEmailAndPassword error:', error);
        if (error.name === 'FirebaseError') {
          setPasswordIsIncorrect(true);

          ReactGA.event({
            category: 'Auth',
            action: 'Password Incorrect'
          });
        }
      });
  }

  const handleSignUp = (event) => {
    event.preventDefault();

    if (!emailInput || !passwordInput || !usernameInput.trim()) return;

    createUserWithEmailAndPassword(firebaseContext.auth, emailInput, passwordInput)
      .then((userCredential) => {
        const user = userCredential.user;
        updateUserDoc(user.uid, { displayName: usernameInput.trim() });

        ReactGA.event({
          category: 'Auth',
          action: 'Create User with Email'
        });
      })
      .catch((error) => {
        console.error('createUserWithEmailAndPassword error:', error);
      });
  }

  const renderPasswordInput = () => {
    const valid = !inSignUp || !passwordInput || passwordIsValid;
    return (
      <div className="Auth-passwordWrap">
        <input className="Auth-input Auth-input--email Auth-input--hidden" value={emailInput} type={'text'} readOnly />
        <input className="Auth-input Auth-input--password" value={passwordInput} placeholder="Password"
              data-valid={valid && !passwordIsIncorrect} type={passwordIsVisible ? 'text' : 'password'} autoFocus={inSignIn}
              onChange={(e) => setPasswordInput(e.target.value)} />
        <button className="Auth-toggleShowPassword" data-password-visible={passwordIsVisible} type="button"
                onClick={(e) => {
                          e.preventDefault();
                          setPasswordIsVisible(visible => !visible);

                          ReactGA.event({
                            category: 'Auth',
                            action: 'Toggle Password Visibility'
                          });
                        }}>
          <i className={!passwordIsVisible ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
        </button>
        {inSignUp && <i className={'Auth-errorIcon far fa-circle-question' + (valid ? '' : ' Auth-errorIcon--red')}
                        data-tooltip-content="Password must include an uppercase letter, a lowercase letter, a number and/or special character, and be at least 8 characters">
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
          <input className="Auth-input Auth-input--email" value={emailInput} type="email" readOnly={true} />
          <input className="Auth-input Auth-input--displayName"
                 value={usernameInput} type="text" placeholder="Display Name" autoFocus
                 onChange={(e) => setUsernameInput(e.target.value)} />
          {renderPasswordInput()}
          {renderSubmitButton('Sign up', !passwordIsValid || !usernameInput.trim())}
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
          <input className="Auth-input Auth-input--email"
                 data-valid={!emailInput || emailIsValid} value={emailInput}
                 type="email" placeholder="Email" autoFocus
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

        <button className="Auth-goBack Link"
                onClick={() => {
                          setGoBackIterator(i => i + 1);
                          ReactGA.event({
                            category: 'Auth',
                            action: 'Go Back'
                          });
                        }}>
          Back
        </button>
      </div>
    );
  }

  const renderSignInButtons = () => {
    return <>
      <div className="Auth-signInOptions">
        <button className="Auth-signInOption Auth-signInOption--email"
                onClick={() => {
                  setEmailSelected(true);
                  ReactGA.event({
                    category: 'Auth',
                    action: 'Sign in with Email'
                  });
                }}>
          <img className="Auth-optionIcon" src={EMAIL} />
          Sign in with email
        </button>

        <button className="Auth-signInOption Auth-signInOption--google"
                onClick={signInWithGoogle}>
          <img className="Auth-optionIcon" src={GOOGLE} />
          Sign in with Google
        </button>
      </div>

      <div className="Auth-guestWrap">
        <button className="Auth-guestButton Link"
                onClick={() => {
                  onClose();

                  ReactGA.event({
                    category: 'Auth',
                    action: 'Continue as Guest'
                  });
                }}>
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
    } else if (otherProviders && otherProviders.length) {
      text = `Welcome back, ${usernameInput}!\nIt looks like you have previously used ${otherProviders.join(' and ')} to log in. Press back to do so again.`;
    } else if (accountIsDisabled) {
      text = 'This account has been disabled.';
    } else if (userdataIsLoading) {
      text = 'loading...';
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
