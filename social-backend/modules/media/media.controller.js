import MediaService from './media.service.js';

const MediaController = {
  uploadTempMedia: async (req, res) => {
    const userId = req.user?.sub;
    const file = req.file;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!file) {
      return res.status(400).json({ message: 'file is required.' });
    }

    try {
      const result = await MediaService.uploadTempMedia({
        userId,
        fileBuffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
      });

      return res.status(201).json({
        message: 'Media uploaded successfully',
        ...result,
      });
    } catch (error) {
      console.error('[media] uploadTempMedia failed:', error);
      const normalizedMessage = error.message || 'Failed to upload media.';
      const isClientError = /required|empty|supported/i.test(normalizedMessage);

      return res.status(isClientError ? 400 : 500).json({
        message: error.message || 'Failed to upload media.',
      });
    }
  },

  finalizeProfilePicture: async (req, res) => {
    const userId = req.user?.sub;
    const { storageBucket, storagePath, url } = req.body || {};

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!storagePath && !url) {
      return res
        .status(400)
        .json({ message: 'storagePath or url is required.' });
    }

    try {
      const result = await MediaService.finalizeProfilePicture({
        userId,
        storageBucket,
        storagePath,
        url,
      });

      return res.status(200).json({
        message: 'Profile picture updated successfully',
        ...result,
      });
    } catch (error) {
      console.error('[media] finalizeProfilePicture failed:', error);
      return res.status(500).json({
        message: error.message || 'Failed to finalize profile picture.',
      });
    }
  },

  triggerCleanup: async (req, res) => {
    const triggeredBy = req.user?.sub || null;

    try {
      const job = await MediaService.scheduleCleanupJob({ triggeredBy });
      return res.status(202).json({
        message: 'Media cleanup job scheduled',
        jobId: job.id,
      });
    } catch (error) {
      console.error('[media] triggerCleanup failed:', error);
      return res
        .status(500)
        .json({ message: error.message || 'Failed to schedule cleanup job.' });
    }
  },
};

export default MediaController;