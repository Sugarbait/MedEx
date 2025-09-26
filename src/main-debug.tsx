import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

// Simple test component to verify React mounting works
const TestApp: React.FC = () => {
  return (
    <div style={{ padding: '50px', textAlign: 'center' }}>
      <h1>🎉 React is Working!</h1>
      <p>If you can see this, React is successfully mounting.</p>
      <div style={{ background: '#f0f0f0', padding: '20px', margin: '20px', borderRadius: '8px' }}>
        <h2>Debug Information</h2>
        <p>Port: {window.location.port}</p>
        <p>Hostname: {window.location.hostname}</p>
        <p>Time: {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  )
}

// Mount React without any complex imports
console.log('🚀 Mounting simple test React app...')
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TestApp />
  </React.StrictMode>
)
console.log('✅ Test React app mounted successfully')