console.log('=== MAIN SIMPLE STARTING ===')

// Absolute minimal React test
import React from 'react'
import ReactDOM from 'react-dom/client'

const root = document.getElementById('root')
console.log('Root element:', root)

if (root) {
  console.log('Creating React root...')

  const reactRoot = ReactDOM.createRoot(root)
  console.log('React root created:', reactRoot)

  console.log('Rendering simple component...')
  reactRoot.render(
    React.createElement('div', {
      style: {
        padding: '50px',
        backgroundColor: '#f0f0f0',
        fontSize: '24px',
        fontFamily: 'Arial'
      }
    }, [
      React.createElement('h1', { key: 'h1' }, '🎉 IT WORKS!'),
      React.createElement('p', { key: 'p1' }, 'React is successfully rendering!'),
      React.createElement('p', { key: 'p2' }, `Time: ${new Date().toLocaleTimeString()}`),
      React.createElement('p', { key: 'p3' }, `Port: ${window.location.port}`)
    ])
  )

  console.log('React render called successfully')
} else {
  console.error('ROOT ELEMENT NOT FOUND!')
  document.body.innerHTML = '<h1>ERROR: Root element not found</h1>'
}

console.log('=== MAIN SIMPLE COMPLETE ===')