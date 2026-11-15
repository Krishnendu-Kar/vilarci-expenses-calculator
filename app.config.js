// app.json is the app's config. This only adds what lives outside git or
// may be missing: Firebase's google-services.json (push notifications,
// notification.md). Without it the app builds as before, just without pushes.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const firebase = path.join(__dirname, 'google-services.json');
  return {
    ...config,
    android: {
      ...config.android,
      ...(fs.existsSync(firebase) ? { googleServicesFile: './google-services.json' } : {}),
    },
  };
};
