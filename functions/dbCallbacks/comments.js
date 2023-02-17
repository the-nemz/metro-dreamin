const admin = require('firebase-admin');
const FieldValue = require('firebase-admin').firestore.FieldValue;

const { addNotification } = require('../src/notifications.js');

const incrementCommentsCount = (commentSnap, context) => {
  const commentData = commentSnap.data();
  const systemDoc = admin.firestore().doc(`systems/${context.params.systemId}`);
  systemDoc.get().then((systemSnap) => {
    if (systemSnap.exists) {
      const systemData = systemSnap.data();

      if (commentData.userId !== systemData.userId) {
        const commenterDoc = admin.firestore().doc(`users/${commentData.userId}`);
        commenterDoc.get().then((commenterSnap) => {
          if (commenterSnap.exists) {
            const commentNotif = getCommentNotif(commenterSnap.data(), systemData, commentData);
            addNotification(systemData.userId, commentNotif);
          }
        });
      }

      admin.firestore().doc(`systems/${context.params.systemId}`).update({
        commentsCount: FieldValue.increment(1)
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

function getCommentNotif(commenterData, systemData, commentData) {
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

  return {
    type: 'comment',
    destination: `/edit/${systemData.systemId}`,
    image: 'comment',
    content: {
      text: '[[starrerName]] commented on your map [[mapTitle]]: "[[commentPreview]]"',
      replacements: {
        starrerName: {
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
          text: commentPreview
        }
      }
    }
  };
}

module.exports = { incrementCommentsCount, decrementCommentsCount };
