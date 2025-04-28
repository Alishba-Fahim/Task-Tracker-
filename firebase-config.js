const firebaseConfig = {
  apiKey: "AIzaSyADWnxZmPcpU1C7lR8wOHWhVRGjSKUaGiY",
  authDomain: "fir-project-f6c83.firebaseapp.com",
  projectId: "fir-project-f6c83",
  storageBucket: "fir-project-f6c83.firebasestorage.app",
  messagingSenderId: "118981384025",
  appId: "1:118981384025:web:201eb80406791fb35e1e48"
};

  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);

  // Export auth and firestore
  const auth = firebase.auth();
  const db = firebase.firestore();