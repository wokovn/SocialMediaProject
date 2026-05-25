import path from 'node:path';
import { eq } from 'drizzle-orm';
import db from '../db/db.js';
import { media, users } from '../db/schemas/index.js';
import storageService, {
  STORAGE_BUCKETS,
} from '../../infra/storage/storage.service.js';
import {
  mediaCleanupQueue,
  mediaResizeQueue,
} from '../../infra/queue/media.queue.js';
import {
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  TMP_PREFIX,
  POST_MEDIA_PREFIX,
  PROFILE_PICTURE_PREFIX,
  buildPrefixedStoragePath,
  isPathWithinPrefix,
  sanitizeFileName,
  toIntegerOrNull,
  inferMediaType,
  inferMediaTypeFromMime,
  extensionFromMimeType,
  buildPostMediaPath,
  buildProfilePicturePath,
  normalizeMediaAttachment,
  buildVariantPath,
  resolveImageVariantUrls,
  buildLocationKey,
} from './media.helpers.js';
import {
  processResizeJob,
  cleanupOrphanedMedia,
} from './media.jobs.js';

const enqueueResizeJob = async ({
  mediaId,
  mediaType,
  storageBucket,
  storagePath,
  userId,
  postId,
  targetKind = 'post',
}) => {
  return mediaResizeQueue.add(
    'media-resize',
    {
      mediaId,
      mediaType,
      storageBucket,
      storagePath,
      userId,
      postId,
      targetKind,
    },
    {
      removeOnComplete: true,
      removeOnFail: 500,
    },
  );
};

const MediaService = {
  async uploadTempMedia({
    userId,
    fileBuffer,
    originalName,
    mimeType,
    fileSize,
  }) {
    if (!storageService.isStorageConfigured()) {
      throw new Error(
        'Storage is not configured for media uploads. Set SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    if (!userId) {
      throw new Error('User ID is required for media upload.');
    }

    if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
      throw new Error('Uploaded file payload is empty.');
    }

    const mimeInferredType = inferMediaTypeFromMime(mimeType);
    const mediaType = inferMediaType(mimeInferredType, originalName || '');
    if (!mediaType) {
      throw new Error('Only image and video uploads are supported.');
    }

    // Strict validation to only allow very common formats
    const uploadExt = path.posix.extname(originalName || '').toLowerCase();
    const isAllowedImage = IMAGE_EXTENSIONS.has(uploadExt) || ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType?.toLowerCase());
    const isAllowedVideo = VIDEO_EXTENSIONS.has(uploadExt) || ['video/mp4', 'video/webm'].includes(mimeType?.toLowerCase());

    if (!isAllowedImage && !isAllowedVideo) {
      throw new Error('Only very common image formats (.jpg, .jpeg, .png, .webp) and video formats (.mp4, .webm) are allowed.');
    }

    const sourceName =
      typeof originalName === 'string' && originalName.trim()
        ? originalName.trim()
        : `${mediaType}-upload`;

    const sourceExtension = path.posix.extname(sourceName).toLowerCase();
    const extension =
      sourceExtension || extensionFromMimeType(mimeType, mediaType);
    const baseName =
      sanitizeFileName(path.posix.basename(sourceName, sourceExtension)) ||
      `${mediaType}-upload`;
    const uniqueSegment = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const storagePath = buildPrefixedStoragePath({
      prefix: TMP_PREFIX,
      path: `${userId}/${uniqueSegment}-${baseName}${extension}`,
    });

    await storageService.uploadBuffer({
      bucket: STORAGE_BUCKETS.TMP,
      storagePath,
      buffer: fileBuffer,
      contentType: mimeType || undefined,
      upsert: false,
    });

    const publicUrl = storageService.getPublicUrl({
      bucket: STORAGE_BUCKETS.TMP,
      path: storagePath,
    });
    if (!publicUrl) {
      throw new Error('Failed to resolve public URL for uploaded media.');
    }

    return {
      storageBucket: STORAGE_BUCKETS.TMP,
      storagePath,
      url: publicUrl,
      mediaType,
      fileSize: toIntegerOrNull(fileSize) ?? fileBuffer.length,
    };
  },

  getImageVariantUrls({
    storageBucket,
    storagePath,
    url,
    userId,
    postId,
    targetKind = 'post',
  } = {}) {
    return resolveImageVariantUrls({
      storageBucket,
      storagePath,
      url,
      userId,
      postId,
      targetKind,
    });
  },

  async finalizePostMediaAttachments({ userId, postId, mediaAttachments = [] }) {
    if (!storageService.isStorageConfigured()) {
      throw new Error(
        'Storage is not configured for media finalization. Set SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    const normalizedMedia = mediaAttachments
      .map((item, index) => normalizeMediaAttachment(item, index))
      .filter(Boolean)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    const finalizedMedia = [];
    const destinationBucket = STORAGE_BUCKETS.POST_MEDIA;

    for (const [index, item] of normalizedMedia.entries()) {
      const shouldKeepCurrentLocation =
        item.sourceBucket === destinationBucket &&
        isPathWithinPrefix({
          path: item.sourcePath,
          prefix: POST_MEDIA_PREFIX,
        });

      const destinationPath = shouldKeepCurrentLocation
        ? item.sourcePath
        : buildPostMediaPath({
            userId,
            postId,
            sourcePath: item.sourcePath,
            index,
          });

      if (
        item.sourceBucket !== destinationBucket ||
        item.sourcePath !== destinationPath
      ) {
        await storageService.moveObject({
          fromBucket: item.sourceBucket,
          fromPath: item.sourcePath,
          toBucket: destinationBucket,
          toPath: destinationPath,
        });
      }

      const publicUrl = storageService.getPublicUrl({
        bucket: destinationBucket,
        path: destinationPath,
      });
      if (!publicUrl) {
        throw new Error(
          `Unable to resolve public URL for ${destinationBucket}/${destinationPath}`,
        );
      }

      finalizedMedia.push({
        ...item,
        storageBucket: destinationBucket,
        storagePath: destinationPath,
        url: publicUrl,
        displayOrder: item.displayOrder,
      });
    }

    return finalizedMedia;
  },

  async enqueuePostMediaResizeJobs(mediaRows = []) {
    for (const row of mediaRows) {
      const location = storageService.resolveStorageLocation({
        storageBucket: row.storageBucket,
        storagePath: row.storagePath,
        url: row.url,
        fallbackBucket: STORAGE_BUCKETS.POST_MEDIA,
      });

      if (!location) {
        continue;
      }

      await enqueueResizeJob({
        mediaId: row.id,
        mediaType: row.mediaType,
        storageBucket: location.bucket,
        storagePath: location.path,
        userId: row.userId,
        postId: row.postId,
        targetKind: 'post',
      });
    }
  },

  async finalizeProfilePicture({ userId, storageBucket, storagePath, url }) {
    if (!storageService.isStorageConfigured()) {
      throw new Error(
        'Storage is not configured for profile pictures. Set SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    const sourceLocation = storageService.resolveStorageLocation({
      storageBucket,
      storagePath,
      url,
      fallbackBucket: STORAGE_BUCKETS.TMP,
    });

    if (!sourceLocation) {
      throw new Error(
        'storageBucket + storagePath (or url) are required to finalize profile picture.',
      );
    }

    const mediaType = inferMediaType('image', sourceLocation.path);
    if (mediaType !== 'image') {
      throw new Error('Profile picture must be an image file.');
    }

    const destinationBucket = STORAGE_BUCKETS.PROFILE_PICTURE;
    const shouldKeepCurrentLocation =
      sourceLocation.bucket === destinationBucket &&
      isPathWithinPrefix({
        path: sourceLocation.path,
        prefix: PROFILE_PICTURE_PREFIX,
      });

    const destinationPath =
      shouldKeepCurrentLocation
        ? sourceLocation.path
        : buildProfilePicturePath({ userId, sourcePath: sourceLocation.path });

    if (
      sourceLocation.bucket !== destinationBucket ||
      sourceLocation.path !== destinationPath
    ) {
      await storageService.moveObject({
        fromBucket: sourceLocation.bucket,
        fromPath: sourceLocation.path,
        toBucket: destinationBucket,
        toPath: destinationPath,
      });
    }

    const avatarUrl = storageService.getPublicUrl({
      bucket: destinationBucket,
      path: destinationPath,
    });
    if (!avatarUrl) {
      throw new Error('Failed to resolve public URL for profile picture.');
    }

    const [existingUser] = await db
      .select({ avatar: users.avatar })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    await db
      .update(users)
      .set({ avatar: avatarUrl, updatedAt: new Date() })
      .where(eq(users.id, userId));

    const previousAvatarLocation = storageService.resolveStorageLocation({
      url: existingUser?.avatar,
    });

    if (
      previousAvatarLocation &&
      previousAvatarLocation.bucket === destinationBucket &&
      buildLocationKey(previousAvatarLocation) !==
        buildLocationKey({ bucket: destinationBucket, path: destinationPath })
    ) {
      storageService
        .removeObjects({
          bucket: previousAvatarLocation.bucket,
          paths: [previousAvatarLocation.path],
        })
        .catch((error) => {
          console.warn('[media] Failed to remove old avatar:', error.message);
        });
    }

    await enqueueResizeJob({
      mediaType: 'image',
      storageBucket: destinationBucket,
      storagePath: destinationPath,
      userId,
      targetKind: 'profile_picture',
    });

    return {
      avatarUrl,
      storageBucket: destinationBucket,
      storagePath: destinationPath,
    };
  },

  processResizeJob,

  async scheduleCleanupJob({ triggeredBy = null } = {}) {
    return mediaCleanupQueue.add(
      'media-cleanup',
      { triggeredBy },
      {
        removeOnComplete: true,
        removeOnFail: 200,
      },
    );
  },

  cleanupOrphanedMedia,
};

export default MediaService;