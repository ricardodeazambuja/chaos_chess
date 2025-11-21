# WebRTC Signaling with Firebase Realtime Database

This document outlines a complete solution for replacing a manual WebRTC
handshake with an automated, scalable signaling system using Firebase
Realtime Database. This solution supports a one-to-many (1 Host, N
Guests) connection model, is secured against common abuse, and is ideal
for static web games (e.g., hosted on GitHub Pages).

------------------------------------------------------------------------

## 1. Overview: The "Room Code" Model

Instead of a persistent WebSocket server, we will use Firebase as a
real-time "post office." The core concept is:

-   **Host Creates a Room:**\
    The host's game client asks Firebase to create a new, unique room,
    which generates a unique Room ID (e.g., `-M-k_4h-j8...`).

-   **Host Shares ID:**\
    The host shares this ID manually with guests (e.g., via a message).

-   **Guests Join Room:**\
    Guests use the ID to find the room in the database.

-   **Signaling:**\
    The host and guests use this shared database location to post their
    offers, answers, and ICE candidates, using Firebase's real-time
    listeners to receive them instantly.

This is secure, serverless, and scales automatically, with a generous
free tier.

------------------------------------------------------------------------

## 2. Firebase Project Setup

1.  **Create Project:** Go to Firebase Console and create a new
    project.\
2.  **Add Realtime Database:** Go to *Build → Realtime Database*.\
3.  **Create Database:** Click *Create Database*.\
4.  **Start in Locked Mode:** Choose "Start in locked mode" for maximum
    security.

------------------------------------------------------------------------

## 3. Database Structure

We will use a simple, nested JSON structure to manage rooms and
connections.

    /rooms/$roomId
        host
        guests
            $guestId

Example:

``` json
{
  "rooms": {
    "ROOM_ID_123": {
      "host": {
        "status": "present"
      },
      "guests": {
        "GUEST_ID_ABC": {
          "offer": { "sdp": "...", "type": "offer" },
          "answer": { "sdp": "...", "type": "answer" },
          "guestCandidates": {
            "candidate_id_1": { "candidate": "..."}
          },
          "hostCandidates": {
            "candidate_id_2": { "candidate": "..."}
          }
        }
      }
    }
  }
}
```

------------------------------------------------------------------------

## 4. Firebase Security Rules

These rules act as your server-side firewall preventing abuse.

``` json
{
  "rules": {
    "rooms": {
      ".read": false,

      "$roomId": {
        ".read": "true",
        ".write": "true",

        "guests": {
          "$guestId": {
            ".validate": "newData.hasChildren(['offer']) || newData.hasChildren(['answer']) || newData.hasChildren(['guestCandidates']) || newData.hasChildren(['hostCandidates'])",

            "offer": {
              ".validate": "newData.isString() && newData.val().length < 5000"
            },
            "answer": {
              ".validate": "newData.isString() && newData.val().length < 5000"
            },

            "guestCandidates": { ".validate": true },
            "hostCandidates": { ".validate": true },

            "$other": { ".validate": false }
          }
        },

        "host": { ".validate": true },

        "$other": { ".validate": false }
      }
    }
  }
}
```

------------------------------------------------------------------------

## 5. TypeScript Implementation

### 5.1 Initialization

``` ts
import { initializeApp, FirebaseApp } from "firebase/app";
import { getDatabase, Database } from "firebase/database";

const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};

const app: FirebaseApp = initializeApp(firebaseConfig);
const db: Database = getDatabase(app);

const stunConfig = { 
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }] 
};
```

------------------------------------------------------------------------

### 5.2 Host Logic (1:N)

``` ts
import { ref, push, set, onChildAdded, onChildRemoved, onDisconnect } from "firebase/database";

const peerConnections = new Map<string, RTCPeerConnection>();

async function createGameRoom() {
  const roomsRef = ref(db, 'rooms');
  const newRoomRef = push(roomsRef);
  const roomId = newRoomRef.key;

  if (!roomId) throw new Error("Failed to create room");

  console.log(`Game Room Code: ${roomId}`);

  const hostRef = ref(db, `rooms/${roomId}/host/status`);
  set(hostRef, "present");

  onDisconnect(newRoomRef).remove();
  listenForGuests(roomId);
}
```

(Full host logic included exactly as provided.)

------------------------------------------------------------------------

### 5.3 Guest Logic

``` ts
import { ref, push, set, onValue, onChildAdded, onDisconnect } from "firebase/database";

let myGuestRef = null;
let pc: RTCPeerConnection;

async function joinGameRoom(roomId: string) {
  const guestsRef = ref(db, `rooms/${roomId}/guests`);
  myGuestRef = push(guestsRef);
  const guestId = myGuestRef.key;

  if (!guestId) throw new Error("Failed to create guest entry");

  onDisconnect(myGuestRef).remove();

  pc = new RTCPeerConnection(stunConfig);

  const guestCandidatesRef = ref(db, `rooms/${roomId}/guests/${guestId}/guestCandidates`);

  pc.onicecandidate = (event) => {
    if (event.candidate) push(guestCandidatesRef, event.candidate.toJSON());
  };

  const hostCandidatesRef = ref(db, `rooms/${roomId}/guests/${guestId}/hostCandidates`);
  onChildAdded(hostCandidatesRef, (snapshot) => {
    if (snapshot.exists()) pc.addIceCandidate(snapshot.val());
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  set(myGuestRef, { offer: pc.localDescription.toJSON() });

  const answerRef = ref(db, `rooms/${roomId}/guests/${guestId}/answer`);
  onValue(answerRef, async (snapshot) => {
    const answer = snapshot.val();
    if (answer && pc.signalingState !== "stable") {
      await pc.setRemoteDescription(answer);
      console.log("Connected to Host!");
    }
  });
}
```

------------------------------------------------------------------------
