# 👑 Chaos Chess

> [!NOTE]
> **Play it live:** `https://<YOUR_USERNAME>.github.io/<YOUR_REPO_NAME>/`

A web-based chess game with a twist. This app, built with React, Vite, and Tailwind, lets you play chess with some chaotic new rules.

![Chaos Chess Screenshot](<./screenshot.png>)

---

## Features

* **Classic Mode:** Standard 1v1 chess rules.
* **Chaos Mode (Rotating):** Play with 2+ players. After your move, you start playing for the *next* color in the rotation.
* **Chaos Mode (Random):** Play with 2+ players. At the start of your turn, you are assigned a random color to play.
* **Online P2P:** Play with a friend online using a simple WebRTC (peer-to-peer) connection. No server needed.
* **Real Chess Rules:** Includes win by checkmate, win by king capture, castling, and pawn promotion.

## Tech Stack

* React
* Vite
* Tailwind CSS (v4)
* WebRTC (for network play)

## How to Run Locally

1.  **Clone the repo:**
    ```bash
    git clone [https://github.com/](https://github.com/)<YOUR_USERNAME>/<YOUR_REPO_NAME>.git
    ```
2.  **Move into the directory:**
    ```bash
    cd <YOUR_REPO_NAME>
    ```
3.  **Install dependencies:**
    ```bash
    npm install
    ```
4.  **Run the dev server:**
    ```bash
    npm run dev
    ```
5.  Open `http://localhost:5173` (or whatever URL the terminal gives you) in your browser.