const admin = require('firebase-admin');
const FieldValue = require('firebase-admin').firestore.FieldValue;

const { addNotification } = require('../src/notifications.js');

const incrementCommentsCount = (commentSnap, context) => {
  const commentData = commentSnap.data();
  const systemDoc = admin.firestore().doc(`systems/${context.params.systemId}`);
  systemDoc.get().then((systemSnap) => {
    if (systemSnap.exists) {
      const systemData = systemSnap.data();

      admin.firestore().doc(`systems/${context.params.systemId}`).update({
        commentsCount: FieldValue.increment(1)
      });

      const commenterDoc = admin.firestore().doc(`users/${commentData.userId}`);
      commenterDoc.get().then((commenterSnap) => {
        if (commenterSnap.exists) {
          sendCommentNotifications(commenterSnap.data(), systemData, commentData);
        }
      });
    }
  });
}

const decrementCommentsCount = (snap, context) => {
  const systemDoc = admin.firestore().doc(`systems/${context.params.systemId}`);
  systemDoc.get().then((systemSnap) => {
    if (systemSnap.exists && systemSnap.data().commentsCount) {
      admin.firestore().doc(`systems/${context.params.systemId}`).update({
        commentsCount: FieldValue.increment(-1)
      });
    }
  });
}

const sendCommentNotifications = async (commenterData, systemData, commentData) => {
  if (systemData.userId !== commentData.userId) {
    const commentNotif = getCommentNotif(commenterData, systemData, commentData);
    addNotification(systemData.userId, commentNotif);
  }

  let userIdsHandled = new Set([ systemData.userId, commentData.userId ]);
  const alsoCommentNotif = getAlsoCommentNotif(commenterData, systemData, commentData);
  const commentsSnap = await admin.firestore().collection(`systems/${systemData.systemId}/comments`).get();
  commentsSnap.forEach((alsoCommentDoc) => {
    const alsoCommentData = alsoCommentDoc.data();
    if (!userIdsHandled.has(alsoCommentData.userId)) {
      addNotification(alsoCommentData.userId, alsoCommentNotif);
      userIdsHandled.add(alsoCommentData.userId);
    }
  });
}

const getCommentNotif = (commenterData, systemData, commentData) => {
  return {
    type: 'comment',
    destination: `/edit/${systemData.systemId}`,
    image: 'comment',
    content: {
      text: '[[commenterName]] commented on your map [[mapTitle]]: "[[commentPreview]]"',
      replacements: {
        commenterName: {
          text: commenterData.displayName ? commenterData.displayName : 'Anon',
          styles: [
            'italic'
          ]
        },
        mapTitle: {
          text: systemData.title ? systemData.title : 'Untitled',
          styles: [
            'bold',
            'big'
          ]
        },
        commentPreview: {
          text: getCommentPreview(commentData)
        }
      }
    }
  };
}

// generate notifications for other people (not owner) who have commented on the map
const getAlsoCommentNotif = (commenterData, systemData, commentData) => {
  return {
    type: 'comment',
    destination: `/view/${systemData.systemId}`,
    image: 'comment',
    content: {
      text: '[[commenterName]] also commented on [[mapTitle]]: "[[commentPreview]]"',
      replacements: {
        commenterName: {
          text: commenterData.displayName ? commenterData.displayName : 'Anon',
          styles: [
            'italic'
          ]
        },
        mapTitle: {
          text: systemData.title ? systemData.title : 'Untitled',
          styles: [
            'bold',
            'big'
          ]
        },
        commentPreview: {
          text: getCommentPreview(commentData)
        }
      }
    }
  };
}

const getCommentPreview = (commentData = {}) => {
  const maxChars = 80;
  const commentWords = (commentData.content || '').split(/\s/).filter(w => w.length > 0); // split on any whitespace and remove empty strings

  // append individual words to preview until we reach maxChars
  let commentPreview = '';
  for (const [ind, word] of commentWords.entries()) {
    if (ind === 0 && word.length > maxChars) {
      // if first word is super long, just take a substring
      commentPreview = word.substr(0, maxChars);
    } else if (commentPreview.length + word.length + 1 < maxChars) {
      commentPreview += `${ind !== 0 ? ' ' : ''}${word}`;
    } else {
      break;
    }
  }

  // if number of words in preview is less than number of words in original comment, add ellipsis
  if (commentPreview.split(/\s/).length < commentWords.length) {
    commentPreview += '…';
  }

  return commentPreview;
}

module.exports = { incrementCommentsCount, decrementCommentsCount };
