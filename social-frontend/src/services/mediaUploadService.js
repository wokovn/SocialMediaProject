import { supabase } from '../lib/supabase'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
const MAX_FILE_SIZE_MB = 25
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

const getMediaType = (file) => {
  if (file.type?.startsWith('image/')) {
    return 'image'
  }

  if (file.type?.startsWith('video/')) {
    return 'video'
  }

  return null
}

const parseJsonSafe = async (response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const getUploadAuthToken = async () => {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError) {
    throw new Error(sessionError.message || 'Failed to read auth session')
  }

  const token = session?.access_token
  if (!token) {
    throw new Error('You must be logged in to upload media')
  }

  return token
}

const validateUploadFile = (file) => {
  const mediaType = getMediaType(file)
  if (!mediaType) {
    throw new Error(`${file.name} is not a supported image/video file`)
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`${file.name} is too large. Max allowed size is ${MAX_FILE_SIZE_MB}MB`)
  }

  return mediaType
}

export const uploadMediaFile = async ({ file, userId, token: providedToken }) => {
  if (!file) {
    throw new Error('file is required for media upload')
  }

  if (!userId) {
    throw new Error('User ID is required for media upload')
  }

  const mediaType = validateUploadFile(file)
  const token = providedToken || await getUploadAuthToken()

  const formData = new FormData()
  formData.append('file', file, file.name)

  const response = await fetch(`${BACKEND_URL}/api/media/upload-temp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  const payload = await parseJsonSafe(response)
  if (!response.ok) {
    throw new Error(payload?.message || `${file.name} upload failed`)
  }

  if (!payload?.storagePath || !payload?.url) {
    throw new Error(`Upload response is missing storage data for ${file.name}`)
  }

  return {
    storageBucket: payload.storageBucket,
    storagePath: payload.storagePath,
    url: payload.url,
    mediaType: payload.mediaType || mediaType,
    fileSize: Number.isInteger(payload.fileSize) ? payload.fileSize : file.size,
  }
}

export const uploadPostMediaFiles = async ({ files, userId }) => {
  if (!files?.length) {
    return { data: [], error: null }
  }

  if (!userId) {
    return { data: null, error: 'User ID is required for media upload' }
  }

  try {
    const token = await getUploadAuthToken()
    const uploadedMedia = []

    for (const [index, file] of files.entries()) {
      const uploadedFile = await uploadMediaFile({
        file,
        userId,
        token,
      })

      uploadedMedia.push({ ...uploadedFile, displayOrder: index })
    }

    return { data: uploadedMedia, error: null }
  } catch (error) {
    return { data: null, error: error.message || 'Media upload failed' }
  }
}
