import { NextApiRequest, NextApiResponse } from 'next';
import { collectionGroup, query, where, getDocs, doc, getDoc, limit } from 'firebase/firestore';

import { firestore } from 'lib/firebase.js';

interface QueryParams {
  email?: String
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  const { email }: QueryParams = request.query;

  if (request.method !== 'GET') {
    console.warn('Only GET requests are allowed');
    return response.status(400).json({ error: 'Only GET requests are allowed'});
  }

  if (!email) {
    console.warn('The query param `email` is required');
    return response.status(400).json({ error: 'The query param `email` is required'});
  }

  try {
    return response.status(200).json(await _performEmailQuery(email));
  } catch (error) {
    console.error('Error querying for email:', error);
    response.status(500).json({ error });
  }
}

async function _performEmailQuery(emailAddress: String) {
  const privatesQuery = query(collectionGroup(firestore, 'private'),
                              where('email', '==', emailAddress.toLowerCase()),
                              limit(1));

  const privatesSnapshot = await getDocs(privatesQuery);
  if (privatesSnapshot.size === 1) {
    const privateDocData = privatesSnapshot.docs[0].data();
    if (!privateDocData.userId) throw Error('Private doc has no userId');

    const userDoc = await getDoc(doc(firestore, `users/${privateDocData.userId}`));
    if (!userDoc.exists()) throw Error('User doc does not exist');

    const userDocData = userDoc.data();

    return {
      found: true,
      userData: userDocData
    };
  } else {
    return { found: false };
  }
}
