import UsersService from './users.service.js';
import MediaService from '../media/media.service.js';
import { STORAGE_BUCKETS } from '../../infra/storage/storage.service.js';
import storageService from '../../infra/storage/storage.service.js';

const normalizeUsersError = (error = null) => {
  const message = error?.message || 'Request failed.';

  if (/not found/i.test(message)) {
    return { status: 404, message };
  }

  if (/cannot|missing|required|invalid|taken/i.test(message)) {
    return { status: 400, message };
  }

  return { status: 500, message };
};

const UsersController = {
  async checkUsername(req, res) {
    const username = req.query?.username;

    try {
      const result = await UsersService.checkUsernameAvailability({ username });
      return res.status(200).json(result);
    } catch (error) {
      console.error('[users] checkUsername failed:', error);
      const normalized = normalizeUsersError(error);
      return res.status(normalized.status).json({ message: normalized.message });
    }
  },

  async getMe(req, res) {
    const userId = req.user?.sub;
    const email = req.user?.email || null;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const profile = await UsersService.getMyProfile({ userId, email });
      return res.status(200).json(profile);
    } catch (error) {
      console.error('[users] getMe failed:', error);
      return res
        .status(500)
        .json({ message: error.message || 'Failed to load profile.' });
    }
  },

  async updateMe(req, res) {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { fullName, username, bio, website, showEmail } = req.body;

    try {
      const profile = await UsersService.updateProfile({
        userId,
        fullName,
        username,
        bio,
        website,
        showEmail,
      });
      return res.status(200).json(profile);
    } catch (error) {
      console.error('[users] updateMe failed:', error);
      const normalized = normalizeUsersError(error);
      return res.status(normalized.status).json({ message: normalized.message });
    }
  },

  async uploadBanner(req, res) {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { storageBucket, storagePath, url } = req.body;
    if (!storagePath && !url) {
      return res.status(400).json({ message: 'storagePath or url is required.' });
    }

    try {
      // Resolve the location of the uploaded temp file
      const sourceLocation = storageService.resolveStorageLocation({
        storageBucket,
        storagePath,
        url,
        fallbackBucket: STORAGE_BUCKETS.TMP,
      });

      if (!sourceLocation) {
        return res.status(400).json({ message: 'Invalid storage location.' });
      }

      // Move to permanent location (reuse post_media bucket, banner prefix)
      const destPath = `profile_picture/${userId}/banner-${Date.now()}.jpg`;
      const destBucket = STORAGE_BUCKETS.POST_MEDIA;

      await storageService.moveObject({
        fromBucket: sourceLocation.bucket,
        fromPath: sourceLocation.path,
        toBucket: destBucket,
        toPath: destPath,
      });

      const bannerUrl = storageService.getPublicUrl({ bucket: destBucket, path: destPath });
      if (!bannerUrl) {
        return res.status(500).json({ message: 'Failed to resolve banner URL.' });
      }

      const profile = await UsersService.updateBanner({ userId, bannerUrl });
      return res.status(200).json({ bannerUrl, profile });
    } catch (error) {
      console.error('[users] uploadBanner failed:', error);
      const normalized = normalizeUsersError(error);
      return res.status(normalized.status).json({ message: normalized.message });
    }
  },

  async getProfile(req, res) {
    const viewerUserId = req.user?.sub;
    const targetUserId = req.params.userId;

    if (!viewerUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const profile = await UsersService.getProfileById({
        targetUserId,
        viewerUserId,
      });

      if (!profile) {
        return res.status(404).json({ message: 'User not found.' });
      }

      return res.status(200).json(profile);
    } catch (error) {
      console.error('[users] getProfile failed:', error);
      const normalized = normalizeUsersError(error);
      return res.status(normalized.status).json({ message: normalized.message });
    }
  },

  async getProfileByUsername(req, res) {
    const viewerUserId = req.user?.sub;
    const username = req.params.username;

    if (!viewerUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const profile = await UsersService.getProfileByUsername({
        username,
        viewerUserId,
      });

      if (!profile) {
        return res.status(404).json({ message: 'User not found.' });
      }

      return res.status(200).json(profile);
    } catch (error) {
      console.error('[users] getProfileByUsername failed:', error);
      const normalized = normalizeUsersError(error);
      return res.status(normalized.status).json({ message: normalized.message });
    }
  },

  async getRelationship(req, res) {
    const viewerUserId = req.user?.sub;
    const targetUserId = req.params.userId;

    if (!viewerUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const relationship = await UsersService.getFollowRelationship({
        viewerUserId,
        targetUserId,
      });

      return res.status(200).json(relationship);
    } catch (error) {
      console.error('[users] getRelationship failed:', error);
      const normalized = normalizeUsersError(error);
      return res.status(normalized.status).json({ message: normalized.message });
    }
  },

  async getFollowers(req, res) {
    const viewerUserId = req.user?.sub;
    const targetUserId = req.params.userId;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const cursor = req.query.cursor || null;

    if (!viewerUserId) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const followers = await UsersService.getFollowers({ targetUserId, viewerUserId, limit, cursor });
      return res.status(200).json(followers);
    } catch (error) {
      console.error('[users] getFollowers failed:', error);
      const normalized = normalizeUsersError(error);
      return res.status(normalized.status).json({ message: normalized.message });
    }
  },

  async getFollowing(req, res) {
    const viewerUserId = req.user?.sub;
    const targetUserId = req.params.userId;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const cursor = req.query.cursor || null;

    if (!viewerUserId) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const following = await UsersService.getFollowing({ targetUserId, viewerUserId, limit, cursor });
      return res.status(200).json(following);
    } catch (error) {
      console.error('[users] getFollowing failed:', error);
      const normalized = normalizeUsersError(error);
      return res.status(normalized.status).json({ message: normalized.message });
    }
  },

  async search(req, res) {
    const viewerUserId = req.user?.sub;
    const query = req.query.q || '';
    const filter = req.query.filter || 'all'; // 'all' | 'users' | 'posts'
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    if (!viewerUserId) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const results = await UsersService.search({ query, filter, limit, viewerUserId });
      return res.status(200).json(results);
    } catch (error) {
      console.error('[users] search failed:', error);
      return res.status(500).json({ message: error.message || 'Search failed.' });
    }
  },

  async followUser(req, res) {
    const followerId = req.user?.sub;
    const followingId = req.params.userId;

    if (!followerId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const profile = await UsersService.followUser({
        followerId,
        followingId,
      });

      return res.status(200).json({
        message: 'User followed successfully',
        profile,
      });
    } catch (error) {
      console.error('[users] followUser failed:', error);
      const normalized = normalizeUsersError(error);
      return res.status(normalized.status).json({ message: normalized.message });
    }
  },

  async unfollowUser(req, res) {
    const followerId = req.user?.sub;
    const followingId = req.params.userId;

    if (!followerId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const profile = await UsersService.unfollowUser({
        followerId,
        followingId,
      });

      return res.status(200).json({
        message: 'User unfollowed successfully',
        profile,
      });
    } catch (error) {
      console.error('[users] unfollowUser failed:', error);
      const normalized = normalizeUsersError(error);
      return res.status(normalized.status).json({ message: normalized.message });
    }
  },
};

export default UsersController;
