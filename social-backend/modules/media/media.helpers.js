import path from 'node:path';
import storageService, {
  STORAGE_BUCKETS,
  STORAGE_PATH_PREFIXES,
} from '../../infra/storage/storage.service.js';

export const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
]);

export const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.webm',
]);

export const TMP_TTL_MINUTES = Number(process.env.MEDIA_TMP_TTL_MINUTES) || 180;
export const ORPHAN_GRACE_MINUTES = Number(process.env.MEDIA_ORPHAN_GRACE_MINUTES) || 30;
export const CLEANUP_DELETE_BATCH_SIZE =
  Number(process.env.MEDIA_CLEANUP_DELETE_BATCH_SIZE) || 100;
export const IMAGE_VARIANT_SMALL_SIZE =
  Number(process.env.MEDIA_IMAGE_VARIANT_SMALL_SIZE) || 480;
export const IMAGE_VARIANT_MAX_SIZE =
  Number(process.env.MEDIA_IMAGE_VARIANT_MAX_SIZE) || 960;
export const IMAGE_VARIANT_HIGH_SIZE =
  Number(process.env.MEDIA_IMAGE_VARIANT_HIGH_SIZE) || 1440;
export const VIDEO_THUMBNAIL_MAX_SIZE =
  Number(process.env.MEDIA_VIDEO_THUMBNAIL_MAX_SIZE) || 960;
export const VIDEO_THUMBNAIL_SEEK_SECONDS =
  Number(process.env.MEDIA_VIDEO_THUMBNAIL_SEEK_SECONDS) || 0.5;

export const IMAGE_VARIANT_PRESETS = Object.freeze([
  { label: 'small', maxSize: IMAGE_VARIANT_SMALL_SIZE },
  { label: 'medium', maxSize: IMAGE_VARIANT_MAX_SIZE },
  { label: 'high', maxSize: IMAGE_VARIANT_HIGH_SIZE },
]);

export const TMP_PREFIX = STORAGE_PATH_PREFIXES.TMP;
export const POST_MEDIA_PREFIX = STORAGE_PATH_PREFIXES.POST_MEDIA;
export const PROFILE_PICTURE_PREFIX = STORAGE_PATH_PREFIXES.PROFILE_PICTURE;
export const POST_MEDIA_VARIANTS_PREFIX = STORAGE_PATH_PREFIXES.POST_MEDIA_VARIANTS;

export const buildPrefixedStoragePath = ({ prefix, path }) => {
  return storageService.buildPrefixedPath({ prefix, path });
};

export const isPathWithinPrefix = ({ path, prefix }) => {
  return storageService.isPathWithinPrefix({ path, prefix });
};

export const sanitizeFileName = (name = '') =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

export const toIntegerOrNull = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

export const inferMediaType = (mediaType, storagePath = '') => {
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

export const inferMediaTypeFromMime = (mimeType = '') => {
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

export const extensionFromMimeType = (mimeType = '', mediaType = null) => {
  const mime = typeof mimeType === 'string' ? mimeType.toLowerCase() : '';

  const extensionMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
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

export const buildPostMediaPath = ({ userId, postId, sourcePath, index }) => {
  const extension = path.posix.extname(sourcePath) || '.bin';
  const baseName =
    sanitizeFileName(path.posix.basename(sourcePath, extension)) || 'media';

  return buildPrefixedStoragePath({
    prefix: POST_MEDIA_PREFIX,
    path: `${userId}/${postId}/${Date.now()}-${index}-${baseName}${extension}`,
  });
};

export const buildProfilePicturePath = ({ userId, sourcePath }) => {
  const extension = path.posix.extname(sourcePath) || '.jpg';
  return buildPrefixedStoragePath({
    prefix: PROFILE_PICTURE_PREFIX,
    path: `${userId}/avatar-${Date.now()}${extension}`,
  });
};

export const normalizeMediaAttachment = (item, index) => {
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

export const chunkArray = (items = [], size = 100) => {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

export const isOlderThan = (timestamp, ageMs) => {
  if (!timestamp) {
    return false;
  }

  const value = new Date(timestamp).getTime();
  if (Number.isNaN(value)) {
    return false;
  }

  return Date.now() - value >= ageMs;
};

export const removePathsInChunks = async ({ bucket, paths = [] }) => {
  const chunks = chunkArray(paths, CLEANUP_DELETE_BATCH_SIZE);
  let removedCount = 0;

  for (const chunk of chunks) {
    const removed = await storageService.removeObjects({ bucket, paths: chunk });
    removedCount += removed.length;
  }

  return removedCount;
};

export const buildVariantPath = ({
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

export const stripStoragePrefix = ({ storagePath, prefix }) => {
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

export const parsePostMediaOwner = ({ storagePath }) => {
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

export const parseProfilePictureOwner = ({ storagePath }) => {
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

export const resolveImageVariantUrls = ({
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

export const buildLocationKey = ({ bucket, path }) => {
  return storageService.buildStorageKey({ bucket, path });
};
