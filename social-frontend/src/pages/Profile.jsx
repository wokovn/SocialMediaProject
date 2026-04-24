import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Cropper from 'react-easy-crop'
import {
  ArrowLeftIcon,
  CameraIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  UserPlusIcon,
  UserMinusIcon,
  UsersIcon,
  DocumentTextIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
import authService from '../services/authService'
import profileService from '../services/profileService'
import Modal from '../components/Modal'
import Feed from '../components/Feed'
import postsService from '../services/postsService'
import { getCroppedBlob } from '../utils/cropImage'

const MAX_AVATAR_SIZE_MB = 10
const MAX_AVATAR_SIZE_BYTES = MAX_AVATAR_SIZE_MB * 1024 * 1024

const normalizeProfilePayload = ({ profileData, authUser, isOwnProfileHint = false }) => ({
  id: profileData?.id || authUser?.id || null,
  email: profileData?.email || authUser?.email || null,
  username: profileData?.username || authUser?.user_metadata?.username || null,
  fullName: profileData?.fullName || authUser?.user_metadata?.full_name || null,
  avatar: profileData?.avatar || null,
  bio: profileData?.bio || null,
  stats: {
    followersCount: Number(profileData?.stats?.followersCount ?? 0),
    followingCount: Number(profileData?.stats?.followingCount ?? 0),
    postsCount: Number(profileData?.stats?.postsCount ?? 0),
  },
  isFollowing: Boolean(profileData?.isFollowing),
  isSelf: Boolean(profileData?.isSelf ?? isOwnProfileHint),
})

function Profile() {
  const navigate = useNavigate()
  const { userId: routeUserId, username: routeUsername } = useParams()
  const [authUser, setAuthUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSavingAvatar, setIsSavingAvatar] = useState(false)
  const [isFollowUpdating, setIsFollowUpdating] = useState(false)

  // Posts / Feed state
  const [posts, setPosts] = useState([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [cursor, setCursor] = useState(null)
  const limit = 20

  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [imageSrc, setImageSrc] = useState('')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true)
      setError('')
      setSuccess('')

      const { user, error: userError } = await authService.getCurrentUser()
      if (userError || !user) {
        navigate('/login')
        return
      }

      setAuthUser(user)

      let targetUserId = routeUserId || (!routeUsername && user.id)
      const isOwnProfile = (!routeUsername && !routeUserId) || targetUserId === user.id

      let profileData, profileError
      if (routeUsername) {
        const response = await profileService.getProfileByUsername(routeUsername)
        profileData = response.data
        profileError = response.error
      } else if (isOwnProfile) {
        const response = await profileService.getMyProfile()
        profileData = response.data
        profileError = response.error
      } else {
        const response = await profileService.getProfileById(targetUserId)
        profileData = response.data
        profileError = response.error
      }

      if (profileError) {
        setError(profileError)
        setLoading(false)
        return
      }

      setProfile(
        normalizeProfilePayload({
          profileData,
          authUser: user,
          isOwnProfileHint: isOwnProfile,
        }),
      )

      // Initialize posts fetch
      setLoading(false)
      loadUserPosts(targetUserId, false)
    }

    loadProfile()
  }, [navigate, routeUserId, routeUsername])

  const loadUserPosts = async (targetUserId, isLoadMore = false) => {
    if (!targetUserId) return
    setFeedLoading(true)

    const currentCursor = isLoadMore ? cursor : null
    const { data, error: feedError } = await postsService.getUserPosts(
      targetUserId,
      limit,
      currentCursor
    )

    if (!feedError && data) {
      if (isLoadMore) {
        setPosts((prev) => [...prev, ...data])
      } else {
        setPosts(data)
      }
      setHasMore(data.length === limit)
      if (data.length > 0) {
        setCursor(data[data.length - 1].createdAt)
      }
    }

    setFeedLoading(false)
  }

  const handleLoadMore = () => {
    loadUserPosts(profile?.id, true)
  }

  const handlePostDeleted = (postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  const handlePostShared = (sharedPost) => {
    if (!sharedPost?.id) return
    setPosts((prev) => [sharedPost, ...prev.filter((p) => p.id !== sharedPost.id)])
  }

  const isOwnProfile = useMemo(() => {
    if (!authUser?.id || !profile?.id) {
      return false
    }

    return profile.isSelf || authUser.id === profile.id
  }, [authUser, profile])

  const displayName = useMemo(() => {
    if (!profile) {
      return 'Profile'
    }

    return profile.fullName || profile.username || profile.email || 'Your Profile'
  }, [profile])

  const resetCropState = () => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
    setCroppedAreaPixels(null)
    setImageSrc('')
    setCropModalOpen(false)
  }

  const onCropComplete = useCallback((_croppedArea, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  const handleAvatarSelection = async (event) => {
    setError('')
    setSuccess('')

    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    if (!file.type?.startsWith('image/')) {
      setError('Please choose an image file for your avatar.')
      return
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setError(`Avatar is too large. Max allowed size is ${MAX_AVATAR_SIZE_MB}MB.`)
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(String(reader.result || ''))
      setCropModalOpen(true)
    }
    reader.onerror = () => {
      setError('Failed to read the selected image.')
    }
    reader.readAsDataURL(file)
  }

  const handleSaveAvatar = async () => {
    if (!isOwnProfile) {
      return
    }

    if (!authUser?.id || !imageSrc || !croppedAreaPixels) {
      setError('Please select and crop an image before saving.')
      return
    }

    setIsSavingAvatar(true)
    setError('')
    setSuccess('')

    try {
      const croppedBlob = await getCroppedBlob({
        imageSrc,
        pixelCrop: croppedAreaPixels,
        rotation,
        outputType: 'image/jpeg',
        quality: 0.9,
      })

      const croppedFile = new File([croppedBlob], `avatar-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      })

      const { data: uploadedMedia, error: uploadError } =
        await profileService.uploadAvatarFile({
          file: croppedFile,
          userId: authUser.id,
        })

      if (uploadError || !uploadedMedia) {
        throw new Error(uploadError || 'Failed to upload avatar file.')
      }

      const { data: finalizedAvatar, error: finalizeError } =
        await profileService.finalizeAvatar(uploadedMedia)

      if (finalizeError || !finalizedAvatar?.avatarUrl) {
        throw new Error(finalizeError || 'Failed to finalize avatar update.')
      }

      setProfile((prev) => ({
        ...prev,
        avatar: finalizedAvatar.avatarUrl,
      }))

      setSuccess('Avatar updated successfully.')
      resetCropState()
    } catch (saveError) {
      setError(saveError.message || 'Failed to update avatar.')
    } finally {
      setIsSavingAvatar(false)
    }
  }

  const handleFollowToggle = async () => {
    if (!profile?.id || isOwnProfile) {
      return
    }

    setIsFollowUpdating(true)
    setError('')
    setSuccess('')

    const { data, error: followError } = profile.isFollowing
      ? await profileService.unfollowUser(profile.id)
      : await profileService.followUser(profile.id)

    if (followError || !data?.profile) {
      setError(followError || 'Failed to update follow state.')
      setIsFollowUpdating(false)
      return
    }

    setProfile(
      normalizeProfilePayload({
        profileData: data.profile,
        authUser,
        isOwnProfileHint: false,
      }),
    )

    setSuccess(profile.isFollowing ? 'Unfollowed user.' : 'Following user.')
    setIsFollowUpdating(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading profile...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
              Back to Feed
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Profile</h1>
            <div className="w-24" />
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 h-24" />

          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 -mt-14">
              <div className="flex items-end gap-4">
                <div className="relative">
                  {profile?.avatar ? (
                    <img
                      src={profile.avatar}
                      alt="Profile avatar"
                      className="h-24 w-24 rounded-2xl border-4 border-white object-cover bg-gray-100"
                    />
                  ) : (
                    <div className="h-24 w-24 rounded-2xl border-4 border-white bg-gray-100 flex items-center justify-center text-gray-400">
                      <UserCircleIcon className="h-14 w-14" aria-hidden="true" />
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">{displayName}</h2>
                  <p className="text-sm text-gray-500">{profile?.email}</p>
                  {profile?.username ? (
                    <p className="text-sm text-gray-500">@{profile.username}</p>
                  ) : null}
                </div>
              </div>

              {isOwnProfile ? (
                <label className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer transition">
                  <CameraIcon className="h-4 w-4" aria-hidden="true" />
                  Upload Avatar
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarSelection}
                    disabled={isSavingAvatar}
                  />
                </label>
              ) : profile?.id ? (
                <button
                  type="button"
                  onClick={handleFollowToggle}
                  disabled={isFollowUpdating}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-70 ${
                    profile?.isFollowing
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isFollowUpdating ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Updating...
                    </>
                  ) : profile?.isFollowing ? (
                    <>
                      <UserMinusIcon className="h-4 w-4" aria-hidden="true" />
                      Following
                    </>
                  ) : (
                    <>
                      <UserPlusIcon className="h-4 w-4" aria-hidden="true" />
                      Follow
                    </>
                  )}
                </button>
              ) : null}
            </div>

            <div className="mt-6 space-y-3">
              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 inline-flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
                  {success}
                </div>
              ) : null}
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 inline-flex items-center gap-1">
                  <DocumentTextIcon className="h-4 w-4" aria-hidden="true" />
                  Posts
                </p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">
                  {profile?.stats?.postsCount ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 inline-flex items-center gap-1">
                  <UsersIcon className="h-4 w-4" aria-hidden="true" />
                  Followers
                </p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">
                  {profile?.stats?.followersCount ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 inline-flex items-center gap-1">
                  <UsersIcon className="h-4 w-4" aria-hidden="true" />
                  Following
                </p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">
                  {profile?.stats?.followingCount ?? 0}
                </p>
              </div>
            </div>

            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Full Name</p>
                <p className="mt-2 text-gray-900">{profile?.fullName || 'Not set'}</p>
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Bio</p>
                <p className="mt-2 text-gray-900 whitespace-pre-wrap">{profile?.bio || 'No bio yet'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* User Posts Section */}
        <div className="mt-8">
          <h3 className="text-lg font-bold text-gray-900 mb-6 px-2">Posts</h3>
          <Feed
            posts={posts}
            loading={feedLoading}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            currentUser={authUser}
            onPostDeleted={handlePostDeleted}
            onPostShared={handlePostShared}
            emptyTitle={isOwnProfile ? "You haven't posted anything yet" : "This user hasn't posted anything yet"}
            emptyDescription={isOwnProfile ? "Share your first post with the world!" : "Check back later for new content."}
          />
        </div>
      </main>

      <Modal
        isOpen={isOwnProfile && cropModalOpen}
        title="Crop Avatar"
        onClose={() => {
          if (!isSavingAvatar) {
            resetCropState()
          }
        }}
        closeOnBackdrop={!isSavingAvatar}
        panelClassName="max-w-2xl"
        actions={(
          <>
            <button
              type="button"
              onClick={resetCropState}
              disabled={isSavingAvatar}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAvatar}
              disabled={isSavingAvatar || !croppedAreaPixels}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSavingAvatar ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Saving...
                </>
              ) : (
                'Save Avatar'
              )}
            </button>
          </>
        )}
      >
        <div className="space-y-4">
          <div className="relative h-80 w-full overflow-hidden rounded-xl bg-gray-900">
            {imageSrc ? (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={onCropComplete}
              />
            ) : null}
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Zoom: {zoom.toFixed(1)}x
            </label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="w-full"
            />

            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Rotation: {rotation}°
            </label>
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={rotation}
              onChange={(event) => setRotation(Number(event.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Profile
