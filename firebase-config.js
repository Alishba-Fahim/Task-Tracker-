const firebaseConfig = {
  apiKey: "AIzaSyAD_2LyR9PuZFFY52EPPIWixpSfLlZURXA",
  authDomain: "task-manager-ba84e.firebaseapp.com",
  projectId: "task-manager-ba84e",
  storageBucket: "task-manager-ba84e.firebasestorage.app",
  messagingSenderId: "307849470751",
  appId: "1:307849470751:web:23571ee43cbde4d4aa462a"
};

  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);

  // Export auth and firestore
  const auth = firebase.auth();
  const db = firebase.firestore();