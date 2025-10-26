/**
 * Root App Component
 *
 * This is the top-level component of our React app.
 * All other components will be children of this component.
 *
 * In React, components are functions that return JSX (HTML-like syntax).
 */

import { useState } from 'react'

function App() {
  // useState is a "hook" that adds state to our component
  // state = data that can change over time
  const [count, setCount] = useState(0)

  // This function runs when button is clicked
  const increment = () => {
    setCount(count + 1)
  }

  // Components return JSX - looks like HTML, but it's actually JavaScript
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Welcome to Qreate!</h1>
      <p>Your automated exam creator is ready to build.</p>

      {/* This is a comment in JSX */}
      <div style={{ marginTop: '2rem' }}>
        <p>Counter: {count}</p>
        <button onClick={increment}>Increment</button>
      </div>

      {/* Display platform info from Electron */}
      <div style={{ marginTop: '2rem', fontSize: '0.875rem', color: '#666' }}>
        <p>Platform: {window.electron?.platform || 'unknown'}</p>
      </div>
    </div>
  )
}

export default App
