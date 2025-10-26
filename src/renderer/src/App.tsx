/**
 * Root App Component
 *
 * Main application entry point with layout and routing.
 */

import { AppLayout } from './components/layout/AppLayout'
import { HomePage } from './pages/HomePage'

function App() {
  return (
    <AppLayout>
      <HomePage />
    </AppLayout>
  )
}

export default App
