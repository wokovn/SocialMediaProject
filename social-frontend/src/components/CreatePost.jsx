import { useEffect, useRef, useState } from 'react'
import {
  GlobeAltIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  PhotoIcon,
  VideoCameraIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import RichTextEditor from './RichTextEditor'

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

function CreatePost({ onPostCreated }) {
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

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
        <PencilSquareIcon className="w-5 h-5 text-blue-600" aria-hidden="true" />
        <span>Create Post</span>
      </h3>
      
      <form onSubmit={handleSubmit}>
        <RichTextEditor
          value={content}
          onChange={setContent}
          placeholder="What's on your mind? Try rich text formatting."
          disabled={isSubmitting}
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition">
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
              disabled={isSubmitting}
            />
            <span className="inline-flex items-center gap-1">
              <PhotoIcon className="w-4 h-4 text-gray-500" aria-hidden="true" />
              <VideoCameraIcon className="w-4 h-4 text-gray-500" aria-hidden="true" />
            </span>
            <span>Add Photos or Videos</span>
          </label>
          <p className="text-xs text-gray-500">
            Up to {MAX_MEDIA_FILES} files, {MAX_FILE_SIZE_MB}MB each
          </p>
        </div>

        {selectedMedia.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {selectedMedia.map((item) => (
              <div key={item.id} className="relative border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                {item.file.type.startsWith('video/') ? (
                  <video src={item.previewUrl} controls className="w-full h-44 object-cover bg-black" />
                ) : (
                  <img src={item.previewUrl} alt={item.file.name} className="w-full h-44 object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => removeMedia(item.id)}
                  disabled={isSubmitting}
                  className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-white bg-black/70 rounded-md hover:bg-black/80 disabled:opacity-60"
                >
                  <XMarkIcon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Remove</span>
                </button>
                <p className="px-3 py-2 text-xs text-gray-600 truncate">{item.file.name}</p>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="relative">
            <GlobeAltIcon
              className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting}
              aria-label="Post visibility"
            >
              <option value="public">Public</option>
              <option value="friends">Friends</option>
              <option value="private">Private</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={
              isSubmitting ||
              (stripHtml(content).length === 0 && selectedMedia.length === 0)
            }
            className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            <PaperAirplaneIcon className="w-4 h-4" aria-hidden="true" />
            <span>{isSubmitting ? 'Posting...' : 'Post'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}

export default CreatePost
