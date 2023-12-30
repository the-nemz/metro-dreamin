import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { doc, deleteDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import ReactGA from 'react-ga4';

import { FirebaseContext, updateUserDoc } from '/lib/firebase.js';
import { renderFadeWrap, getUserDisplayName } from '/lib/util.js';

import { Modal } from 'components/Modal.js';
import { Prompt } from '/components/Prompt.js';
import { Toggle } from '/components/Toggle.js';
import { UserIcon } from '/components/UserIcon.js';

export function Settings(props) {
  const [usernameShown, setUsernameShown] = useState('');
  const [blocksShown, setBlocksShown] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState();
  const [unblockingUser, setUnblockingUser] = useState();
  const [dangerShown, setDangerShown] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const firebaseContext = useContext(FirebaseContext);

  const usernameChanged = (firebaseContext.settings.displayName || '') !== usernameShown;

  useEffect(() => {
    setUsernameShown(firebaseContext.settings.displayName ? firebaseContext.settings.displayName : 'Anon');
    setBlocksShown(false);
    setUnblockingUser(null);
    setDangerShown(false);
    setDeletingAccount(false);

    ReactGA.event({
      category: 'Settings',
      action: 'Open'
    });
  }, [props.open]);

  useEffect(() => {
    setUsernameShown(firebaseContext.settings.displayName ? firebaseContext.settings.displayName : 'Anon');
  }, [firebaseContext.settings.displayName]);

  useEffect(() => {
    if (!firebaseContext.user || !firebaseContext.user.uid) return;

    if (blocksShown) {
      const blockedUsersCol = collection(firebaseContext.database, `users/${firebaseContext.user.uid}/blocks`);
      const blockedUsersQuery = query(blockedUsersCol, orderBy('displayName', 'asc'));

      getDocs(blockedUsersQuery).then(blockedUsersSnapshot => {
        if (blockedUsersSnapshot.docs?.length) {
          setBlockedUsers((blockedUsersSnapshot.docs).map(buDoc => buDoc.data()));
          return;
        }
        setBlockedUsers([]);
      })
    }
  }, [blocksShown]);

  const handleUsernameChanged = (e) => {
    e.preventDefault();
    if (usernameChanged && usernameShown.trim() && firebaseContext.user && firebaseContext.user.uid) {
      let displayName = usernameShown.trim();
      if (displayName.length >= 2 && displayName[0] === '[' && displayName[displayName.length - 1] === ']') {
        displayName = `(${displayName.substring(1, displayName.length - 1)})`;
      }
      displayName = displayName ? displayName : 'Anon';
      updateUserDoc(firebaseContext.user.uid, { displayName });

      ReactGA.event({
        category: 'Settings',
        action: 'Display Name'
      });
    }
  }

  const handleToggleTheme = () => {
    if (firebaseContext.user && firebaseContext.user.uid) {
      const turnLightModeOn = firebaseContext.settings.lightMode ? false : true;

      updateUserDoc(firebaseContext.user.uid, { lightMode: turnLightModeOn });

      ReactGA.event({
        category: 'Settings',
        action: turnLightModeOn ? 'Light Mode On' : 'Dark Mode On'
      });
    }
  }

  const handleTogglePerformance = () => {
    if (firebaseContext.user && firebaseContext.user.uid) {
      const turnLowPerfOn = firebaseContext.settings.lowPerformance ? false : true;

      updateUserDoc(firebaseContext.user.uid, { lowPerformance: turnLowPerfOn });

      ReactGA.event({
        category: 'Settings',
        action: turnLowPerfOn ? 'Low Performance On' : 'High Performance On'
      });
    }
  }

  const handleUnblock = async (unblockUserId) => {
    if (!firebaseContext.user?.uid || !unblockUserId) return;

    try {
      const blockDoc = doc(firebaseContext.database, `users/${firebaseContext.user.uid}/blocks/${unblockUserId}`);
      await deleteDoc(blockDoc)

      setBlockedUsers(currBUs => currBUs.filter(bu => bu.blockedUserId && bu.blockedUserId !== unblockUserId));
      setUnblockingUser(null);

      ReactGA.event({
        category: 'Settings',
        action: 'Unblock'
      });
    } catch (e) {
      console.error('handleUnblock error:', e);
    }
  }

  const handleSignOut = () => {
    signOut(firebaseContext.auth);
    ReactGA.event({
      category: 'Auth',
      action: 'Signed Out'
    });
    window.location.reload();
  }

  const renderToggle = (classModifier, settingTitle, onClick, toggleTip, isOn, toggleText, settingTip = '') => {
    return (
      <div className={`Settings-setting Settings-setting--${classModifier}`}>
        <div className="Settings-settingTitle">
          {settingTitle}
          {settingTip ? <i className="far fa-question-circle"
                          data-tooltip-content={settingTip}>
                        </i>
                      : ''}
        </div>
        <Toggle onClick={onClick} tip={toggleTip} isOn={isOn} text={toggleText} />
      </div>
    );
  }

  const renderBlockedUsers = () => {
    if (!blockedUsers) {
      return <div className="Settings-blocksLoading">loading...</div>;
    } else if (blockedUsers.length) {
      return (
        <ul>
          {blockedUsers.map((buData) => {
            if (!buData.blockedUserId) return;

            return (
              <li className="Settings-blockedUser" key={buData.blockedUserId}>
                <div className="Settings-blockedUserInfo">
                  <UserIcon className="Settings-blockedUserIcon" userDocData={buData} />
                  <div className="Settings-blockedUserName">
                    {buData.displayName ? buData.displayName : 'Anon'}
                  </div>
                </div>

                <button className="Settings-unblock Link"
                        onClick={() => setUnblockingUser(buData)}>
                  Unblock
                </button>
              </li>
            );
          })}
        </ul>
      );
    } else {
      return <div className="Settings-noBlocks">No blocked users</div>;
    }
  }

  const renderBlocks = () => {
    return (
      <div className="Settings-setting Settings-setting--blocks">
        <button className={`Settings-blocks Settings-blocks--${blocksShown ? 'expanded' : 'collapsed'}`}
                onClick={() => {
                  setBlocksShown(curr => !curr);

                  ReactGA.event({
                    category: 'Settings',
                    action: 'Toggle Show Blocks'
                  });
                }}>
          <i className="fa fa-angle-down"></i>

          <div className="Settings-blocksText">
            {blocksShown ? 'Hide' : 'Show'} blocked users
          </div>
        </button>

        <div className={`Settings-blockedUsers Settings-blockedUsers--${blocksShown ? 'expanded' : 'collapsed'}`}>
          {renderBlockedUsers()}
        </div>
      </div>
    )
  }

  const renderDangerZone = () => {
    return (
      <div className="Settings-setting Settings-setting--dangerZone">
        <button className={`Settings-dangerZone Settings-dangerZone--${dangerShown ? 'expanded' : 'collapsed'}`}
                onClick={() => {
                  setDangerShown(curr => !curr);

                  ReactGA.event({
                    category: 'Settings',
                    action: 'Toggle Show Danger'
                  });
                }}>
          <i className="fa fa-angle-down"></i>

          <div className="Settings-dangerZoneText">
            {dangerShown ? 'Close' : 'Open'} danger zone
          </div>
        </button>

        <div className={`Settings-dangerousButtons Settings-dangerousButtons--${dangerShown ? 'expanded' : 'collapsed'}`}>
          <button className="Settings-deleteAccount Link--inverse"
                  onClick={() => {
                            setDeletingAccount(true);
                            ReactGA.event({
                              category: 'Settings',
                              action: 'Start Delete Account'
                            });
                          }}>
            Delete Account
          </button>
        </div>
      </div>
    )
  }

  const renderDeleteAccountPrompt = () => {
    if (!firebaseContext.user || !firebaseContext.user.uid) return;
    if (!deletingAccount) return;

    const userName = firebaseContext.settings?.displayName ? firebaseContext.settings.displayName : 'this user';
    const message = `Are you sure you want to delete the account associated with ${userName}? This action is irreversible.`;

    return <Prompt
      message={message}
      denyText={'Cancel.'}
      confirmText={'Yes, delete my account :('}
      denyFunc={() => setDeletingAccount(false)}
      confirmFunc={() => console.log('delete account')}
    />
  }

  const renderUnblockingPrompt = () => {
    if (!firebaseContext.user || !firebaseContext.user.uid) return;
    if (!unblockingUser || !unblockingUser?.blockedUserId) return;

    const userName = unblockingUser.displayName ? unblockingUser.displayName : 'this user';
    const message = `Are you sure you want to unblock ${userName}? They will be able to see your content and you will be able to see their content.`;

    return <Prompt
      message={message}
      denyText={'Cancel.'}
      confirmText={'Yes, unblock this user.'}
      denyFunc={() => setUnblockingUser(null)}
      confirmFunc={() => handleUnblock(unblockingUser.blockedUserId)}
    />
  }

  const nameElem = (
    <div className="Settings-setting Settings-setting--name">
      <div className="Settings-settingTitle">
        Username
      </div>
      <form className="Settings-username Settings-username--input" onSubmit={handleUsernameChanged}>
        <input className="Settings-usernameInput Settings-username--input" type="text" value={usernameShown}
              onChange={(e) => { setUsernameShown(e.target.value) }}
        />
        <button className="Settings-submitButton" type="submit" data-tooltip-content={usernameChanged ? 'Save username' : 'Username is saved'}>
          {usernameChanged ? <i className="far fa-save fa-fw"></i> : <i className="far fa-check-circle"></i>}
        </button>
      </form>
    </div>
  );

  const signUpElem = (
    <div className="Settings-setting Settings-setting--signIn">
      <div className="Settings-settingTitle">
        Hello, Anon
      </div>
      <Link className="Settings-signUp Button--primary" href={'/view'} target="_blank" rel="nofollow noopener noreferrer"
             onClick={() => ReactGA.event({ category: 'Settings', action: 'Sign In' })}>
        Sign in
      </Link>
    </div>
  );

  const signOutElem = (
    <div className="Settings-setting Settings-setting--signOut">
      <button className="Settings-signOut Link" onClick={handleSignOut}>
        Sign out
      </button>
    </div>
  );

  const renderContent = () => {
    return <>
      {firebaseContext.user ? nameElem : signUpElem}

      {renderToggle('theme',
                    'Theme',
                    handleToggleTheme,
                    firebaseContext.settings.lightMode ? 'Turn on Dark Mode' : 'Turn off Dark Mode',
                    firebaseContext.settings.lightMode ? false : true,
                    `Dark Mode ${firebaseContext.settings.lightMode ? 'Off' : 'On'}`)}

      {renderToggle('performance',
                    'Performance',
                    handleTogglePerformance,
                    firebaseContext.settings.lowPerformance ? 'Use High Performance' : 'Use Low Performance',
                    firebaseContext.settings.lowPerformance ? false : true,
                    `${firebaseContext.settings.lowPerformance ? 'Low Performance' : 'High Performance'}`,
                    'Toggle animations like the moving vehicles to improve performance on large maps or slow devices')}


      {firebaseContext.user && signOutElem}

      {firebaseContext.user && renderBlocks()}

      {firebaseContext.user && renderDangerZone()}

      {renderFadeWrap(renderUnblockingPrompt(), 'prompt')}
      {renderFadeWrap(renderDeleteAccountPrompt(), 'prompt')}
    </>;
  }

  return (
    <Modal animKey='settings' baseClass='Settings' open={props.open}
           heading={`Settings`} content={renderContent()} onClose={props.onClose} />
  );
}
