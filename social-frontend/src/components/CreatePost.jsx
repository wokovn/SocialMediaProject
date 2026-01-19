import { useState } from 'react'

function CreatePost({ onPostCreated }) {
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!content.trim()) {
      setError('Post content cannot be empty')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onPostCreated({ content, visibility })
      setContent('')
      setVisibility('public')
    } catch (err) {
      setError(err.message || 'Failed to create post')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Post</h3>
      
      <form onSubmit={handleSubmit}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          rows="4"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          disabled={isSubmitting}
        />

        {error && (
          <div className="mt-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSubmitting}
          >
            <option value="public">Public</option>
            <option value="friends">Friends</option>
            <option value="private">Private</option>
          </select>

          <button
            type="submit"
            disabled={isSubmitting || !content.trim()}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            {isSubmitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default CreatePost
