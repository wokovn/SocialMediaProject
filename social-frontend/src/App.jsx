import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import SignUp from './components/SignUp'
import Login from './pages/Login'
import Home from './pages/Home'
import './App.css'

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/login" element={<Login />} />
          <Route path="/home" element={<Home />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
