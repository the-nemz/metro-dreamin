import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/router';
import ReactGA from 'react-ga4';
import ReactTooltip from 'react-tooltip';

import { FirebaseContext, getUserDocData, getSystemsByUser } from '/lib/firebase.js';

import { Drawer } from '/components/Drawer.js';
import { Footer } from '/components/Footer.js';
import { Header } from '/components/Header.js';
import { Metatags } from '/components/Metatags.js';
import { Profile } from '/components/Profile.js';
import { Theme } from '/components/Theme.js';

export async function getServerSideProps({ params }) {
  const { userId } = params;

  if (userId) {
    try {
      const userDocData = await getUserDocData(userId) ?? null;
      const publicSystemsByUser = (await getSystemsByUser(userId) ?? []).filter(s => !s.isPrivate);

      if (!userDocData) {
        return { notFound: true };
      }

      return { props: { userDocData, publicSystemsByUser } };
    } catch (e) {
      console.log('user/[userId] error:', e);
      return { notFound: true };
    }
  }

  return { notFound: true };
}

export default function User({
                              userDocData = {},
                              publicSystemsByUser = [],
                              onToggleShowSettings = () => {},
                              onToggleShowAuth = () => {},
                              onToggleShowMission = () => {},
                              onToggleShowContribute = () => {},
                            }) {

  const [viewOnly, setViewOnly] = useState(true);

  const router = useRouter();
  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    if (!firebaseContext.authStateLoading) {
      if (userDocData.userId && firebaseContext.user && firebaseContext.user.uid && (userDocData.userId === firebaseContext.user.uid)) {
        setViewOnly(false);
      }
    }

    ReactTooltip.rebuild();
  }, [firebaseContext.user, firebaseContext.authStateLoading]);

  useEffect(() => {
    if (firebaseContext.checkBidirectionalBlocks(userDocData.userId)) {
      // user is blocked; go home
      router.replace('/explore');

      ReactGA.event({
        category: 'User',
        action: 'Redirect to Explore'
      });
    }
  }, [firebaseContext.checkBidirectionalBlocks]);

  return <Theme>
    <Metatags title={userDocData.displayName ? userDocData.displayName : 'Anon'} />
    <Header onToggleShowSettings={onToggleShowSettings} onToggleShowAuth={onToggleShowAuth} />
    <Drawer onToggleShowAuth={onToggleShowAuth} />

    <main className="User">
      <Profile viewOnly={viewOnly} userDocData={userDocData} publicSystemsByUser={publicSystemsByUser} />
    </main>

    {!firebaseContext.authStateLoading && <ReactTooltip delayShow={400} border={true} type={firebaseContext.settings.lightMode ? 'light' : 'dark'} />}
    <Footer onToggleShowMission={onToggleShowMission} onToggleShowContribute={onToggleShowContribute} />
  </Theme>;
}
