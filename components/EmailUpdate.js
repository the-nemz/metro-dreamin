import React, { useContext, useEffect, useState } from 'react';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail
} from 'firebase/auth';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import ReactGA from 'react-ga4';

import { FirebaseContext } from '/util/firebase.js';

import { Modal } from '/components/Modal.js';

export const EmailUpdate = ({ open = false, onClose = () => {}, onToggleShowEmailVerification = () => {} }) => {
  const [currentEmail, setCurrentEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [currentEmailIsValid, setCurrentEmailIsValid] = useState(false);
  const [newEmailIsValid, setNewEmailIsValid] = useState(false);
  const [passwordIsVisible, setPasswordIsVisible] = useState(false);
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('reauthenticate'); // 'reauthenticate' or 'update'

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    setCurrentEmail('');
    setCurrentPassword('');
    setNewEmail('');
    setCurrentEmailIsValid(false);
    setNewEmailIsValid(false);
    setPasswordIsVisible(false);
    setIsReauthenticating(false);
    setIsUpdating(false);
    setError('');
    setStep('reauthenticate');
  }, [open]);

  useEffect(() => {
    // validates that there is an @ and a TLD with >= 2 characters
    setCurrentEmailIsValid(/^.+@.+\..{2,}$/.test(currentEmail));
  }, [currentEmail]);

  useEffect(() => {
    // validates that there is an @ and a TLD with >= 2 characters
    setNewEmailIsValid(/^.+@.+\..{2,}$/.test(newEmail));
  }, [newEmail]);

  if (!firebaseContext.auth || !firebaseContext.user) {
    return null;
  }

  const hasPasswordAuth = firebaseContext.user.providerData?.find(
    pData => (pData?.providerId ?? '') === 'password'
  );

  // if user doesn't have password auth, show empty modal with message
  if (!hasPasswordAuth) {
    const renderEmptyContent = () => {
      return (
        <div className="EmailUpdate-content">
          <div className="EmailUpdate-description">
            Email address updates are only available for accounts that use email and password authentication.
            <br /><br />
            If you signed up with Google or another provider, you'll need to update your email through that service.
          </div>
        </div>
      );
    };

    return (
      <Modal animKey='emailUpdate' baseClass='EmailUpdate' open={open}
             heading="Update Email Address" content={renderEmptyContent()} onClose={onClose} />
    );
  }

  const handleReauthenticate = async (event) => {
    event.preventDefault();

    if (!currentEmailIsValid || !currentPassword) return;

    try {
      setIsReauthenticating(true);
      setError('');

      const credential = EmailAuthProvider.credential(currentEmail, currentPassword);
      await reauthenticateWithCredential(firebaseContext.user, credential);

      setStep('update');

      ReactGA.event({
        category: 'Auth',
        action: 'Reauthenticate for Email Update'
      });
    } catch (error) {
      console.error('reauthenticateWithCredential error:', error);
      setError('Invalid email or password. Please try again.');

      ReactGA.event({
        category: 'Auth',
        action: 'Reauthentication Failed'
      });
    } finally {
      setIsReauthenticating(false);
    }
  };

  const handleUpdateEmail = async (event) => {
    event.preventDefault();

    if (!newEmailIsValid) return;

    try {
      setIsUpdating(true);
      setError('');

      await updateEmail(firebaseContext.user, newEmail);
      await handleUpdatePrivateDoc(newEmail);

      onClose();
      onToggleShowEmailVerification(true);

      ReactGA.event({
        category: 'Auth',
        action: 'Update Email Success'
      });
    } catch (error) {
      console.error('updateEmail error:', error);
      setError('Failed to update email. Please try again.');

      ReactGA.event({
        category: 'Auth',
        action: 'Update Email Failed'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePrivateDoc = async (newEmail) => {
    const privateDoc = doc(firebaseContext.database, `users/${firebaseContext.user.uid}/private/info`);
    const privateDocSnap = await getDoc(privateDoc);

    if (privateDocSnap.exists()) {
      // document exists, update it
      const currentData = privateDocSnap.data();
      const existingEmail = currentData.email || '';
      const previousEmails = currentData.previousEmails || [];

      // add current email to previousEmails if it's different and not already in the list
      const updatedPreviousEmails = existingEmail && existingEmail !== newEmail.toLowerCase() && !previousEmails.includes(existingEmail)
        ? [...previousEmails, existingEmail]
        : previousEmails;

      await updateDoc(privateDoc, {
        email: newEmail.toLowerCase(),
        previousEmails: updatedPreviousEmails
      });
    } else {
      // document doesn't exist, create it
      await setDoc(privateDoc, {
        email: newEmail.toLowerCase(),
        userId: firebaseContext.user.uid
      });
    }
  }

  const renderPasswordInput = () => {
    return (
      <div className="EmailUpdate-passwordWrap">
        <input className="EmailUpdate-input EmailUpdate-input--email EmailUpdate-input--hidden"
               value={currentEmail} type={'text'} autoFocus />
        <input className="EmailUpdate-input EmailUpdate-input--password"
               value={currentPassword} placeholder="Password"
               type={passwordIsVisible ? 'text' : 'password'}
               onChange={(e) => setCurrentPassword(e.target.value)} />
        <button className="EmailUpdate-toggleShowPassword"
                data-password-visible={passwordIsVisible} type="button"
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
      </div>
    );
  };

  const renderSubmitButton = (text, disabled) => {
    return (
      <button className="EmailUpdate-submitButton Button--primary" type="submit" disabled={disabled}>
        {text}
      </button>
    );
  };

  const renderReauthenticateForm = () => {
    return (
      <form className="EmailUpdate-form" onSubmit={handleReauthenticate}>
        <div className="EmailUpdate-description">
          Please enter your current email and password to continue.
        </div>

        <input className="EmailUpdate-input EmailUpdate-input--email"
               data-valid={!currentEmail || currentEmailIsValid}
               value={currentEmail}
               type="email" placeholder="Current Email"
               readOnly={isReauthenticating} autoFocus
               onChange={(e) => setCurrentEmail(e.target.value)} />

        {renderPasswordInput()}

        {error && <div className="EmailUpdate-error">{error}</div>}

        {renderSubmitButton('Continue', !currentEmailIsValid || !currentPassword || isReauthenticating)}
      </form>
    );
  };

  const renderUpdateForm = () => {
    return (
      <form className="EmailUpdate-form" onSubmit={handleUpdateEmail}>
        <div className="EmailUpdate-description">
          Enter your new email address.
        </div>

        <input className="EmailUpdate-input EmailUpdate-input--email"
               data-valid={!newEmail || newEmailIsValid}
               value={newEmail}
               type="email" placeholder="New Email"
               readOnly={isUpdating} autoFocus
               onChange={(e) => setNewEmail(e.target.value)} />

        {error && <div className="EmailUpdate-error">{error}</div>}

        {renderSubmitButton('Update Email', !newEmailIsValid || isUpdating)}
      </form>
    );
  };

  const renderContent = () => {
    return (
      <div className="EmailUpdate-formWrapper">
        {step === 'reauthenticate' ? renderReauthenticateForm() : renderUpdateForm()}
      </div>
    );
  };

  return (
    <Modal animKey='emailUpdate' baseClass='EmailUpdate' open={open}
           heading="Update Email Address" content={renderContent()} onClose={onClose} />
  );
};
