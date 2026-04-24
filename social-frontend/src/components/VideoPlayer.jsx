import { useEffect, useRef } from 'react'

const VIDEO_VOLUME_KEY = 'social_app_video_volume'
const VIDEO_MUTED_KEY = 'social_app_video_muted'
const VOLUME_CHANGE_EVENT = 'app:video:volumechange'

/**
 * A wrapper around the HTML5 video element that persists volume and muted state
 * across sessions and synchronizes settings between multiple video instances on the same page.
 */
function VideoPlayer({ src, poster, className, ...props }) {
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // 1. Initialize settings from localStorage
    try {
      const savedVolume = localStorage.getItem(VIDEO_VOLUME_KEY)
      const savedMuted = localStorage.getItem(VIDEO_MUTED_KEY)

      if (savedVolume !== null) {
        video.volume = parseFloat(savedVolume)
      }
      if (savedMuted !== null) {
        video.muted = savedMuted === 'true'
      }
    } catch (err) {
      console.warn('Failed to load video settings from localStorage:', err)
    }

    // 2. Handle volume changes on THIS instance
    const handleLocalVolumeChange = () => {
      try {
        localStorage.setItem(VIDEO_VOLUME_KEY, video.volume.toString())
        localStorage.setItem(VIDEO_MUTED_KEY, video.muted.toString())

        // Sync with other instances in real-time
        window.dispatchEvent(
          new CustomEvent(VOLUME_CHANGE_EVENT, {
            detail: { volume: video.volume, muted: video.muted },
          })
        )
      } catch (err) {
        console.warn('Failed to save video settings to localStorage:', err)
      }
    }

    // 3. Handle volume synchronization from OTHER instances
    const handleGlobalVolumeChange = (e) => {
      if (videoRef.current && e.detail) {
        const { volume, muted } = e.detail
        // Prevent infinite event loop by checking if values actually changed
        if (videoRef.current.volume !== volume) {
          videoRef.current.volume = volume
        }
        if (videoRef.current.muted !== muted) {
          videoRef.current.muted = muted
        }
      }
    }

    video.addEventListener('volumechange', handleLocalVolumeChange)
    window.addEventListener(VOLUME_CHANGE_EVENT, handleGlobalVolumeChange)

    return () => {
      video.removeEventListener('volumechange', handleLocalVolumeChange)
      window.removeEventListener(VOLUME_CHANGE_EVENT, handleGlobalVolumeChange)
    }
  }, [])

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      className={className}
      controls
      preload="metadata"
      {...props}
    />
  )
}

export default VideoPlayer
