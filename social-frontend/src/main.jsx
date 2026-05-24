import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { SocketProvider } from './lib/socketProvider.jsx'
import { NotificationProvider } from './hooks/useNotifications'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SocketProvider>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </SocketProvider>
  </StrictMode>,
)
