// =====================================================================
//  OPERATION VAULT — settings. This is the only file you need to edit.
// =====================================================================
window.OV_CONFIG = {

  // The 4-digit combination of your real padlock. Players collect these
  // digits during the game and are shown the combination when they win.
  vault: '7319',

  // Paste your Firebase web app config here (see README, step 2).
  // While apiKey still says PASTE_..., the game runs without a leaderboard.
  firebase: {
    apiKey: 'PASTE_API_KEY',
    authDomain: 'PASTE_PROJECT_ID.firebaseapp.com',
    projectId: 'PASTE_PROJECT_ID',
    storageBucket: 'PASTE_PROJECT_ID.appspot.com',
    messagingSenderId: 'PASTE_SENDER_ID',
    appId: 'PASTE_APP_ID'
  },

  // Optional: the address the big-screen QR code should open.
  // Leave empty to use this site's own index.html automatically.
  playUrl: ''
};
