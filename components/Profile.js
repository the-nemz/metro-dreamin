import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import { doc, collectionGroup, query, where, orderBy, getDocs, getDoc, setDoc, collection, limit } from 'firebase/firestore';
import ReactGA from 'react-ga4';
import classNames from 'classnames';

import { DeviceContext } from '/util/deviceContext.js';
import { usePaginatedQuery } from '/util/hooks.js';
import { FirebaseContext, updateUserDoc } from '/util/firebase.js';
import { getUserIcon, getUserColor, getLuminance, getIconDropShadow, renderFadeWrap, getUserDisplayName } from '/util/helpers.js';

import { Description } from '/components/Description.js';
import { IconUpdate } from '/components/IconUpdate.js';
import { Prompt } from '/components/Prompt.js';
import { Result } from '/components/Result.js';
import { Title } from '/components/Title.js';
import { Revenue } from './Revenue.js';
import { PaginatedSystems } from '/components/PaginatedSystems.js';

export function Profile({ viewOnly = true, userDocData = {} }) {
  const [featuredSystem, setFeaturedSystem] = useState();
  const [starredSystems, setStarredSystems] = useState();
  const [showStars, setShowStars] = useState(false);
  const [showBlockingPrompt, setShowBlockingPrompt] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showIconModal, setShowIconModal] = useState(false);
  const [updatedIcon, setUpdatedIcon] = useState();
  const [updatedName, setUpdatedName] = useState('');
  const [updatedBio, setUpdatedBio] = useState('');

  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);
  const { isMobile } = useContext(DeviceContext);

  if (!userDocData) return;

  const isSuspendedOrDeleted = userDocData.suspensionDate || userDocData.deletionDate;

  const { docDatas: stars, fetchMore: fetchStars, allLoaded, queryCompleted } = usePaginatedQuery({
    collection: collectionGroup(firebaseContext.database, 'stars'),
    clauses: [ where('userId', '==', userDocData.userId), orderBy('timestamp', 'desc') ],
    startSize: 9,
    pageSize: 3,
    execute: showStars,
  });

  useEffect(() => {
    if (!showStars) return;
    if (!stars?.length) return;

    const systemIdsFetched = new Set(starredSystems?.map(s => s.systemId) || []);
    const promises = [];
    stars.forEach((starData) => {
      if (systemIdsFetched.has(starData.systemId)) return;

      const sysDoc = doc(firebaseContext.database, `systems/${starData.systemId}`);
      promises.push(getDoc(sysDoc));
    });

    Promise.all(promises).then((systemDocs) => {
      let systemDatas = [];
      for (const systemDoc of systemDocs) {
        if (!systemDoc ||!systemDoc.exists()) continue;
        const systemDocData = systemDoc.data();
        if (systemDocData && !systemDocData.isPrivate) systemDatas.push(systemDoc.data());
      }
      setStarredSystems(cSDs => (cSDs || []).concat(systemDatas));
    });
  }, [ stars ]);

  useEffect(() => {
    if (featuredSystem) return;
    if (!userDocData.systemsCreated && !(userDocData.systemIds || []).length) return;

    const topStarPromise = getDocs(query(collection(firebaseContext.database, 'systems'),
                                         where('userId', '==', userDocData.userId),
                                         where('isPrivate', '==', false),
                                         orderBy('stars', 'desc'),
                                         limit(1)));
    const mostRecentPromise = getDocs(query(collection(firebaseContext.database, 'systems'),
                                            where('userId', '==', userDocData.userId),
                                            where('isPrivate', '==', false),
                                            orderBy('lastUpdated', 'desc'),
                                            limit(1)));

    Promise.all([ topStarPromise, mostRecentPromise ])
      .then(querySnaps => {
        for (const querySnap of querySnaps) {
          if (querySnap.size >= 1) {
            setFeaturedSystem(querySnap.docs[0].data())
            break;
          }
        }
      })
      .catch(e => console.log('Error getting featured system:', e));
  }, [ userDocData.systemsCreated, userDocData.systemIds ]);

  const handleProfileUpdate = () => {
    if (firebaseContext.user && firebaseContext.user.uid && !viewOnly && editMode) {
      let updatedProperties = {};

      let displayName = updatedName.trim().substring(0, 100);
      if (displayName.length >= 2 && displayName[0] === '[' && displayName[displayName.length - 1] === ']') {
        displayName = `(${displayName.substring(1, displayName.length - 1)})`;
      }
      if (displayName) {
        updatedProperties.displayName = displayName;
      }
      setUpdatedName(displayName);

      if (updatedBio) {
        // strip leading and trailing newlines
        const strippedBio = updatedBio.replace(/^\n+/, '').replace(/\n+$/, '').replace(/\n\n\n+/gm, '\n\n\n').substring(0, 5000);
        if (strippedBio) {
          updatedProperties.bio = strippedBio;
        }
        setUpdatedBio(strippedBio);
      }

      if (updatedIcon && updatedIcon.key && updatedIcon.color) {
        updatedProperties.icon = updatedIcon;
      }

      updateUserDoc(firebaseContext.user.uid, updatedProperties);
      setEditMode(false);

      ReactGA.event({
        category: 'User',
        action: 'Save Profile Update',
        label: Object.keys(updatedProperties).sort().join(', ')
      });
    }
  }

  const handleBlockUser = async () => {
    if (!firebaseContext.user || !firebaseContext.user.uid || !userDocData.userId || userDocData.isAdmin || userDocData.deletionDate) return;

    setShowBlockingPrompt(false);

    const blockDoc = doc(firebaseContext.database, `users/${firebaseContext.user.uid}/blocks/${userDocData.userId}`);
    const userIcon = getUserIcon(userDocData);
    const userColor = getUserColor(userDocData);

    try {
      await setDoc(blockDoc, {
        blockerId: firebaseContext.user.uid,
        blockedUserId: userDocData.userId,
        displayName: userDocData.displayName ? userDocData.displayName : 'Anonymous',
        icon: {
          key: userIcon.icon.key,
          color: userColor.color
        },
        timestamp: Date.now()
      });
      router.push('/explore');

      ReactGA.event({
        category: 'User',
        action: 'Block'
      });
    } catch (e) {
      console.error('handleBlockUser user:', e);
    }
  }

  const getPrettyCreationDate = () => {
    const creationDate = new Date(userDocData.creationDate);
    return creationDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); // ex "January 2023"
  }

  const renderBannerSystem = () => {
    if (!featuredSystem) return;

    // since systems are ranked on the back end, simply select the first one
    return <div className="Profile-bannerSystem">
      <Result viewData={featuredSystem} types={['profile', 'feature']} key={featuredSystem.systemId} />
    </div>;
  }

  const renderStarPreview = (systemDocData) => {
    return <li className="Profile-systemPreview" key={systemDocData.systemId}>
      <Result viewData={systemDocData} types={['userStar']} key={systemDocData.systemId} />
    </li>;
  }

  const renderAllSystems = () => {
    return <div className={classNames('Profile-systems', { 'Profile-systems--hidden': showStars })}>
      <PaginatedSystems collectionPath={'systems'} type={[ 'profile', 'recent' ]} startSize={9}
                        clauses={[
                          where('userId', '==', userDocData.userId),
                          where('isPrivate', '==', false),
                          orderBy('lastUpdated', 'desc')
                        ]} />
    </div>;
  }

  const renderStarredSystems = () => {
    if (!starredSystems) {
      return <div className={classNames('Profile-noStars', { 'Profile-noStars--hidden': !showStars })}>
        Loading...
      </div>;
    };

    if (!starredSystems.length) {
      return <div className={classNames('Profile-noStars', { 'Profile-noStars--hidden': !showStars })}>
        None yet!
      </div>;
    };

    let systemElems = starredSystems.map(renderStarPreview);

    return <div className={classNames('Profile-starredSystems', { 'Profile-starredSystems--hidden': !showStars })}>
      <ol className="Profile-starredSystemsList">
        {systemElems}
      </ol>

      {queryCompleted && !allLoaded && (
        <button className="Profile-showMore" onClick={fetchStars}>
          <i className="fas fa-chevron-circle-down"></i>
          <span className="Profile-moreText">Show more</span>
        </button>
      )}
    </div>;
  }

  const renderTabs = () => {
    return (
      <div className="Profile-tabs">
        <button className={classNames('Profile-tab', 'Profile-tab--ownSystems', { 'Profile-tab--active': !showStars })}
                onClick={() => {
                  setShowStars(false);

                  ReactGA.event({
                    category: 'User',
                    action: 'Show Own Maps',
                    label: viewOnly ? 'Other' : 'Self'
                  });
                }}>
          Maps
        </button>
        <button className={classNames('Profile-tab', 'Profile-tab--starredSystems', { 'Profile-tab--active': showStars })}
                onClick={() => {
                  setShowStars(true);

                  ReactGA.event({
                    category: 'User',
                    action: 'Show Starred Maps',
                    label: viewOnly ? 'Other' : 'Self'
                  });
                }}>
          Starred Maps
        </button>
      </div>
    );
  }

  const renderEditButtons = () => {
    const edit = <button className="Profile-button Profile-button--edit"
                         onClick={() => {
                          setEditMode(true);

                          ReactGA.event({
                            category: 'User',
                            action: 'Start Profile Update'
                          });
                        }}>
      Edit
    </button>

    const cancel = <button className="Profile-button Profile-button--cancel"
                           onClick={() => {
                            setEditMode(false);
                            setShowIconModal(false);
                            setUpdatedName('');
                            setUpdatedBio('');
                            setUpdatedIcon(null);

                            ReactGA.event({
                              category: 'User',
                              action: 'Cancel Profile Update'
                            });
                           }}>
      Cancel
    </button>;

    const save = <button className="Profile-button Profile-button--save"
                         onClick={handleProfileUpdate}>
      Save
    </button>;

    return (
      <div className="Profile-editButtons">
        {!editMode && edit}
        {editMode && cancel}
        {editMode && save}
      </div>
    );
  }

  const renderBlockButton = () => {
    return (
      <div className="Profile-blockWrapper">
        <button className="Profile-blockButton ViewHeaderButton"
                data-tooltip-content="Block this user"
                onClick={() => setShowBlockingPrompt(true)}>
          <i className="fas fa-user-slash"></i>
        </button>
      </div>
    );
  }

  const renderBadges = () => {
    let badges = [];
    if (userDocData.isAdmin) {
      badges.push(
        <li className="Profile-badge Profile-badge--admin"
            key="admin"
            data-tooltip-content="MetroDreamin' Administrator">
          <i className="fas fa-shield-halved"></i>
        </li>
      );
    }

    if (badges.length) {
      return <ul className="Profile-badges">
        {badges}
      </ul>
    }
  }

  const renderBlockingPrompt = () => {
    if (!firebaseContext.user || !firebaseContext.user.uid || userDocData?.deletionDate) return;

    const userName = userDocData.displayName ? userDocData.displayName : 'this user';
    const message = `Are you sure you want to block ${userName}? You will no longer see their content and they will not see your content.`;

    if (showBlockingPrompt) {
      return <Prompt
        message={message}
        denyText={'Cancel.'}
        confirmText={'Yes, block this user.'}
        denyFunc={() => setShowBlockingPrompt(false)}
        confirmFunc={handleBlockUser}
      />
    }
  }

  const renderIcon = () => {
    const userIcon = getUserIcon(updatedIcon ? { icon: updatedIcon } : userDocData);
    const userColor = getUserColor(updatedIcon ? { icon: updatedIcon } : userDocData);
    const userShadow = getIconDropShadow(getLuminance(userColor.color) > 128 ? 'dark' : 'light');

    if (editMode) {
      return <>
        <button className="Profile-icon Profile-icon--edit"
                onClick={() => {
                  setShowIconModal(true);

                  ReactGA.event({
                    category: 'User',
                    action: 'Show Icon Modal'
                  });
                }}>
          <img className="Profile-image" src={userIcon.path} alt={userIcon.icon.alt}
              style={{ filter: `${userColor.filter} ${userShadow}` }} />
          <i className="fas fa-pen"></i>
        </button>

        <IconUpdate open={showIconModal} currColor={userColor} currShadow={userShadow}
                    onClose={() => setShowIconModal(false)}
                    onComboSelected={(newIcon) => {
                      if (newIcon && newIcon.key && newIcon.color) {
                        setUpdatedIcon(newIcon);
                      }
                      setShowIconModal(false);
                    }} />
      </>;
    }

    return (
      <div className="Profile-icon">
        <img className="Profile-image" src={userIcon.path} alt={userIcon.icon.alt}
            style={{ filter: `${userColor.filter} ${userShadow}` }} />
      </div>
    );
  }

  const renderBio = () => {
    if (userDocData.deletionDate) return;

    const bio = userDocData.suspensionDate ? 'This account has been suspended for violating the MetroDreamin\' Code of Conduct.' : (userDocData.bio || '');

    return (
      <div className="Profile-bio">
        <Description description={updatedBio ? updatedBio : bio}
                     viewOnly={viewOnly || !editMode}
                     fallback={'Hi! Welcome to my profile! 🚇💭'}
                     placeholder={'Add a bio...'}
                     onDescriptionChange={(bio) => setUpdatedBio(bio)} />
      </div>
    );
  }

  const renderLead = () => {
    const showBlockButton = viewOnly && !userDocData.isAdmin && !userDocData.deletionDate &&
                            !firebaseContext.authStateLoading && firebaseContext.user;

    return (
      <div className="Profile-lead">
        <div className="Profile-core">
          {renderIcon()}

          <div className="Profile-innerCore">
            <div className="Profile-titleRow">
              <Title title={updatedName ? updatedName : getUserDisplayName(userDocData)}
                    viewOnly={viewOnly || !editMode} textWrap={true}
                    fallback={'Anonymous'} placeholder={'Username'}
                    onGetTitle={(displayName) => setUpdatedName(displayName)} />

              {!editMode && renderBadges()}
            </div>

            {!userDocData.deletionDate && (
              <div className="Profile-joinedDate">
                joined {getPrettyCreationDate()}
              </div>
            )}
          </div>
        </div>

        {!viewOnly && renderEditButtons()}
        {showBlockButton && renderBlockButton()}
        {renderBio()}
      </div>
    );
  }

  return <div className="Profile">
    {!isSuspendedOrDeleted && renderBannerSystem()}
    <div className="Profile-main">
      <div className="Profile-content">
        {renderLead()}
        {!isSuspendedOrDeleted && renderTabs()}
        {!isSuspendedOrDeleted && renderAllSystems()}
        {!isSuspendedOrDeleted && renderStarredSystems()}
      </div>

      {isMobile === true && <Revenue unitName="profileMobile" />}
      {isMobile === false && <Revenue unitName="profileDesktop" />}
    </div>
    {renderFadeWrap(renderBlockingPrompt(), 'prompt')}
  </div>;
}
