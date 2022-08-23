# Maintenance

### `addNotification.js`
Adds a notification to each user. Used for announcements of things like the Explore Page. Run `node addNotification.js --help` for instructions.

### `generateViews.js`
Generates view documents for all the systems in the Firestore database. Run `node generateViews.js --help` for instructions.

### `notifStructure.js`
A file to remember the structure of a notification and some sample data. When I eventually convert this project to typescript this would just be a type.

### `sampleNotification.json`
An example file used for `addNotification.js`. This one is for the announcement of the Explore Page.

### `views.js`
Pulls down view documents, filtered and sorted based on command line arguments. Run `node views.js --help` for instructions.
