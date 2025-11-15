# 👑 Chaos Chess

**Version 0.0.1** - A web-based chess game with a twist. This app, built with React, Vite, and Tailwind, lets you play chess with some chaotic new rules.

![Chaos Chess Screenshot](<./public/screenshot.png>)

---

## Features

* **Classic Mode (Normie):** Standard 1v1 chess rules.
* **Chaos Mode (Rotating):** Play with 2+ players. After your move, you start playing for the *next* color in the rotation.
* **Chaos Mode (Random):** Play with 2+ players. At the start of your turn, you are assigned a random color to play.
* **Online P2P:** Play with a friend online using WebRTC (peer-to-peer). No server needed.
* **Real Chess Rules:** Includes checkmate, stalemate, castling, en passant, and pawn promotion.
* **Board Coordinates:** Standard algebraic notation (a-h, 1-8) displayed on the board.
* **Timed Games:** Optional timer mode with customizable time controls.
* **Points Mode:** Score points by capturing pieces, first to reach target score wins.

## Tech Stack

* React
* Vite
* Tailwind CSS (v4)
* WebRTC (for network play)

## How to Run Locally

1.  **Clone the repo:**
    ```bash
    git clone https://github.com/ricardodeazambuja/chaos_chess.git
    ```
2.  **Move into the directory:**
    ```bash
    cd chaos_chess
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