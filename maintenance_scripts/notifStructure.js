const timestamp = Date.now();

// Sample notification for a starring as it would apprear in Firestore
const sampleNotif = {
  timestamp: timestamp, // unique id and time of notification
  type: 'star', // system|star|comment|etc
  destination: '/views/...viewId...', // what url to go to when clicked
  viewed: false, // if user has viewed
  image: 'star', // what to display - useful for overrides
  content: {
    text: '[[starrerName]] just starred your map [[mapTitle]]! It now has [[countText]].',
    replacements: {
      starrerName: {
        text: 'temp_nemz',
        styles: [
          'italic'
        ]
      },
      mapTitle: {
        text: 'DC Metro',
        styles: [
          'bold',
          'big'
        ]
      },
      countText: {
        text: '1 star',
        styles: [
          'bold'
        ]
      }
    }
  }
}

let notifDoc = notifCollection.doc(`${timestamp}`);
await notifDoc.set(notif);
