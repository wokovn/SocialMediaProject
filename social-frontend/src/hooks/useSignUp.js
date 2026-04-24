import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import authService from '../services/authService'

const USERNAME_PATTERN = /^[a-z0-9._]{3,20}$/

export function useSignUp() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    fullName: ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [usernameStatus, setUsernameStatus] = useState({
    checking: false,
    available: null,
    text: '',
  })

  const verifyUsername = async (value) => {
    const normalizedUsername = String(value || '').trim().toLowerCase()

    if (!normalizedUsername) {
      setUsernameStatus({
        checking: false,
        available: false,
        text: 'Username is required',
      })
      return { ok: false, normalizedUsername }
    }

    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setUsernameStatus({
        checking: false,
        available: false,
        text: 'Use 3-20 chars: lowercase letters, numbers, dot, underscore',
      })
      return { ok: false, normalizedUsername }
    }

    setUsernameStatus({
      checking: true,
      available: null,
      text: 'Checking username...',
    })

    const { data, error } = await authService.checkUsernameAvailability(normalizedUsername)

    if (error) {
      setUsernameStatus({
        checking: false,
        available: false,
        text: error,
      })
      return { ok: false, normalizedUsername }
    }

    if (!data?.available) {
      setUsernameStatus({
        checking: false,
        available: false,
        text: data?.reason || 'Username is not available',
      })
      return { ok: false, normalizedUsername }
    }

    setUsernameStatus({
      checking: false,
      available: true,
      text: 'Username is available',
    })

    return {
      ok: true,
      normalizedUsername: data?.normalizedUsername || normalizedUsername,
    }
  }

  const handleChange = (e) => {
    const { name } = e.target
    const value =
      name === 'username'
        ? e.target.value.toLowerCase().replace(/\s+/g, '')
        : e.target.value

    setFormData({
      ...formData,
      [name]: value
    })

    if (name === 'username') {
      setUsernameStatus({
        checking: false,
        available: null,
        text: '',
      })
    }
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setMessage({
        type: 'error',
        text: 'Passwords do not match'
      })
      setLoading(false)
      return
    }

    const usernameCheck = await verifyUsername(formData.username)
    if (!usernameCheck.ok) {
      setMessage({
        type: 'error',
        text: 'Please choose a unique username before signing up',
      })
      setLoading(false)
      return
    }

    const { data, error } = await authService.signUp(
      formData.email,
      formData.password,
      usernameCheck.normalizedUsername,
      formData.fullName
    )

    if (error) {
      setMessage({
        type: 'error',
        text: error
      })
      setLoading(false)
      return
    }

    setMessage({
      type: 'success',
      text: 'Account created! Check your email to verify.'
    })
    setFormData({ email: '', password: '', confirmPassword: '', username: '', fullName: '' })
    setLoading(false)
    
    // Redirect to login after 2 seconds
    setTimeout(() => navigate('/login'), 2000)
  }

  return {
    formData,
    loading,
    message,
    usernameStatus,
    verifyUsername,
    handleChange,
    handleSignUp,
    navigate
  }
}
