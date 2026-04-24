import { useEffect, useRef, useState } from 'react'

const MAX_MEDIA_FILES = 4
const MAX_FILE_SIZE_MB = 25
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

const stripHtml = (html = '') =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()

const isSupportedMedia = (file) =>
  file.type?.startsWith('image/') || file.type?.startsWith('video/')

const buildMediaItem = (file) => ({
  id:
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,
  file,
  previewUrl: URL.createObjectURL(file),
})

export function useCreatePost({ onPostCreated }) {
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [selectedMedia, setSelectedMedia] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const selectedMediaRef = useRef([])

  useEffect(() => {
    selectedMediaRef.current = selectedMedia
  }, [selectedMedia])

  useEffect(() => {
    return () => {
      selectedMediaRef.current.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl)
      })
    }
  }, [])

  const clearMedia = () => {
    selectedMedia.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl)
    })
    setSelectedMedia([])
  }

  const removeMedia = (id) => {
    setSelectedMedia((prev) => {
      const mediaToRemove = prev.find((item) => item.id === id)
      if (mediaToRemove) {
        URL.revokeObjectURL(mediaToRemove.previewUrl)
      }
      return prev.filter((item) => item.id !== id)
    })
  }

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) {
      return
    }

    setError(null)

    setSelectedMedia((prev) => {
      const next = [...prev]

      for (const file of files) {
        if (next.length >= MAX_MEDIA_FILES) {
          setError(`You can attach up to ${MAX_MEDIA_FILES} files per post`)
          break
        }

        if (!isSupportedMedia(file)) {
          setError(`${file.name} is not a supported image/video file`)
          continue
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
          setError(`${file.name} is too large. Max size is ${MAX_FILE_SIZE_MB}MB`)
          continue
        }

        next.push(buildMediaItem(file))
      }

      return next
    })

    e.target.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const hasTextContent = stripHtml(content).length > 0
    const hasMedia = selectedMedia.length > 0
    
    if (!hasTextContent && !hasMedia) {
      setError('Add some text or attach media before posting')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onPostCreated({
        content,
        visibility,
        files: selectedMedia.map((item) => item.file),
      })

      setContent('')
      setVisibility('public')
      clearMedia()
    } catch (err) {
      setError(err.message || 'Failed to create post')
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    content,
    setContent,
    visibility,
    setVisibility,
    selectedMedia,
    isSubmitting,
    error,
    removeMedia,
    handleFileChange,
    handleSubmit,
    stripHtml,
    MAX_MEDIA_FILES,
    MAX_FILE_SIZE_MB
  }
}
