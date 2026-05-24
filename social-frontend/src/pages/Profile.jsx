import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Cropper from 'react-easy-crop'
import {
  CameraIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  UserPlusIcon,
  UserMinusIcon,
  CalendarIcon,
  LinkIcon,
  PencilIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline'
import authService from '../services/authService'
import profileService from '../services/profileService'
import Modal from '../components/Modal'
import Feed from '../components/Feed'
import postsService from '../services/postsService'
import TwitterLayout from '../components/TwitterLayout'
import { getCroppedBlob } from '../utils/cropImage'

const MAX_AVATAR_SIZE_MB = 10
const MAX_AVATAR_SIZE_BYTES = MAX_AVATAR_SIZE_MB * 1024 * 1024

const normalizeProfilePayload = ({ profileData, authUser, isOwnProfileHint = false }) => ({
  id: profileData?.id || authUser?.id || null,
  email: profileData?.email || authUser?.email || null,
  username: profileData?.username || authUser?.user_metadata?.username || null,
  fullName: profileData?.fullName || authUser?.user_metadata?.full_name || null,
  avatar: profileData?.avatar || null,
  banner: profileData?.banner || null,
  bio: profileData?.bio || null,
  website: profileData?.website || null,
  showEmail: Boolean(profileData?.showEmail),
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
  const [isSavingBanner, setIsSavingBanner] = useState(false)
  const [isFollowUpdating, setIsFollowUpdating] = useState(false)

  // Posts / Feed state
  const [posts, setPosts] = useState([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [cursor, setCursor] = useState(null)
  const cursorRef = useRef(null)
  const limit = 20

  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [imageSrc, setImageSrc] = useState('')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)

  // Edit Profile modal state
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    fullName: '',
    username: '',
    bio: '',
    website: '',
    showEmail: false,
  })
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  // Follow/Unfollow list modal state
  const [followModalOpen, setFollowModalOpen] = useState(false)
  const [followModalType, setFollowModalType] = useState('followers') // 'followers' | 'following'
  const [followList, setFollowList] = useState([])
  const [followListLoading, setFollowListLoading] = useState(false)
  const [followListHasMore, setFollowListHasMore] = useState(true)
  const [followListCursor, setFollowListCursor] = useState(null)


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

      setLoading(false)
      loadUserPosts(targetUserId || profileData?.id, false)
    }

    loadProfile()
  }, [navigate, routeUserId, routeUsername])

  const loadUserPosts = useCallback(async (targetUserId, isLoadMore = false) => {
    if (!targetUserId) return
    setFeedLoading(true)

    const currentCursor = isLoadMore ? cursorRef.current : null
    const { data, error: feedError } = await postsService.getUserPosts(
      targetUserId,
      limit,
      currentCursor
    )

    if (!feedError && data) {
      if (isLoadMore) {
        setPosts((prev) => {
          const newPosts = data.filter(d => !prev.some(p => p.id === d.id))
          setHasMore(newPosts.length > 0 && data.length === limit)
          return newPosts.length > 0 ? [...prev, ...newPosts] : prev
        })
      } else {
        setPosts(data)
        setHasMore(data.length === limit)
        cursorRef.current = null
      }
      if (data.length > 0) {
        const newCursor = data[data.length - 1].createdAt
        setCursor(newCursor)
        cursorRef.current = newCursor
      }
    }

    setFeedLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLoadMore = useCallback(() => {
    if (profile?.id) loadUserPosts(profile.id, true)
  }, [profile?.id, loadUserPosts])

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
    if (!profile) return 'Profile'
    return profile.fullName || profile.username || profile.email?.split('@')[0] || 'Your Profile'
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

    if (!file) return

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
    if (!isOwnProfile) return

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
    if (!profile?.id || isOwnProfile) return

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

  const handleBannerSelection = async (event) => {
    setError('')
    setSuccess('')
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!file.type?.startsWith('image/')) {
      setError('Please choose an image file for your banner.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Banner is too large. Max size is 10MB.')
      return
    }

    setIsSavingBanner(true)
    try {
      const { data: uploadedMedia, error: uploadError } =
        await profileService.uploadBannerFile({
          file,
          userId: authUser.id,
        })

      if (uploadError || !uploadedMedia) {
        throw new Error(uploadError || 'Failed to upload banner file.')
      }

      const { data: finalizedBanner, error: finalizeError } =
        await profileService.finalizeBanner(uploadedMedia)

      if (finalizeError || !finalizedBanner?.bannerUrl) {
        throw new Error(finalizeError || 'Failed to finalize banner update.')
      }

      setProfile((prev) => ({
        ...prev,
        banner: finalizedBanner.bannerUrl,
      }))
      setSuccess('Banner updated successfully.')
    } catch (err) {
      setError(err.message || 'Failed to update banner.')
    } finally {
      setIsSavingBanner(false)
    }
  }

  const openEditModal = () => {
    if (!profile) return
    setEditForm({
      fullName: profile.fullName || '',
      username: profile.username || '',
      bio: profile.bio || '',
      website: profile.website || '',
      showEmail: Boolean(profile.showEmail),
    })
    setEditModalOpen(true)
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setIsSavingProfile(true)
    setError('')
    setSuccess('')

    try {
      const { data, error: updateError } = await profileService.updateProfile({
        fullName: editForm.fullName,
        username: editForm.username,
        bio: editForm.bio,
        website: editForm.website,
        showEmail: editForm.showEmail,
      })

      if (updateError || !data) {
        throw new Error(updateError || 'Failed to update profile.')
      }

      setProfile((prev) => ({
        ...prev,
        ...data,
      }))
      setSuccess('Profile updated successfully.')
      setEditModalOpen(false)
    } catch (err) {
      setError(err.message || 'Failed to save profile.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const openFollowModal = async (type) => {
    if (!profile?.id) return
    setFollowModalType(type)
    setFollowList([])
    setFollowListLoading(true)
    setFollowModalOpen(true)
    setFollowListHasMore(true)
    setFollowListCursor(null)

    try {
      const { data, error: listError } = type === 'followers'
        ? await profileService.getFollowers(profile.id, { limit: 20 })
        : await profileService.getFollowing(profile.id, { limit: 20 })

      if (listError) throw new Error(listError)
      setFollowList(data || [])
      setFollowListHasMore((data || []).length === 20)
      if ((data || []).length > 0) {
        setFollowListCursor(data[data.length - 1].followedAt)
      }
    } catch (err) {
      setError(err.message || 'Failed to load follow list.')
    } finally {
      setFollowListLoading(false)
    }
  }

  const loadMoreFollowList = async () => {
    if (!profile?.id || followListLoading || !followListHasMore) return
    setFollowListLoading(true)

    try {
      const { data, error: listError } = followModalType === 'followers'
        ? await profileService.getFollowers(profile.id, { limit: 20, cursor: followListCursor })
        : await profileService.getFollowing(profile.id, { limit: 20, cursor: followListCursor })

      if (listError) throw new Error(listError)
      if (data && data.length > 0) {
        setFollowList((prev) => [...prev, ...data])
        setFollowListHasMore(data.length === 20)
        setFollowListCursor(data[data.length - 1].followedAt)
      } else {
        setFollowListHasMore(false)
      }
    } catch (err) {
      setError(err.message || 'Failed to load more.')
    } finally {
      setFollowListLoading(false)
    }
  }

  const handleFollowToggleInList = async (targetUser) => {
    try {
      const { data, error: followError } = targetUser.isFollowing
        ? await profileService.unfollowUser(targetUser.id)
        : await profileService.followUser(targetUser.id)

      if (followError) throw new Error(followError)

      setFollowList((prev) =>
        prev.map((item) =>
          item.id === targetUser.id
            ? { ...item, isFollowing: !item.isFollowing }
            : item
        )
      )

      if (profile) {
        setProfile((prev) => {
          const stats = { ...prev.stats }
          // If viewing own profile and we unfollow/follow someone, the followingCount of own profile changes.
          // If viewing another profile and someone on their list is followed/unfollowed by us, the follower/following count of that user changes but not the count of the main profile being viewed (unless we follow the user being viewed, which is handled elsewhere).
          if (prev.isSelf && followModalType === 'following') {
            stats.followingCount = Math.max(0, stats.followingCount + (targetUser.isFollowing ? -1 : 1))
          }
          return { ...prev, stats }
        })
      }
    } catch (err) {
      setError(err.message || 'Failed to toggle follow.')
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1d9bf0]"></div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-[#2f3336] px-4 py-3 flex items-center gap-6">
        <button
          onClick={() => navigate('/home')}
          className="p-2 rounded-full hover:bg-[#16181c] text-white transition"
          aria-label="Back"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-white">
            <path d="M7.414 13l5.013 5.01 1.414-1.41-6.013-6H21v-2H7.828l6.013-6-1.414-1.41L7.414 11H2v2h5.414z" />
          </svg>
        </button>
        <div>
          <h2 className="text-xl font-bold font-display text-white">{displayName}</h2>
          <p className="text-xs text-[#71767b]">{profile?.stats?.postsCount ?? 0} Posts</p>
        </div>
      </div>

      {/* Profile Details Card */}
      <div className="border-b border-[#2f3336] pb-4">
        {/* Banner with floating upload overlay for owners */}
        <div className="relative group/banner h-[200px] w-full bg-[#1c1e22] overflow-hidden">
          {profile?.banner ? (
            <img src={profile.banner} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="bg-gradient-to-r from-[#1d9bf0]/20 via-[#16181c] to-[#1d9bf0]/20 h-full w-full" />
          )}
          {isOwnProfile && (
            <label className="absolute inset-0 bg-black/40 opacity-0 group-hover/banner:opacity-100 flex items-center justify-center cursor-pointer transition duration-200">
              <div className="p-3 bg-black/60 rounded-full text-white hover:bg-black/80 transition">
                {isSavingBanner ? (
                  <ArrowPathIcon className="h-6 w-6 animate-spin" />
                ) : (
                  <CameraIcon className="h-6 w-6" />
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleBannerSelection}
                disabled={isSavingBanner}
              />
            </label>
          )}
        </div>

        {/* Profile Avatar and Actions row */}
        <div className="px-4 relative flex justify-between items-end -mt-16 mb-4">
          {/* Circular Floating Avatar */}
          <div className="relative">
            {profile?.avatar ? (
              <img
                src={profile.avatar}
                alt="Profile avatar"
                className="h-32 w-32 rounded-full border-4 border-black object-cover bg-black"
              />
            ) : (
              <div className="h-32 w-32 rounded-full border-4 border-black bg-[#16181c] flex items-center justify-center text-[#71767b]">
                <svg viewBox="0 0 24 24" className="h-20 w-20 fill-current">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                </svg>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="mb-2">
            {isOwnProfile ? (
              <div className="flex gap-2 items-center">
                <label className="inline-flex items-center justify-center p-2 rounded-full border border-[#2f3336] bg-black text-[#71767b] hover:text-white hover:bg-[#16181c] cursor-pointer transition" title="Change Avatar">
                  <CameraIcon className="h-5 w-5" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarSelection}
                    disabled={isSavingAvatar}
                  />
                </label>
                <button
                  type="button"
                  onClick={openEditModal}
                  className="rounded-full border border-[#2f3336] bg-black px-4 py-1.5 text-sm font-bold text-white hover:bg-[#16181c] transition"
                >
                  Edit profile
                </button>
              </div>
            ) : profile?.id ? (
              <button
                type="button"
                onClick={handleFollowToggle}
                disabled={isFollowUpdating}
                className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition disabled:opacity-70 ${
                  profile?.isFollowing
                    ? 'border border-[#2f3336] text-white hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 group'
                    : 'bg-white text-black hover:bg-[#e6e6e6]'
                }`}
              >
                {isFollowUpdating ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : profile?.isFollowing ? (
                  <>
                    <span className="group-hover:hidden">Following</span>
                    <span className="hidden group-hover:inline">Unfollow</span>
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
        </div>

        {/* User Metadata */}
        <div className="px-4 mt-3 space-y-3">
          <div>
            <h1 className="text-2xl font-black font-display text-white leading-tight">{displayName}</h1>
            {profile?.username && (
              <p className="text-sm text-[#71767b]">@{profile.username}</p>
            )}
          </div>

          {/* Bio */}
          {profile?.bio ? (
            <p className="text-[15px] text-[#e7e9ea] whitespace-pre-wrap leading-normal">{profile.bio}</p>
          ) : (
            <p className="text-sm text-[#71767b] italic">No biography description yet</p>
          )}

          {/* Website, email & join date */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-[#71767b] pt-1">
            {profile?.email && (
              <span className="flex items-center gap-1.5">
                <EnvelopeIcon className="h-4 w-4 text-[#71767b]" />
                <span>{profile.email}</span>
              </span>
            )}
            {profile?.website && (
              <span className="flex items-center gap-1.5">
                <LinkIcon className="h-4 w-4 text-[#71767b]" />
                <a
                  href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1d9bf0] hover:underline"
                >
                  {profile.website}
                </a>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4" />
              <span>Joined {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'Recently'}</span>
            </span>
          </div>

          {/* Followers / Following count stats */}
          <div className="flex gap-4 text-sm pt-1">
            <span onClick={() => openFollowModal('following')} className="hover:underline cursor-pointer">
              <strong className="text-white font-bold">{profile?.stats?.followingCount ?? 0}</strong>{' '}
              <span className="text-[#71767b]">Following</span>
            </span>
            <span onClick={() => openFollowModal('followers')} className="hover:underline cursor-pointer">
              <strong className="text-white font-bold">{profile?.stats?.followersCount ?? 0}</strong>{' '}
              <span className="text-[#71767b]">Followers</span>
            </span>
          </div>

          {/* Notifications feed alerts */}
          <div className="space-y-2 pt-1">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400 inline-flex items-center gap-2">
                <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
                {success}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Posts List */}
      <div className="pb-12">
        <Feed
          posts={posts}
          loading={feedLoading}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          currentUser={authUser}
          onPostDeleted={handlePostDeleted}
          onPostShared={handlePostShared}
          emptyTitle={isOwnProfile ? "You haven't posted anything yet" : "This user hasn't posted anything yet"}
          emptyDescription={isOwnProfile ? "Write your first post and share it with the world!" : "Check back later for new content."}
        />
      </div>

      {/* Crop Avatar Modal */}
      <Modal
        isOpen={isOwnProfile && cropModalOpen}
        title="Crop Avatar"
        onClose={() => {
          if (!isSavingAvatar) {
            resetCropState()
          }
        }}
      >
        <div className="space-y-4">
          <div className="relative h-80 w-full overflow-hidden rounded-2xl bg-black border border-[#2f3336]">
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
            <div className="flex justify-between text-xs font-bold uppercase tracking-wide text-[#71767b]">
              <span>Zoom</span>
              <span>{zoom.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="w-full accent-[#1d9bf0] bg-[#16181c] h-1 rounded-lg"
            />

            <div className="flex justify-between text-xs font-bold uppercase tracking-wide text-[#71767b]">
              <span>Rotation</span>
              <span>{rotation}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={rotation}
              onChange={(event) => setRotation(Number(event.target.value))}
              className="w-full accent-[#1d9bf0] bg-[#16181c] h-1 rounded-lg"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#2f3336]">
            <button
              type="button"
              onClick={resetCropState}
              disabled={isSavingAvatar}
              className="rounded-full border border-[#2f3336] px-4 py-2 text-sm font-bold text-[#e7e9ea] hover:bg-[#16181c] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAvatar}
              disabled={isSavingAvatar || !croppedAreaPixels}
              className="inline-flex items-center gap-2 rounded-full bg-[#1d9bf0] px-4 py-2 text-sm font-bold text-white hover:bg-[#1a8cd8] disabled:opacity-60"
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
          </div>
        </div>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={editModalOpen}
        title="Edit Profile"
        onClose={() => !isSavingProfile && setEditModalOpen(false)}
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#71767b] uppercase tracking-wider mb-1">Name</label>
            <input
              type="text"
              required
              maxLength={100}
              value={editForm.fullName}
              onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              className="w-full bg-black border border-[#2f3336] rounded-lg p-2.5 text-white focus:border-[#1d9bf0] outline-none transition"
              placeholder="Your display name"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#71767b] uppercase tracking-wider mb-1">Username</label>
            <input
              type="text"
              required
              maxLength={20}
              value={editForm.username}
              onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
              className="w-full bg-black border border-[#2f3336] rounded-lg p-2.5 text-white focus:border-[#1d9bf0] outline-none transition"
              placeholder="username"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#71767b] uppercase tracking-wider mb-1">Bio</label>
            <textarea
              maxLength={300}
              rows={3}
              value={editForm.bio}
              onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
              className="w-full bg-black border border-[#2f3336] rounded-lg p-2.5 text-white focus:border-[#1d9bf0] outline-none transition resize-none"
              placeholder="Tell us about yourself"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#71767b] uppercase tracking-wider mb-1">Website</label>
            <input
              type="text"
              maxLength={200}
              value={editForm.website}
              onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
              className="w-full bg-black border border-[#2f3336] rounded-lg p-2.5 text-white focus:border-[#1d9bf0] outline-none transition"
              placeholder="example.com"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-[#16181c]/50 rounded-xl border border-[#2f3336]">
            <div>
              <p className="text-sm font-bold text-white">Show Email on Profile</p>
              <p className="text-xs text-[#71767b]">Allow everyone to view your email address.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.showEmail}
                onChange={(e) => setEditForm({ ...editForm, showEmail: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#2f3336] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1d9bf0]"></div>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#2f3336]">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              disabled={isSavingProfile}
              className="rounded-full border border-[#2f3336] px-4 py-2 text-sm font-bold text-[#e7e9ea] hover:bg-[#16181c]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingProfile}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-black hover:bg-[#e6e6e6] transition disabled:opacity-50"
            >
              {isSavingProfile ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Followers/Following List Modal */}
      <Modal
        isOpen={followModalOpen}
        title={followModalType === 'followers' ? 'Followers' : 'Following'}
        onClose={() => setFollowModalOpen(false)}
      >
        <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
          {followList.length === 0 && !followListLoading ? (
            <p className="text-sm text-[#71767b] text-center py-8">
              No {followModalType} yet.
            </p>
          ) : (
            <div className="divide-y divide-[#2f3336]">
              {followList.map((userItem) => (
                <div key={userItem.id} className="flex justify-between items-center py-3 first:pt-0 last:pb-0 gap-3">
                  <div
                    onClick={() => {
                      setFollowModalOpen(false)
                      navigate(`/profile/${userItem.id}`)
                    }}
                    className="flex gap-3 cursor-pointer group flex-1 min-w-0"
                  >
                    {userItem.avatar ? (
                      <img src={userItem.avatar} alt="Avatar" className="h-10 h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#1d9bf0] to-[#8ecdf8] flex items-center justify-center text-white font-bold text-sm">
                        {(userItem.fullName?.[0] || userItem.username?.[0] || 'U').toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-white group-hover:underline truncate leading-tight">
                        {userItem.fullName || userItem.username}
                      </p>
                      <p className="text-xs text-[#71767b] truncate">@{userItem.username}</p>
                      {userItem.bio && (
                        <p className="text-xs text-[#e7e9ea] truncate mt-0.5 max-w-md">{userItem.bio}</p>
                      )}
                    </div>
                  </div>

                  {/* Follow/Unfollow action inside list */}
                  {!userItem.isSelf && authUser && (
                    <button
                      onClick={() => handleFollowToggleInList(userItem)}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                        userItem.isFollowing
                          ? 'border border-[#2f3336] text-white hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 group/btn'
                          : 'bg-white text-black hover:bg-[#e6e6e6]'
                      }`}
                    >
                      {userItem.isFollowing ? (
                        <>
                          <span className="group-hover/btn:hidden">Following</span>
                          <span className="hidden group-hover/btn:inline">Unfollow</span>
                        </>
                      ) : (
                        'Follow'
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {followListLoading && (
            <div className="flex justify-center py-4">
              <ArrowPathIcon className="h-5 w-5 text-[#1d9bf0] animate-spin" />
            </div>
          )}

          {followListHasMore && !followListLoading && (
            <button
              onClick={loadMoreFollowList}
              className="w-full text-center text-sm font-bold text-[#1d9bf0] hover:underline py-2 block"
            >
              Load more
            </button>
          )}
        </div>
      </Modal>
    </>
  )
}

export default Profile

