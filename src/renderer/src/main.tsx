/**
 * React Application Entry Point
 *
 * This file:
 * 1. Imports React and ReactDOM
 * 2. Imports our root App component
 * 3. Renders the App into the #root div
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Get the root element from HTML
const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

// Create React root and render app
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
