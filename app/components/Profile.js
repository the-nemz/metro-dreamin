import React, { useState, useEffect, useContext } from 'react';
import { doc, collectionGroup, query, where, orderBy, getDocs, getDoc } from 'firebase/firestore';
import ReactGA from 'react-ga';
import classNames from 'classnames';

import { COLOR_TO_FILTER, getUserIcon, getUserColor, getLuminance, getIconDropShadow } from '/lib/util.js';
import { FirebaseContext, updateUserDoc } from '/lib/firebase.js';

import { Description } from '/components/Description.js';
import { Modal } from '/components/Modal.js';
import { IconUpdate } from '/components/IconUpdate.js';
import { Result } from '/components/Result.js';
import { Title } from '/components/Title.js';

export function Profile({ userDocData = {}, publicSystemsByUser = [] }) {
  const firebaseContext = useContext(FirebaseContext);

  const [starredSystems, setStarredSystems] = useState();
  const [showStars, setShowStars] = useState(false);
  const [viewOnly, setViewOnly] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [showIconModal, setShowIconModal] = useState(false);
  const [updatedIcon, setUpdatedIcon] = useState();
  const [updatedName, setUpdatedName] = useState('');
  const [updatedBio, setUpdatedBio] = useState('');

  useEffect(() => {
    try {
      const starsQuery = query(collectionGroup(firebaseContext.database, 'stars'),
                               where('userId', '==', userDocData.userId));
      getDocs(starsQuery).then((starDocs) => {
        const promises = [];
        starDocs.forEach((starDoc) => {
          const sysDoc = doc(firebaseContext.database, `systems/${starDoc.data().systemId}`);
          promises.push(getDoc(sysDoc));
        });

        Promise.all(promises).then((systemDocs) => {
          let systemDatas = [];
          for (const systemDoc of systemDocs) {
            const systemDocData = systemDoc.data();
            if (!systemDocData.isPrivate) systemDatas.push(systemDoc.data());
          }
          setStarredSystems(systemDatas);
        });
      });
    } catch (e) {
      console.log('getUserStars error:', e);
    }
  }, [])

  useEffect(() => {
    if (!firebaseContext.authStateLoading) {
      if (userDocData.userId && firebaseContext.user && firebaseContext.user.uid && (userDocData.userId === firebaseContext.user.uid)) {
        setViewOnly(false);
      }
    }
  }, [firebaseContext.user, firebaseContext.authStateLoading]);

  const handleProfileUpdate = () => {
    if (firebaseContext.user && firebaseContext.user.uid && !viewOnly && editMode) {
      let updatedProperties = {};

      if (updatedName) {
        updatedProperties.displayName = updatedName;
      }

      if (updatedBio) {
        // strip leading and trailing newlines
        const strippedBio = updatedBio.replace(/^\n+/, '').replace(/\n+$/, '');
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
        category: 'Profile',
        action: 'Update'
      });
    }
  }

  const getPrettyCreationDate = () => {
    const creationDate = new Date(userDocData.creationDate);
    return creationDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); // ex "January 2023"
  }

  const renderBannerSystem = () => {
    if (!publicSystemsByUser.length) return;

    // since systems are ranked on the back end, simply select the first one
    return <div className="Profile-bannerSystem">
      <Result viewData={publicSystemsByUser[0]} isFeature={true} isOnProfile={true} key={publicSystemsByUser[0].systemId} />
    </div>;
  }

  const renderSystemPreview = (systemDocData) => {
    return <li className="Profile-systemPreview" key={systemDocData.systemId}>
      <Result viewData={systemDocData} isOnProfile={true} key={systemDocData.systemId} />
    </li>;
  }

  const renderStarPreview = (systemDocData) => {
    return <li className="Profile-systemPreview" key={systemDocData.systemId}>
      <Result viewData={systemDocData} key={systemDocData.systemId} />
    </li>;
  }

  const renderAllSystems = () => {
    if (!publicSystemsByUser.length) {
      return <div className={classNames('Profile-noSystems', { 'Profile-noSystems--hidden': showStars })}>
        None yet!
      </div>;
    };

    let systemElems = publicSystemsByUser.map(renderSystemPreview);

    return <ol className={classNames('Profile-systems', { 'Profile-systems--hidden': showStars })}>
      {systemElems}
    </ol>;
  }

  const renderStarredSystems = () => {
    if (!starredSystems) return;

    if (!starredSystems.length) {
      return <div className={classNames('Profile-noStars', { 'Profile-noStars--hidden': !showStars })}>
        None yet!
      </div>;
    };

    let systemElems = starredSystems.map(renderStarPreview);

    return <ol className={classNames('Profile-starredSystems', { 'Profile-starredSystems--hidden': !showStars })}>
      {systemElems}
    </ol>;
  }

  const renderTabs = () => {
    return (
      <div className="Profile-tabs">
        <button className={classNames('Profile-tab', 'Profile-tab--ownSystems', { 'Profile-tab--active': !showStars })}
                onClick={() => setShowStars(false)}>
          Maps
        </button>
        <button className={classNames('Profile-tab', 'Profile-tab--starredSystems', { 'Profile-tab--active': showStars })}
                onClick={() => setShowStars(true)}>
          Starred Maps
        </button>
      </div>
    );
  }

  const renderEditButtons = () => {
    const edit = <button className="Profile-button Profile-button--edit"
                         onClick={() => setEditMode(true)}>
      Edit
    </button>

    const cancel = <button className="Profile-button Profile-button--cancel"
                           onClick={() => {
                            setEditMode(false);
                            setShowIconModal(false);
                            setUpdatedName('');
                            setUpdatedBio('');
                            setUpdatedIcon(null);
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

  const renderIcon = () => {
    const userIcon = getUserIcon(updatedIcon ? { icon: updatedIcon } : userDocData);
    const userColor = getUserColor(updatedIcon ? { icon: updatedIcon } : userDocData);
    const userShadow = getIconDropShadow(getLuminance(userColor.color) > 128 ? 'dark' : 'light');

    if (editMode) {
      return <>
        <button className="Profile-icon"
                onClick={() => setShowIconModal(true)}>
          <img className="Profile-image" src={userIcon.path} alt={userIcon.icon.alt}
              style={{ filter: `${userColor.filter} ${userShadow}` }} />
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
        <img className="Profile-image" src={userIcon.path}
            style={{ filter: `${userColor.filter} ${userShadow}` }} />
      </div>
    );
  }

  const renderLead = () => {
    return (
      <div className="Profile-lead">
        <div className="Profile-core">
          {renderIcon()}
          <div className="Profile-titleRow">
            <Title title={updatedName ? updatedName : userDocData.displayName}
                  viewOnly={viewOnly || !editMode}
                  fallback={'Anon'} placeholder={'Username'}
                  onGetTitle={(displayName) => setUpdatedName(displayName)} />
            <div className="Profile-joinedDate">
              joined {getPrettyCreationDate()}
            </div>
          </div>
        </div>

        {!viewOnly && renderEditButtons()}

        <div className="Profile-bio">
          <Description description={updatedBio ? updatedBio : (userDocData.bio || '')}
                      viewOnly={viewOnly || !editMode}
                      fallback={'Hi! Welcome to my profile! 🚇💭'}
                      placeholder={'Add a bio...'}
                      onDescriptionChange={(bio) => setUpdatedBio(bio)} />
        </div>
      </div>
    );
  }

  return <div className="Profile">
    {renderBannerSystem()}
    {renderLead()}
    {renderTabs()}
    {renderAllSystems()}
    {renderStarredSystems()}
  </div>;
}
