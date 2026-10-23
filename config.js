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
   apiKey: "AIzaSyCB8qz9ejviOx4tXY03OzP4W0hpOavaMUU",
  authDomain: "operation-vault.firebaseapp.com",
  projectId: "operation-vault",
  storageBucket: "operation-vault.firebasestorage.app",
  messagingSenderId: "18731280819",
  appId: "1:18731280819:web:957e2f1ee168b4376503c6"
  },

  // Name of the event you're at. It's saved with every "send me program
  // info" sign-up so recruitment can tell events apart in the export.
  // Change it before each event, e.g. 'Fall Open House 2026'.
  event: 'Booth',

  // Optional: the address the big-screen QR code should open.
  // Leave empty to use this site's own index.html automatically.
  playUrl: ''
};
