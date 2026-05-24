import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';

const normalizeEnvValue = (value = '') => {
  return typeof value === 'string' ? value.trim() : '';
};

// SUPABASE_PUBLIC_URL: URL mà browser dùng để truy cập storage (có thể khác SUPABASE_URL
// khi chạy trong Docker — backend kết nối qua host.docker.internal, browser dùng localhost)
const SUPABASE_INTERNAL_URL = normalizeEnvValue(process.env.SUPABASE_URL);
const SUPABASE_PUBLIC_URL = normalizeEnvValue(process.env.SUPABASE_PUBLIC_URL) || SUPABASE_INTERNAL_URL;

const normalizePrefix = (value = '') => {
  return normalizeEnvValue(value)
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
};

const withDefault = (value, fallback) => {
  const normalized = normalizeEnvValue(value);
  if (normalized) {
    return normalized;
  }

  return fallback;
};

const isTruthyEnv = (value = '') => {
  const normalized = normalizeEnvValue(value).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

const PRIMARY_STORAGE_BUCKET = withDefault(process.env.SUPABASE_MEDIA_BUCKET, 'media');
const USE_MULTI_BUCKETS = isTruthyEnv(process.env.SUPABASE_MULTI_BUCKETS);

const DEFAULT_PATH_PREFIXES = Object.freeze({
  TMP: 'tmp',
  POST_MEDIA: 'post_media',
  PROFILE_PICTURE: 'profile_picture',
  WEB_CONTENT: 'web_content',
  POST_MEDIA_VARIANTS: 'post_media_variants',
});

const resolveBucketAndPrefix = ({
  legacyBucketEnv,
  prefixEnv,
  prefixFallback,
}) => {
  const legacyValue = normalizeEnvValue(legacyBucketEnv);
  const explicitPrefix = normalizePrefix(prefixEnv);

  if (explicitPrefix) {
    return {
      bucket:
        USE_MULTI_BUCKETS && legacyValue ? legacyValue : PRIMARY_STORAGE_BUCKET,
      prefix: explicitPrefix,
    };
  }

  if (!legacyValue) {
    return {
      bucket: PRIMARY_STORAGE_BUCKET,
      prefix: prefixFallback,
    };
  }

  if (USE_MULTI_BUCKETS) {
    return {
      bucket: legacyValue,
      prefix: prefixFallback,
    };
  }

  if (legacyValue === PRIMARY_STORAGE_BUCKET) {
    return {
      bucket: PRIMARY_STORAGE_BUCKET,
      prefix: prefixFallback,
    };
  }

  return {
    bucket: PRIMARY_STORAGE_BUCKET,
    prefix: normalizePrefix(legacyValue) || prefixFallback,
  };
};

const TMP_STORAGE = resolveBucketAndPrefix({
  legacyBucketEnv: process.env.SUPABASE_TMP_BUCKET,
  prefixEnv: process.env.SUPABASE_TMP_PREFIX,
  prefixFallback: DEFAULT_PATH_PREFIXES.TMP,
});

const POST_MEDIA_STORAGE = resolveBucketAndPrefix({
  legacyBucketEnv: process.env.SUPABASE_POST_MEDIA_BUCKET,
  prefixEnv: process.env.SUPABASE_POST_MEDIA_PREFIX,
  prefixFallback: DEFAULT_PATH_PREFIXES.POST_MEDIA,
});

const PROFILE_PICTURE_STORAGE = resolveBucketAndPrefix({
  legacyBucketEnv: process.env.SUPABASE_PROFILE_PICTURE_BUCKET,
  prefixEnv: process.env.SUPABASE_PROFILE_PICTURE_PREFIX,
  prefixFallback: DEFAULT_PATH_PREFIXES.PROFILE_PICTURE,
});

const WEB_CONTENT_STORAGE = resolveBucketAndPrefix({
  legacyBucketEnv: process.env.SUPABASE_WEB_CONTENT_BUCKET,
  prefixEnv: process.env.SUPABASE_WEB_CONTENT_PREFIX,
  prefixFallback: DEFAULT_PATH_PREFIXES.WEB_CONTENT,
});

const POST_MEDIA_VARIANTS_STORAGE = resolveBucketAndPrefix({
  legacyBucketEnv: process.env.SUPABASE_POST_MEDIA_VARIANTS_BUCKET,
  prefixEnv: process.env.SUPABASE_POST_MEDIA_VARIANTS_PREFIX,
  prefixFallback: DEFAULT_PATH_PREFIXES.POST_MEDIA_VARIANTS,
});

export const STORAGE_BUCKETS = Object.freeze({
  TMP: TMP_STORAGE.bucket,
  POST_MEDIA: POST_MEDIA_STORAGE.bucket,
  PROFILE_PICTURE: PROFILE_PICTURE_STORAGE.bucket,
  WEB_CONTENT: WEB_CONTENT_STORAGE.bucket,
  POST_MEDIA_VARIANTS: POST_MEDIA_VARIANTS_STORAGE.bucket,
});

export const STORAGE_PATH_PREFIXES = Object.freeze({
  TMP: TMP_STORAGE.prefix,
  POST_MEDIA: POST_MEDIA_STORAGE.prefix,
  PROFILE_PICTURE: PROFILE_PICTURE_STORAGE.prefix,
  WEB_CONTENT: WEB_CONTENT_STORAGE.prefix,
  POST_MEDIA_VARIANTS: POST_MEDIA_VARIANTS_STORAGE.prefix,
});

const KNOWN_PREFIXES = new Set(
  [...Object.values(STORAGE_PATH_PREFIXES), ...Object.values(DEFAULT_PATH_PREFIXES)]
    .map((prefix) => normalizePrefix(prefix))
    .filter(Boolean),
);

const KNOWN_BUCKETS = new Set(
  [...Object.values(STORAGE_BUCKETS), PRIMARY_STORAGE_BUCKET]
    .map((bucket) => (typeof bucket === 'string' ? bucket.trim() : ''))
    .filter(Boolean),
);

let cachedClient = null;

const normalizeBucketName = (rawBucket = '') => {
  return typeof rawBucket === 'string' ? rawBucket.trim() : '';
};

const isStorageConfigured = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

const getStorageClient = () => {
  if (!isStorageConfigured()) {
    throw new Error(
      'Supabase storage is not configured. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  if (!cachedClient) {
    cachedClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }

  return cachedClient;
};

const normalizeStoragePath = (rawPath = '') => {
  if (typeof rawPath !== 'string') {
    return '';
  }

  let normalized = rawPath.trim().replace(/\\/g, '/');
  if (!normalized) {
    return '';
  }

  normalized = normalized.replace(/^\/+/, '').split('?')[0];

  return decodeURIComponent(normalized);
};

const normalizeStoragePrefix = (rawPrefix = '') => {
  return normalizeStoragePath(rawPrefix).replace(/\/+$/g, '');
};

const isPathWithinPrefix = ({ path, prefix }) => {
  const normalizedPath = normalizeStoragePath(path);
  const normalizedPrefix = normalizeStoragePrefix(prefix);

  if (!normalizedPath || !normalizedPrefix) {
    return false;
  }

  return (
    normalizedPath === normalizedPrefix ||
    normalizedPath.startsWith(`${normalizedPrefix}/`)
  );
};

const buildPrefixedPath = ({ prefix, path }) => {
  const normalizedPath = normalizeStoragePath(path);
  const normalizedPrefix = normalizeStoragePrefix(prefix);

  if (!normalizedPrefix) {
    return normalizedPath;
  }

  if (!normalizedPath) {
    return normalizedPrefix;
  }

  if (isPathWithinPrefix({ path: normalizedPath, prefix: normalizedPrefix })) {
    return normalizedPath;
  }

  return `${normalizedPrefix}/${normalizedPath}`;
};

const parseStorageLocationFromUrl = (url = '') => {
  if (typeof url !== 'string' || !url.trim()) {
    return null;
  }

  const value = url.trim();
  const markers = [
    '/storage/v1/object/public/',
    '/storage/v1/object/sign/',
    '/storage/v1/object/authenticated/',
    '/storage/v1/object/',
  ];

  for (const marker of markers) {
    const markerIndex = value.indexOf(marker);
    if (markerIndex !== -1) {
      const fromMarker = value
        .slice(markerIndex + marker.length)
        .split('?')[0]
        .replace(/^\/+/, '');

      const [bucket, ...pathParts] = fromMarker.split('/');
      const normalizedBucket = normalizeBucketName(bucket);
      const normalizedPath = normalizeStoragePath(pathParts.join('/'));

      if (normalizedBucket && normalizedPath) {
        return {
          bucket: normalizedBucket,
          path: normalizedPath,
        };
      }
    }
  }

  return null;
};

const resolveStorageLocation = ({
  storageBucket,
  storagePath,
  url,
  fallbackBucket,
} = {}) => {
  const fromUrl = parseStorageLocationFromUrl(url);
  if (fromUrl) {
    return fromUrl;
  }

  let normalizedPath = normalizeStoragePath(storagePath);
  if (!normalizedPath) {
    return null;
  }

  let normalizedBucket =
    normalizeBucketName(storageBucket) ||
    normalizeBucketName(fallbackBucket) ||
    normalizeBucketName(STORAGE_BUCKETS.TMP);

  if (!USE_MULTI_BUCKETS && normalizedBucket && !KNOWN_BUCKETS.has(normalizedBucket)) {
    const legacyPrefix = normalizeStoragePrefix(normalizedBucket);
    if (legacyPrefix && KNOWN_PREFIXES.has(legacyPrefix)) {
      normalizedPath = buildPrefixedPath({
        prefix: legacyPrefix,
        path: normalizedPath,
      });
    }

    normalizedBucket = PRIMARY_STORAGE_BUCKET;
  }

  const pathParts = normalizedPath.split('/');
  if (pathParts.length > 1 && KNOWN_BUCKETS.has(pathParts[0])) {
    normalizedBucket = pathParts[0];
    normalizedPath = pathParts.slice(1).join('/');
  }

  if (!normalizedBucket || !normalizedPath) {
    return null;
  }

  return {
    bucket: normalizedBucket,
    path: normalizedPath,
  };
};

const buildStorageKey = ({ bucket, path }) => {
  const normalizedBucket = normalizeBucketName(bucket);
  const normalizedPath = normalizeStoragePath(path);

  if (!normalizedBucket || !normalizedPath) {
    return null;
  }

  return `${normalizedBucket}:${normalizedPath}`;
};

const getPublicUrl = ({ bucket, path }) => {
  const normalizedBucket = normalizeBucketName(bucket);
  const normalizedPath = normalizeStoragePath(path);
  if (!normalizedBucket || !normalizedPath) {
    return null;
  }

  const client = getStorageClient();
  const result = client.storage.from(normalizedBucket).getPublicUrl(normalizedPath);
  let publicUrl =
    result?.data?.publicUrl ||
    result?.data?.publicURL ||
    result?.publicURL ||
    null;

  // Rewrite internal hostname to public hostname so browser can load the URL
  if (publicUrl && SUPABASE_PUBLIC_URL && SUPABASE_INTERNAL_URL && SUPABASE_PUBLIC_URL !== SUPABASE_INTERNAL_URL) {
    publicUrl = publicUrl.replace(SUPABASE_INTERNAL_URL, SUPABASE_PUBLIC_URL);
  }

  return publicUrl;
};

const readDownloadedObjectAsBuffer = async (downloadedData) => {
  if (!downloadedData) {
    throw new Error('Empty download data received from storage.');
  }

  if (Buffer.isBuffer(downloadedData)) {
    return downloadedData;
  }

  if (downloadedData instanceof ArrayBuffer) {
    return Buffer.from(downloadedData);
  }

  if (typeof downloadedData.arrayBuffer === 'function') {
    const arrayBuffer = await downloadedData.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  throw new Error('Unsupported download payload type for storage transfer.');
};

const moveObject = async ({
  fromBucket,
  fromPath,
  toBucket,
  toPath,
}) => {
  const normalizedFromBucket = normalizeBucketName(fromBucket);
  const normalizedToBucket = normalizeBucketName(toBucket);
  const normalizedFromPath = normalizeStoragePath(fromPath);
  const normalizedToPath = normalizeStoragePath(toPath);

  if (!normalizedFromBucket || !normalizedFromPath) {
    throw new Error('fromBucket and fromPath are required to move storage objects.');
  }

  if (!normalizedToBucket || !normalizedToPath) {
    throw new Error('toBucket and toPath are required to move storage objects.');
  }

  if (
    normalizedFromBucket === normalizedToBucket &&
    normalizedFromPath === normalizedToPath
  ) {
    return {
      moved: false,
      fromBucket: normalizedFromBucket,
      fromPath: normalizedFromPath,
      toBucket: normalizedToBucket,
      toPath: normalizedToPath,
    };
  }

  const client = getStorageClient();

  if (normalizedFromBucket === normalizedToBucket) {
    const { data, error } = await client.storage
      .from(normalizedFromBucket)
      .move(normalizedFromPath, normalizedToPath);

    if (error) {
      throw new Error(`Storage move failed: ${error.message}`);
    }

    return {
      moved: true,
      data,
      fromBucket: normalizedFromBucket,
      fromPath: normalizedFromPath,
      toBucket: normalizedToBucket,
      toPath: normalizedToPath,
    };
  }

  const { data: downloadedData, error: downloadError } = await client.storage
    .from(normalizedFromBucket)
    .download(normalizedFromPath);

  if (downloadError) {
    throw new Error(`Storage download failed: ${downloadError.message}`);
  }

  const fileBuffer = await readDownloadedObjectAsBuffer(downloadedData);

  await uploadBuffer({
    bucket: normalizedToBucket,
    storagePath: normalizedToPath,
    buffer: fileBuffer,
    upsert: true,
  });

  await removeObjects({
    bucket: normalizedFromBucket,
    paths: [normalizedFromPath],
  });

  return {
    moved: true,
    fromBucket: normalizedFromBucket,
    fromPath: normalizedFromPath,
    toBucket: normalizedToBucket,
    toPath: normalizedToPath,
    transferredAcrossBuckets: true,
  };
};

const copyObject = async ({
  fromBucket,
  fromPath,
  toBucket,
  toPath,
}) => {
  const normalizedFromBucket = normalizeBucketName(fromBucket);
  const normalizedToBucket = normalizeBucketName(toBucket);
  const normalizedFromPath = normalizeStoragePath(fromPath);
  const normalizedToPath = normalizeStoragePath(toPath);

  if (!normalizedFromBucket || !normalizedFromPath) {
    throw new Error('fromBucket and fromPath are required to copy storage objects.');
  }

  if (!normalizedToBucket || !normalizedToPath) {
    throw new Error('toBucket and toPath are required to copy storage objects.');
  }

  if (
    normalizedFromBucket === normalizedToBucket &&
    normalizedFromPath === normalizedToPath
  ) {
    return {
      copied: false,
      fromBucket: normalizedFromBucket,
      fromPath: normalizedFromPath,
      toBucket: normalizedToBucket,
      toPath: normalizedToPath,
    };
  }

  const client = getStorageClient();

  if (normalizedFromBucket === normalizedToBucket) {
    const { data, error } = await client.storage
      .from(normalizedFromBucket)
      .copy(normalizedFromPath, normalizedToPath);

    if (error) {
      throw new Error(`Storage copy failed: ${error.message}`);
    }

    return {
      copied: true,
      data,
      fromBucket: normalizedFromBucket,
      fromPath: normalizedFromPath,
      toBucket: normalizedToBucket,
      toPath: normalizedToPath,
    };
  }

  const { data: downloadedData, error: downloadError } = await client.storage
    .from(normalizedFromBucket)
    .download(normalizedFromPath);

  if (downloadError) {
    throw new Error(`Storage download failed: ${downloadError.message}`);
  }

  const fileBuffer = await readDownloadedObjectAsBuffer(downloadedData);

  await uploadBuffer({
    bucket: normalizedToBucket,
    storagePath: normalizedToPath,
    buffer: fileBuffer,
    upsert: true,
  });

  return {
    copied: true,
    fromBucket: normalizedFromBucket,
    fromPath: normalizedFromPath,
    toBucket: normalizedToBucket,
    toPath: normalizedToPath,
    transferredAcrossBuckets: true,
  };
};

const removeObjects = async ({ bucket, paths = [] }) => {
  const normalizedBucket = normalizeBucketName(bucket);
  const normalizedPaths = [
    ...new Set(paths.map((item) => normalizeStoragePath(item)).filter(Boolean)),
  ];

  if (!normalizedBucket || !normalizedPaths.length) {
    return [];
  }

  const client = getStorageClient();
  const { data, error } = await client.storage
    .from(normalizedBucket)
    .remove(normalizedPaths);

  if (error) {
    throw new Error(`Storage remove failed: ${error.message}`);
  }

  return data || [];
};

const uploadBuffer = async ({
  bucket,
  storagePath,
  buffer,
  contentType,
  cacheControl = '3600',
  upsert = true,
}) => {
  const normalizedBucket = normalizeBucketName(bucket);
  const normalizedPath = normalizeStoragePath(storagePath);

  if (!normalizedBucket || !normalizedPath) {
    throw new Error('bucket and storagePath are required to upload file content.');
  }

  if (!Buffer.isBuffer(buffer)) {
    throw new Error('uploadBuffer requires a Buffer payload.');
  }

  const client = getStorageClient();
  const { data, error } = await client.storage.from(normalizedBucket).upload(
    normalizedPath,
    buffer,
    {
      cacheControl,
      contentType,
      upsert,
    },
  );

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return data || null;
};

const uploadLocalFile = async ({
  bucket,
  storagePath,
  localFilePath,
  contentType,
  cacheControl = '3600',
  upsert = true,
}) => {
  if (!localFilePath) {
    throw new Error('localFilePath is required to upload local file content.');
  }

  const buffer = await readFile(localFilePath);
  return uploadBuffer({
    bucket,
    storagePath,
    buffer,
    contentType,
    cacheControl,
    upsert,
  });
};

const listObjects = async ({ bucket, prefix = '', options = {} }) => {
  const normalizedBucket = normalizeBucketName(bucket);
  const normalizedPrefix = normalizeStoragePath(prefix);
  const limit = Number(options.limit) || 100;
  const offset = Number(options.offset) || 0;

  if (!normalizedBucket) {
    throw new Error('bucket is required to list storage objects.');
  }

  const client = getStorageClient();
  const { data, error } = await client.storage.from(normalizedBucket).list(
    normalizedPrefix,
    {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    },
  );

  if (error) {
    throw new Error(`Storage list failed: ${error.message}`);
  }

  return data || [];
};

const listAllObjects = async ({ bucket, prefix = '' }) => {
  const normalizedBucket = normalizeBucketName(bucket);

  if (!normalizedBucket) {
    throw new Error('bucket is required to list all storage objects.');
  }

  const results = [];

  const walk = async (currentPrefix) => {
    let offset = 0;

    while (true) {
      const page = await listObjects({
        bucket: normalizedBucket,
        prefix: currentPrefix,
        options: { limit: 100, offset },
      });

      for (const item of page) {
        const itemPath = normalizeStoragePath(
          currentPrefix ? `${currentPrefix}/${item.name}` : item.name,
        );

        if (!itemPath) {
          continue;
        }

        if (item.id) {
          results.push({ ...item, path: itemPath });
          continue;
        }

        await walk(itemPath);
      }

      if (page.length < 100) {
        break;
      }

      offset += page.length;
    }
  };

  await walk(normalizeStoragePath(prefix));
  return results;
};

const storageService = {
  STORAGE_BUCKETS,
  STORAGE_PATH_PREFIXES,
  isStorageConfigured,
  normalizeBucketName,
  normalizeStoragePath,
  normalizeStoragePrefix,
  isPathWithinPrefix,
  buildPrefixedPath,
  parseStorageLocationFromUrl,
  resolveStorageLocation,
  buildStorageKey,
  getPublicUrl,
  moveObject,
  copyObject,
  removeObjects,
  uploadBuffer,
  uploadLocalFile,
  listObjects,
  listAllObjects,
};

export default storageService;