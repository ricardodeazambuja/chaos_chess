import React from 'react'
import ReactDOM from 'react-dom/client'
import ChaosChess from './chaos-chess' // <-- IMPORT YOUR FILE
import './index.css' // <-- This must be here for Tailwind

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChaosChess /> {/* <-- USE YOUR COMPONENT */}
  </React.StrictMode>,
)