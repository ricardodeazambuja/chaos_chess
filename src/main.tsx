import React from 'react'
import ReactDOM from 'react-dom/client'
import ChessGame from './rotating-chess' // <-- IMPORT YOUR FILE
import './index.css' // <-- This must be here for Tailwind

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChessGame /> {/* <-- USE YOUR COMPONENT */}
  </React.StrictMode>,
)