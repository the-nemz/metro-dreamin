const admin = require('firebase-admin');

// Find user by email address
async function searchForUser(req, res) {

  const email = req.query.email;

  if (!email) {
    res.status(400).json({ error: 'Query param `email` is required' });
    return;
  }

  try {
    const userRecord = await admin.auth().getUserByEmail(email);

    if (!userRecord.uid) throw Error('UserRecord doc has no uid');

    const userDoc = admin.firestore().doc(`users/${userRecord.uid}`);
    const userDocData = await userDoc.get();
    if (!userDocData.exists) throw Error('User doc does not exist');

    res.status(200).json({
      userId: userRecord.uid,
      authRecord: userRecord,
      userDocData: userDocData.data()
    });
    return;
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      res.status(404).json({ error: 'User not found' });
      return;
    } else if (e.code === 'auth/invalid-email') {
      res.status(400).json({ error: 'Email address is malformed' });
      return;
    }

    console.error('searchForUser error:', e);
    res.status(500).json({ error: `SearchForUser error: ${e.message}` });
    return;
  }
}

module.exports = { searchForUser };
