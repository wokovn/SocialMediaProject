import UsersService from './users.service.js';

const normalizeUsersError = (error = null) => {
  const message = error?.message || 'Request failed.';

  if (/not found/i.test(message)) {
    return { status: 404, message };
  }

  if (/cannot|missing/i.test(message)) {
    return { status: 400, message };
  }

  return { status: 500, message };
};

const UsersController = {
  async checkUsername(req, res) {
    const username = req.query?.username;

    try {
      const result = await UsersService.checkUsernameAvailability({ username });

      if (!result.available) {
        return res.status(200).json(result);
      }

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
