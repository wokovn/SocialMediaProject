import path from 'node:path';
import { eq } from 'drizzle-orm';
import db from '../db/db.js';
import { media, users } from '../db/schemas/index.js';
import storageService, {
  STORAGE_BUCKETS,
  STORAGE_PATH_PREFIXES,
} from '../../infra/storage/storage.service.js';
import ffmpegService from '../../infra/media/ffmpeg.service.js';
import {
  mediaCleanupQueue,
  mediaResizeQueue,
} from '../../infra/queue/media.queue.js';

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.avif',
]);

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.webm',
  '.mkv',
  '.m4v',
]);

const TMP_TTL_MINUTES = Number(process.env.MEDIA_TMP_TTL_MINUTES) || 180;
const ORPHAN_GRACE_MINUTES = Number(process.env.MEDIA_ORPHAN_GRACE_MINUTES) || 30;
const CLEANUP_DELETE_BATCH_SIZE =
  Number(process.env.MEDIA_CLEANUP_DELETE_BATCH_SIZE) || 100;
const IMAGE_VARIANT_SMALL_SIZE =
  Number(process.env.MEDIA_IMAGE_VARIANT_SMALL_SIZE) || 480;
const IMAGE_VARIANT_MAX_SIZE =
  Number(process.env.MEDIA_IMAGE_VARIANT_MAX_SIZE) || 960;
const IMAGE_VARIANT_HIGH_SIZE =
  Number(process.env.MEDIA_IMAGE_VARIANT_HIGH_SIZE) || 1440;
const VIDEO_THUMBNAIL_MAX_SIZE =
  Number(process.env.MEDIA_VIDEO_THUMBNAIL_MAX_SIZE) || 960;
const VIDEO_THUMBNAIL_SEEK_SECONDS =
  Number(process.env.MEDIA_VIDEO_THUMBNAIL_SEEK_SECONDS) || 0.5;

const IMAGE_VARIANT_PRESETS = Object.freeze([
  { label: 'small', maxSize: IMAGE_VARIANT_SMALL_SIZE },
  { label: 'medium', maxSize: IMAGE_VARIANT_MAX_SIZE },
  { label: 'high', maxSize: IMAGE_VARIANT_HIGH_SIZE },
]);

const TMP_PREFIX = STORAGE_PATH_PREFIXES.TMP;
const POST_MEDIA_PREFIX = STORAGE_PATH_PREFIXES.POST_MEDIA;
const PROFILE_PICTURE_PREFIX = STORAGE_PATH_PREFIXES.PROFILE_PICTURE;
const POST_MEDIA_VARIANTS_PREFIX = STORAGE_PATH_PREFIXES.POST_MEDIA_VARIANTS;

const buildPrefixedStoragePath = ({ prefix, path }) => {
  return storageService.buildPrefixedPath({ prefix, path });
};

const isPathWithinPrefix = ({ path, prefix }) => {
  return storageService.isPathWithinPrefix({ path, prefix });
};

const sanitizeFileName = (name = '') =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const toIntegerOrNull = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const inferMediaType = (mediaType, storagePath = '') => {
  if (mediaType === 'image' || mediaType === 'video') {
    return mediaType;
  }

  const extension = path.posix.extname(storagePath).toLowerCase();

  if (IMAGE_EXTENSIONS.has(extension)) {
    return 'image';
  }

  if (VIDEO_EXTENSIONS.has(extension)) {
    return 'video';
  }

  return null;
};

const inferMediaTypeFromMime = (mimeType = '') => {
  if (typeof mimeType !== 'string') {
    return null;
  }

  if (mimeType.startsWith('image/')) {
    return 'image';
  }

  if (mimeType.startsWith('video/')) {
    return 'video';
  }

  return null;
};

const extensionFromMimeType = (mimeType = '', mediaType = null) => {
  const mime = typeof mimeType === 'string' ? mimeType.toLowerCase() : '';

  const extensionMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'video/x-matroska': '.mkv',
  };

  if (extensionMap[mime]) {
    return extensionMap[mime];
  }

  if (mediaType === 'image') {
    return '.jpg';
  }

  if (mediaType === 'video') {
    return '.mp4';
  }

  return '.bin';
};

const buildPostMediaPath = ({ userId, postId, sourcePath, index }) => {
  const extension = path.posix.extname(sourcePath) || '.bin';
  const baseName =
    sanitizeFileName(path.posix.basename(sourcePath, extension)) || 'media';

  return buildPrefixedStoragePath({
    prefix: POST_MEDIA_PREFIX,
    path: `${userId}/${postId}/${Date.now()}-${index}-${baseName}${extension}`,
  });
};

const buildProfilePicturePath = ({ userId, sourcePath }) => {
  const extension = path.posix.extname(sourcePath) || '.jpg';
  return buildPrefixedStoragePath({
    prefix: PROFILE_PICTURE_PREFIX,
    path: `${userId}/avatar-${Date.now()}${extension}`,
  });
};

const normalizeMediaAttachment = (item, index) => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const sourceLocation = storageService.resolveStorageLocation({
    storageBucket: item.storageBucket,
    storagePath: item.storagePath,
    url: item.url,
    fallbackBucket: STORAGE_BUCKETS.TMP,
  });

  if (!sourceLocation) {
    return null;
  }

  const mediaType = inferMediaType(item.mediaType, sourceLocation.path);
  if (!mediaType) {
    return null;
  }

  return {
    sourceBucket: sourceLocation.bucket,
    sourcePath: sourceLocation.path,
    mediaType,
    fileSize: toIntegerOrNull(item.fileSize),
    width: toIntegerOrNull(item.width),
    height: toIntegerOrNull(item.height),
    duration: toIntegerOrNull(item.duration),
    thumbnailUrl:
      typeof item.thumbnailUrl === 'string' && item.thumbnailUrl.trim()
        ? item.thumbnailUrl.trim()
        : null,
    altText:
      typeof item.altText === 'string' && item.altText.trim()
        ? item.altText.trim().slice(0, 255)
        : null,
    displayOrder: Number.isInteger(item.displayOrder) ? item.displayOrder : index,
  };
};

const chunkArray = (items = [], size = 100) => {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

const isOlderThan = (timestamp, ageMs) => {
  if (!timestamp) {
    return false;
  }

  const value = new Date(timestamp).getTime();
  if (Number.isNaN(value)) {
    return false;
  }

  return Date.now() - value >= ageMs;
};

const removePathsInChunks = async ({ bucket, paths = [] }) => {
  const chunks = chunkArray(paths, CLEANUP_DELETE_BATCH_SIZE);
  let removedCount = 0;

  for (const chunk of chunks) {
    const removed = await storageService.removeObjects({ bucket, paths: chunk });
    removedCount += removed.length;
  }

  return removedCount;
};

const buildVariantPath = ({
  storagePath,
  userId,
  postId,
  targetKind,
  suffix = 'preview',
  extension = '.jpg',
}) => {
  const normalizedExt = extension.startsWith('.') ? extension : `.${extension}`;
  const sourceExt = path.posix.extname(storagePath) || '.bin';
  const baseName =
    sanitizeFileName(path.posix.basename(storagePath, sourceExt)) || 'media';

  if (targetKind === 'profile_picture') {
    return buildPrefixedStoragePath({
      prefix: PROFILE_PICTURE_PREFIX,
      path: `${userId || 'unknown'}/${baseName}-${suffix}${normalizedExt}`,
    });
  }

  return buildPrefixedStoragePath({
    prefix: POST_MEDIA_VARIANTS_PREFIX,
    path: `${userId || 'unknown'}/${postId || 'shared'}/${baseName}-${suffix}${normalizedExt}`,
  });
};

const stripStoragePrefix = ({ storagePath, prefix }) => {
  const normalizedPath = storageService.normalizeStoragePath(storagePath);
  const normalizedPrefix = storageService.normalizeStoragePrefix(prefix);

  if (!normalizedPath) {
    return '';
  }

  if (!normalizedPrefix) {
    return normalizedPath;
  }

  if (normalizedPath === normalizedPrefix) {
    return '';
  }

  if (normalizedPath.startsWith(`${normalizedPrefix}/`)) {
    return normalizedPath.slice(normalizedPrefix.length + 1);
  }

  return normalizedPath;
};

const parsePostMediaOwner = ({ storagePath }) => {
  const relativePath = stripStoragePrefix({
    storagePath,
    prefix: POST_MEDIA_PREFIX,
  });

  const [userId, postId] = relativePath.split('/');
  return {
    userId: userId || null,
    postId: postId || null,
  };
};

const parseProfilePictureOwner = ({ storagePath }) => {
  const relativePath = stripStoragePrefix({
    storagePath,
    prefix: PROFILE_PICTURE_PREFIX,
  });

  const [userId] = relativePath.split('/');
  return {
    userId: userId || null,
    postId: null,
  };
};

const resolveImageVariantUrls = ({
  storageBucket,
  storagePath,
  url,
  userId,
  postId,
  targetKind = 'post',
} = {}) => {
  const sourceLocation = storageService.resolveStorageLocation({
    storageBucket,
    storagePath,
    url,
    fallbackBucket:
      targetKind === 'profile_picture'
        ? STORAGE_BUCKETS.PROFILE_PICTURE
        : STORAGE_BUCKETS.POST_MEDIA,
  });

  if (!sourceLocation) {
    return null;
  }

  const ownerInfo =
    targetKind === 'post'
      ? parsePostMediaOwner({ storagePath: sourceLocation.path })
      : parseProfilePictureOwner({ storagePath: sourceLocation.path });

  const resolvedUserId = userId || ownerInfo.userId;
  const resolvedPostId = postId || ownerInfo.postId;

  const variants = {};

  const presets = targetKind === 'profile_picture'
    ? IMAGE_VARIANT_PRESETS.filter(p => p.label !== 'high')
    : IMAGE_VARIANT_PRESETS;

  for (const preset of presets) {
    const variantPath = buildVariantPath({
      storagePath: sourceLocation.path,
      userId: resolvedUserId,
      postId: resolvedPostId,
      targetKind,
      suffix: preset.label,
      extension: '.jpg',
    });

    variants[preset.label] =
      storageService.getPublicUrl({
        bucket:
          targetKind === 'profile_picture'
            ? STORAGE_BUCKETS.PROFILE_PICTURE
            : STORAGE_BUCKETS.POST_MEDIA_VARIANTS,
        path: variantPath,
      }) || null;
  }

  return variants;
};

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

const updateMediaMetadata = async ({ mediaId, values = {} }) => {
  if (!mediaId) {
    return;
  }

  const updatePayload = Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  );

  if (!Object.keys(updatePayload).length) {
    return;
  }

  await db.update(media).set(updatePayload).where(eq(media.id, mediaId));
};

const buildLocationKey = ({ bucket, path }) => {
  return storageService.buildStorageKey({ bucket, path });
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

  async processResizeJob({
    mediaId,
    mediaType,
    storageBucket,
    storagePath,
    userId,
    postId,
    targetKind = 'post',
  }) {
    if (!storageService.isStorageConfigured()) {
      return {
        success: false,
        skipped: true,
        reason: 'Storage not configured',
      };
    }

    const sourceLocation = storageService.resolveStorageLocation({
      storageBucket,
      storagePath,
      fallbackBucket:
        targetKind === 'profile_picture'
          ? STORAGE_BUCKETS.PROFILE_PICTURE
          : STORAGE_BUCKETS.POST_MEDIA,
    });

    if (!sourceLocation) {
      return {
        success: false,
        skipped: true,
        reason: 'Missing storage bucket/path',
      };
    }

    const sourceUrl = storageService.getPublicUrl({
      bucket: sourceLocation.bucket,
      path: sourceLocation.path,
    });
    if (!sourceUrl) {
      return {
        success: false,
        skipped: true,
        reason: 'Failed to resolve source URL',
      };
    }

    let sourceProbe = null;
    try {
      sourceProbe = await ffmpegService.probeMedia(sourceUrl);
    } catch (error) {
      console.warn('[media-resize] ffprobe failed:', error.message);
    }

    const fallbackProcess = async (reason = 'ffmpeg unavailable') => {
      const variantBucket =
        targetKind === 'profile_picture'
          ? STORAGE_BUCKETS.PROFILE_PICTURE
          : STORAGE_BUCKETS.POST_MEDIA_VARIANTS;

      let fallbackUrl = sourceUrl;
      let variantPath = null;
      let variantUrls = null;

      if (mediaType === 'image' && targetKind === 'post') {
        variantUrls = {};

        for (const preset of IMAGE_VARIANT_PRESETS) {
          const presetPath = buildVariantPath({
            storagePath: sourceLocation.path,
            userId,
            postId,
            targetKind,
            suffix: preset.label,
            extension: '.jpg',
          });

          try {
            await storageService.copyObject({
              fromBucket: sourceLocation.bucket,
              fromPath: sourceLocation.path,
              toBucket: variantBucket,
              toPath: presetPath,
            });
          } catch (error) {
            console.warn(
              `[media-resize] Fallback copy for ${preset.label} failed:`,
              error.message,
            );
          }

          variantUrls[preset.label] =
            storageService.getPublicUrl({
              bucket: variantBucket,
              path: presetPath,
            }) || sourceUrl;
        }

        fallbackUrl =
          variantUrls.medium ||
          variantUrls.small ||
          variantUrls.high ||
          sourceUrl;
        variantPath = buildVariantPath({
          storagePath: sourceLocation.path,
          userId,
          postId,
          targetKind,
          suffix: 'medium',
          extension: '.jpg',
        });
      } else {
        variantPath = null;
        fallbackUrl = sourceUrl;
      }

      if (mediaId) {
        await updateMediaMetadata({
          mediaId,
          values: {
            width: sourceProbe?.width ?? null,
            height: sourceProbe?.height ?? null,
            duration: mediaType === 'video' ? sourceProbe?.duration ?? null : null,
            fileSize: sourceProbe?.size ?? undefined,
            thumbnailUrl: mediaType === 'image' ? fallbackUrl : undefined,
          },
        });
      }

      if (targetKind === 'profile_picture' && userId && fallbackUrl) {
        await db
          .update(users)
          .set({ avatar: fallbackUrl, updatedAt: new Date() })
          .where(eq(users.id, userId));
      }

      return {
        success: true,
        mediaId,
        mediaType,
        sourceBucket: sourceLocation.bucket,
        storagePath: sourceLocation.path,
        variantBucket,
        variantPath,
        variantUrl: fallbackUrl,
        variantUrls,
        targetKind,
        fallback: true,
        reason,
      };
    };

    const ffmpegAvailable = await ffmpegService.isAvailable();
    if (!ffmpegAvailable) {
      return fallbackProcess('ffmpeg or ffprobe is unavailable');
    }

    const artifacts = [];
    let variantPath = null;
    let variantUrl = null;
    let variantUrls = null;

    try {
      const variantBucket =
        targetKind === 'profile_picture'
          ? STORAGE_BUCKETS.PROFILE_PICTURE
          : STORAGE_BUCKETS.POST_MEDIA_VARIANTS;

      if (mediaType === 'video') {
        const artifact = await ffmpegService.createVideoThumbnail({
          inputPathOrUrl: sourceUrl,
          seekSeconds: VIDEO_THUMBNAIL_SEEK_SECONDS,
          maxSize: VIDEO_THUMBNAIL_MAX_SIZE,
        });
        artifacts.push(artifact);

        variantPath = buildVariantPath({
          storagePath: sourceLocation.path,
          userId,
          postId,
          targetKind,
          suffix: 'thumb',
          extension: '.jpg',
        });

        await storageService.uploadLocalFile({
          bucket: variantBucket,
          storagePath: variantPath,
          localFilePath: artifact.outputPath,
          contentType: 'image/jpeg',
          upsert: true,
        });

        variantUrl =
          storageService.getPublicUrl({ bucket: variantBucket, path: variantPath }) ||
          sourceUrl;
      } else {
        variantUrls = {};

        const presets = targetKind === 'profile_picture'
          ? IMAGE_VARIANT_PRESETS.filter(p => p.label !== 'high')
          : IMAGE_VARIANT_PRESETS;

        for (const preset of presets) {
          const artifact = await ffmpegService.createImageVariant({
            inputPathOrUrl: sourceUrl,
            maxSize: preset.maxSize,
          });
          artifacts.push(artifact);

          const presetPath = buildVariantPath({
            storagePath: sourceLocation.path,
            userId,
            postId,
            targetKind,
            suffix: preset.label,
            extension: '.jpg',
          });

          await storageService.uploadLocalFile({
            bucket: variantBucket,
            storagePath: presetPath,
            localFilePath: artifact.outputPath,
            contentType: 'image/jpeg',
            upsert: true,
          });

          variantUrls[preset.label] =
            storageService.getPublicUrl({
              bucket: variantBucket,
              path: presetPath,
            }) || sourceUrl;
        }

        variantPath = buildVariantPath({
          storagePath: sourceLocation.path,
          userId,
          postId,
          targetKind,
          suffix: 'medium',
          extension: '.jpg',
        });

        variantUrl =
          variantUrls.medium ||
          variantUrls.small ||
          variantUrls.high ||
          sourceUrl;
      }

      if (mediaId) {
        await updateMediaMetadata({
          mediaId,
          values: {
            width: sourceProbe?.width ?? null,
            height: sourceProbe?.height ?? null,
            duration: mediaType === 'video' ? sourceProbe?.duration ?? null : null,
            fileSize: sourceProbe?.size ?? undefined,
            thumbnailUrl: variantUrl,
          },
        });
      }

      if (targetKind === 'profile_picture' && userId && variantUrl) {
        await db
          .update(users)
          .set({ avatar: variantUrl, updatedAt: new Date() })
          .where(eq(users.id, userId));
      }

      return {
        success: true,
        mediaId,
        mediaType,
        sourceBucket: sourceLocation.bucket,
        storagePath: sourceLocation.path,
        variantBucket,
        variantPath,
        variantUrl,
        variantUrls,
        targetKind,
        ffmpeg: true,
      };
    } catch (error) {
      console.warn('[media-resize] ffmpeg pipeline failed:', error.message);
      return fallbackProcess(error.message);
    } finally {
      for (const artifact of artifacts) {
        if (artifact?.cleanup) {
          await artifact.cleanup();
        }
      }
    }
  },

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

  async cleanupOrphanedMedia() {
    if (!storageService.isStorageConfigured()) {
      return {
        success: false,
        skipped: true,
        reason: 'Storage not configured',
      };
    }

    const [mediaRows, usersRows] = await Promise.all([
      db
        .select({
          url: media.url,
          mediaType: media.mediaType,
          thumbnailUrl: media.thumbnailUrl,
        })
        .from(media),
      db.select({ avatar: users.avatar }).from(users),
    ]);

    const referencedPaths = new Set();

    for (const row of mediaRows) {
      const mediaLocation = storageService.resolveStorageLocation({ url: row.url });
      const thumbnailLocation = storageService.resolveStorageLocation({
        url: row.thumbnailUrl,
      });

      const mediaKey = mediaLocation ? buildLocationKey(mediaLocation) : null;
      const thumbnailKey = thumbnailLocation
        ? buildLocationKey(thumbnailLocation)
        : null;

      if (mediaKey) {
        referencedPaths.add(mediaKey);
      }

      if (thumbnailKey) {
        referencedPaths.add(thumbnailKey);
      }

      if (row.mediaType === 'image' && row.thumbnailUrl) {
        const variantUrls = resolveImageVariantUrls({
          url: row.url,
          targetKind: 'post',
        });

        for (const variantUrl of Object.values(variantUrls || {})) {
          const variantLocation = storageService.resolveStorageLocation({
            url: variantUrl,
          });
          const variantKey = variantLocation
            ? buildLocationKey(variantLocation)
            : null;

          if (variantKey) {
            referencedPaths.add(variantKey);
          }
        }
      }
    }

    for (const row of usersRows) {
      if (!row.avatar) continue;

      const avatarLocation = storageService.resolveStorageLocation({ url: row.avatar });
      const avatarKey = avatarLocation ? buildLocationKey(avatarLocation) : null;
      if (avatarKey) {
        referencedPaths.add(avatarKey);
      }

      const variantUrls = resolveImageVariantUrls({
        url: row.avatar,
        targetKind: 'profile_picture',
      });

      for (const variantUrl of Object.values(variantUrls || {})) {
        const variantLocation = storageService.resolveStorageLocation({
          url: variantUrl,
        });
        const variantKey = variantLocation ? buildLocationKey(variantLocation) : null;

        if (variantKey) {
          referencedPaths.add(variantKey);
        }
      }
    }

    const orphanScopes = [
      {
        bucket: STORAGE_BUCKETS.POST_MEDIA,
        prefix: storageService.normalizeStoragePrefix(POST_MEDIA_PREFIX),
      },
      {
        bucket: STORAGE_BUCKETS.PROFILE_PICTURE,
        prefix: storageService.normalizeStoragePrefix(PROFILE_PICTURE_PREFIX),
      },
      {
        bucket: STORAGE_BUCKETS.POST_MEDIA_VARIANTS,
        prefix: storageService.normalizeStoragePrefix(POST_MEDIA_VARIANTS_PREFIX),
      },
    ];

    const orphanCutoffMs = ORPHAN_GRACE_MINUTES * 60 * 1000;
    const tmpCutoffMs = TMP_TTL_MINUTES * 60 * 1000;

    const orphanedByBucket = new Map();
    const scannedScopes = new Set();

    const pushOrphanPath = (bucket, pathValue) => {
      if (!orphanedByBucket.has(bucket)) {
        orphanedByBucket.set(bucket, new Set());
      }

      orphanedByBucket.get(bucket).add(pathValue);
    };

    for (const scope of orphanScopes) {
      const scopeBucket = scope.bucket;
      const scopePrefix = scope.prefix;
      const scopeKey = `${scopeBucket}:${scopePrefix}`;

      if (scannedScopes.has(scopeKey)) {
        continue;
      }
      scannedScopes.add(scopeKey);

      const files = await storageService.listAllObjects({
        bucket: scopeBucket,
        prefix: scopePrefix,
      });

      for (const file of files) {
        const fileKey = buildLocationKey({
          bucket: scopeBucket,
          path: file.path,
        });
        if (fileKey && referencedPaths.has(fileKey)) {
          continue;
        }

        const timestamp = file.updated_at || file.created_at || file.last_accessed_at;
        if (isOlderThan(timestamp, orphanCutoffMs)) {
          pushOrphanPath(scopeBucket, file.path);
        }
      }
    }

    const tmpBucket = STORAGE_BUCKETS.TMP;
    const tmpPrefix = storageService.normalizeStoragePrefix(TMP_PREFIX);
    const tmpFiles = await storageService.listAllObjects({
      bucket: tmpBucket,
      prefix: tmpPrefix,
    });
    const tmpPaths = tmpFiles
      .filter((file) => {
        const timestamp = file.updated_at || file.created_at || file.last_accessed_at;
        return isOlderThan(timestamp, tmpCutoffMs);
      })
      .map((file) => file.path);

    const removedTmpCount = await removePathsInChunks({
      bucket: tmpBucket,
      paths: tmpPaths,
    });

    let removedOrphanedCount = 0;
    let orphanCandidates = 0;

    for (const [bucket, pathSet] of orphanedByBucket.entries()) {
      const paths = [...pathSet];
      orphanCandidates += paths.length;
      removedOrphanedCount += await removePathsInChunks({ bucket, paths });
    }

    return {
      success: true,
      removedTmpCount,
      removedOrphanedCount,
      scanned: {
        tmpFiles: tmpFiles.length,
        orphanCandidates,
      },
    };
  },
};

export default MediaService;