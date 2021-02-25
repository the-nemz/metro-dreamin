// Sample view query
const viewDocs = await database.collection('views').where('isPrivate', '==', false).where('keywords', 'array-contains-any', ['los', 'angeles']).get();
viewDocs.forEach((viewDoc) => {
  const viewData = viewDoc.data();
  if (viewData) {
    console.log(viewData);
  }
});
