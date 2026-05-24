import {
  GlobeAltIcon,
  PhotoIcon,
  VideoCameraIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import RichTextEditor from './RichTextEditor'
import VideoPlayer from './VideoPlayer'
import { useCreatePost } from '../hooks/useCreatePost'

import { useState } from 'react'

function CreatePost({ onPostCreated, isModal = false }) {
  const [isExpanded, setIsExpanded] = useState(isModal)

  const handlePostCreatedWrapper = async (postData) => {
    await onPostCreated(postData)
    if (!isModal) {
      setIsExpanded(false)
    }
  }

  const {
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
  } = useCreatePost({ onPostCreated: handlePostCreatedWrapper })

  const showControls = isModal || isExpanded || content.trim().length > 0 || selectedMedia.length > 0

  return (
    <div className="bg-black p-2">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Editor Area */}
        <div 
          onClick={() => setIsExpanded(true)}
          onFocus={() => setIsExpanded(true)}
          className="w-full text-white text-lg cursor-text"
        >
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder={isModal ? "What is happening?!" : "What is happening?!"}
            disabled={isSubmitting}
            hideToolbar={!showControls}
            minHeightClass={showControls ? 'min-h-[120px]' : 'min-h-[44px]'}
          />
        </div>

        {showControls && (
          <>
            {/* Media Previews */}
            {selectedMedia.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 mt-2">
                {selectedMedia.map((item) => (
                  <div key={item.id} className="relative border border-[#2f3336] rounded-2xl overflow-hidden bg-[#16181c]">
                    {item.file.type.startsWith('video/') ? (
                      <VideoPlayer src={item.previewUrl} className="w-full aspect-video bg-black" />
                    ) : (
                      <img src={item.previewUrl} alt={item.file.name} className="w-full h-44 object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(item.id)}
                      disabled={isSubmitting}
                      className="absolute top-2 right-2 inline-flex items-center justify-center p-1.5 rounded-full bg-black/75 hover:bg-black/90 text-white transition"
                    >
                      <XMarkIcon className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <p className="px-3 py-2 text-xs text-[#71767b] truncate">{item.file.name}</p>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="text-sm text-red-500 font-semibold mt-2">
                {error}
              </div>
            )}

            {/* Controls Row */}
            <div className="flex items-center justify-between pt-3 border-t border-[#2f3336]">
              <div className="flex items-center gap-4">
                {/* Attachment inputs */}
                <label className="inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-[#1d9bf0]/10 cursor-pointer text-[#1d9bf0] transition">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isSubmitting}
                  />
                  <PhotoIcon className="w-5 h-5" aria-hidden="true" />
                </label>
                
                {/* Visibility selector */}
                <div className="relative flex items-center gap-1.5 text-sm text-[#1d9bf0] hover:bg-[#1d9bf0]/10 px-3 py-1.5 rounded-full cursor-pointer transition">
                  <GlobeAltIcon className="w-4 h-4" aria-hidden="true" />
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                    className="bg-transparent text-[#1d9bf0] font-bold outline-none cursor-pointer text-xs pr-1 font-display uppercase tracking-wider"
                    disabled={isSubmitting}
                    aria-label="Post visibility"
                  >
                    <option value="public" className="bg-black text-[#e7e9ea]">Everyone</option>
                    <option value="friends" className="bg-black text-[#e7e9ea]">Friends</option>
                    <option value="private" className="bg-black text-[#e7e9ea]">Only Me</option>
                  </select>
                </div>
                
                <span className="hidden sm:inline text-xs text-[#71767b]">
                  Max {MAX_MEDIA_FILES} files ({MAX_FILE_SIZE_MB}MB)
                </span>
              </div>

              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  (stripHtml(content).length === 0 && selectedMedia.length === 0)
                }
                className="px-5 py-2 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-bold rounded-full text-sm disabled:opacity-50 disabled:cursor-not-allowed transition font-display"
              >
                {isSubmitting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}

export default CreatePost
