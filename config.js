// =====================================================================
//  OPERATION VAULT — settings. This is the only file you need to edit.
// =====================================================================
window.OV_CONFIG = {

  // The 5-digit vault code. Players collect one digit per defence and see
  // the full code on the win screen. Change it whenever you like.
  vault: '73192',

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

  // School battle: players pick one of these when they start. Add, remove
  // or reorder freely. Each school gets its own colour on the big screen.
  schools: ['White Pines', 'Superior Heights', "St. Mary's College", 'CASS', 'W.C. Eaket S.S.', 'ELSS', 'Michipicoten High School', 'Korah'],

  // The "line to beat" on the big screen. Play a run yourself and put the
  // time here as 'm:ss'. Leave time empty ('') to hide it.
  instructor: { name: 'Instructor', time: '' },

  // Optional: the address the big-screen QR code should open.
  // Leave empty to use this site's own index.html automatically.
  playUrl: ''
};
