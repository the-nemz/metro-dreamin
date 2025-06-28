import React, { useContext, useState, useEffect } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import ReactGA from 'react-ga4';

import { FirebaseContext } from '/util/firebase.js';

import { Modal } from '/components/Modal.js';

export const EmailVerification = ({ open = false, onClose = () => {} }) => {
  const [isSending, setIsSending] = useState(false);
  const [hasSent, setHasSent] = useState(false);
  const [error, setError] = useState('');

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    if (!open) {
      setHasSent(false);
      setError('');
    }
  }, [open]);

  if (!firebaseContext.auth || !firebaseContext.user) return;

  const handleSendVerification = async () => {
    if (!firebaseContext.user) return;

    try {
      setIsSending(true);
      setError('');
      await sendEmailVerification(firebaseContext.user);
      setHasSent(true);

      ReactGA.event({
        category: 'Auth',
        action: 'Send Email Verification'
      });
    } catch (error) {
      console.error('sendEmailVerification error:', error);

      let errorMessage = 'Failed to send verification email. Please try again.';
      if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many verification emails sent. Please try again later.';
      }

      setError(errorMessage);

      ReactGA.event({
        category: 'Auth',
        action: 'Send Email Verification Failed'
      });
    } finally {
      setIsSending(false);
    }
  };

  const renderContent = () => {
    if (hasSent) {
      return (
        <div className="EmailVerification-content">
          <div className="EmailVerification-description">
            Verification email sent! Please check your inbox and click the verification link. If you don't see it, check your spam folder.
          </div>

          <button className="EmailVerification-closeButton Button--primary"
                  onClick={onClose}>
            Close
          </button>
        </div>
      );
    }

    return (
      <div className="EmailVerification-content">
        <div className="EmailVerification-description">
          Verify your email address to unlock features like commenting, branching, and more.
        </div>

        {error && <div className="EmailVerification-error">{error}</div>}

        <button className="EmailVerification-sendButton Button--primary"
                disabled={isSending}
                onClick={handleSendVerification}>
          {isSending ? 'Sending...' : 'Send Verification Email'}
        </button>

        <button className="EmailVerification-cancelButton Link"
                onClick={onClose}>
          Cancel
        </button>
      </div>
    );
  };

  return (
    <Modal animKey='emailVerification'
           baseClass='EmailVerification'
           open={open}
           heading='Verify Email'
           content={renderContent()}
           onClose={onClose} />
  );
};
