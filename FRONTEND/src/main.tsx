import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './components/App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('RakshaMap root element #root was not found.')
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
