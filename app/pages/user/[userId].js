import React from 'react';

import { rankSystems } from '/lib/util.js';
import { getUserDocData, getSystemsByUser } from '/lib/firebase.js';

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
      const systemsByUser = (await getSystemsByUser(userId) ?? []).sort(rankSystems);
      const publicSystemsByUser = systemsByUser.filter(s => !s.isPrivate);

      if (!userDocData) {
        return { notFound: true };
      }

      return { props: { userDocData, publicSystemsByUser } };
    } catch (e) {
      console.log('Unexpected Error:', e);
      return { notFound: true };
    }
  }

  return { props: { notFound: true } };
}

export default function User({
                              userDocData = {},
                              publicSystemsByUser = [],
                              onToggleShowSettings = () => {},
                              onToggleShowAuth = () => {},
                              onToggleShowMission = () => {},
                            }) {

  return <Theme>
    <Metatags title={userDocData.displayName ? userDocData.displayName : 'Anon'} />
    <Header onToggleShowSettings={onToggleShowSettings} onToggleShowAuth={onToggleShowAuth} />
    <Drawer onToggleShowAuth={onToggleShowAuth} />

    <main className="User">
      <Profile userDocData={userDocData} publicSystemsByUser={publicSystemsByUser} />
    </main>

    <Footer onToggleShowMission={onToggleShowMission} />
  </Theme>;
}
