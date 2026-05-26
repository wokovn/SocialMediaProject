import { eq } from 'drizzle-orm';
import db from '../db/db.js';
import { media, users } from '../db/schemas/index.js';
import storageService, {
  STORAGE_BUCKETS,
} from '../../infra/storage/storage.service.js';
import ffmpegService from '../../infra/media/ffmpeg.service.js';
import {
  IMAGE_VARIANT_PRESETS,
  VIDEO_THUMBNAIL_SEEK_SECONDS,
  VIDEO_THUMBNAIL_MAX_SIZE,
  ORPHAN_GRACE_MINUTES,
  TMP_TTL_MINUTES,
  POST_MEDIA_PREFIX,
  PROFILE_PICTURE_PREFIX,
  POST_MEDIA_VARIANTS_PREFIX,
  TMP_PREFIX,
  buildVariantPath,
  resolveImageVariantUrls,
  buildLocationKey,
  isOlderThan,
  removePathsInChunks,
} from './media.helpers.js';

export const updateMediaMetadata = async ({ mediaId, values = {} }) => {
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

export const processResizeJob = async ({
  mediaId,
  mediaType,
  storageBucket,
  storagePath,
  userId,
  postId,
  targetKind = 'post',
}) => {
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

  const sourceUrlInternal = storageService.getPublicUrl(
    {
      bucket: sourceLocation.bucket,
      path: sourceLocation.path,
    },
    { internal: true },
  );

  let sourceProbe = null;
  try {
    sourceProbe = await ffmpegService.probeMedia(sourceUrlInternal);
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
        inputPathOrUrl: sourceUrlInternal,
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
          inputPathOrUrl: sourceUrlInternal,
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
};

export const cleanupOrphanedMedia = async () => {
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
};
