import React, { useContext } from 'react';
import ReactTooltip from 'react-tooltip';

import { rankSystems } from '/lib/util.js';
import { FirebaseContext, getUserDocData, getSystemsByUser } from '/lib/firebase.js';

import { Drawer } from '/components/Drawer.js';
import { Header } from '/components/Header.js';
import { Footer } from '/components/Footer.js';
import { Metatags } from '/components/Metatags.js';
import { Theme } from '/components/Theme.js';

import { Profile } from '/components/Profile.js';

export async function getServerSideProps({ params }) {
  const { userId } = params;

  if (userId) {
    try {
      const userDocData = await getUserDocData(userId) ?? null;
      const publicSystemsByUser = (await getSystemsByUser(userId) ?? [])
                                    .filter(s => !s.isPrivate)
                                    .sort(rankSystems);

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
                            }) {

  const firebaseContext = useContext(FirebaseContext);

  return <Theme>
    <Metatags title={userDocData.displayName ? userDocData.displayName : 'Anon'} />
    <Header onToggleShowSettings={onToggleShowSettings} onToggleShowAuth={onToggleShowAuth} />
    <Drawer onToggleShowAuth={onToggleShowAuth} />

    <main className="User">
      <Profile userDocData={userDocData} publicSystemsByUser={publicSystemsByUser} />
    </main>

    {!firebaseContext.authStateLoading && <ReactTooltip delayShow={400} border={true} type={firebaseContext.settings.lightMode ? 'light' : 'dark'} />}
    <Footer onToggleShowMission={onToggleShowMission} />
  </Theme>;
}
