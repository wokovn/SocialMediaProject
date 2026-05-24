import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import SignUp from './components/SignUp'
import Login from './pages/Login'
import Home from './pages/Home'
import Profile from './pages/Profile'
import SavedPosts from './pages/SavedPosts'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Admin from './pages/Admin'
import Notifications from './pages/Notifications'
import Search from './pages/Search'
import PostDetailModal from './components/PostDetailModal'
import TwitterLayout from './components/TwitterLayout'
import './App.css'

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          <Route element={<TwitterLayout />}>
            <Route path="/home" element={<Home />} />
            <Route path="/saved" element={<SavedPosts />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:userId" element={<Profile />} />
            <Route path="/profile/u/:username" element={<Profile />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/search" element={<Search />} />
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Routes>
        <PostDetailModal />
      </div>
    </Router>
  )
}

export default App

