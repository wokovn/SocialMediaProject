import { describe, it, expect } from 'vitest';
import {
  sanitizeFileName,
  toIntegerOrNull,
  inferMediaType,
  inferMediaTypeFromMime,
  extensionFromMimeType,
  chunkArray,
  isOlderThan,
  stripStoragePrefix,
  parsePostMediaOwner,
  parseProfilePictureOwner,
} from '../../../modules/media/media.helpers.js';

describe('Media Helpers', () => {
  describe('sanitizeFileName', () => {
    it('normalizes uppercase letters, spaces and special characters', () => {
      expect(sanitizeFileName('My Photo @2026.jpg')).toBe('my-photo-2026.jpg');
      expect(sanitizeFileName('---hello---world---')).toBe('hello-world');
      expect(sanitizeFileName('A'.repeat(120))).toBe('a'.repeat(80));
    });

    it('returns empty string on empty input', () => {
      expect(sanitizeFileName('')).toBe('');
    });
  });

  describe('toIntegerOrNull', () => {
    it('parses valid integers', () => {
      expect(toIntegerOrNull('123')).toBe(123);
      expect(toIntegerOrNull(45.0)).toBe(45);
    });

    it('returns null for invalid inputs', () => {
      expect(toIntegerOrNull('abc')).toBeNull();
      expect(toIntegerOrNull(undefined)).toBeNull();
      expect(toIntegerOrNull(null)).toBeNull();
      expect(toIntegerOrNull(45.6)).toBeNull();
    });
  });

  describe('inferMediaType', () => {
    it('resolves explicit media types', () => {
      expect(inferMediaType('image')).toBe('image');
      expect(inferMediaType('video')).toBe('video');
    });

    it('infers from extension', () => {
      expect(inferMediaType(null, 'photo.JPG')).toBe('image');
      expect(inferMediaType(null, 'video.mp4')).toBe('video');
      expect(inferMediaType(null, 'document.pdf')).toBeNull();
    });
  });

  describe('inferMediaTypeFromMime', () => {
    it('returns image for image mimes', () => {
      expect(inferMediaTypeFromMime('image/png')).toBe('image');
      expect(inferMediaTypeFromMime('image/jpeg')).toBe('image');
    });

    it('returns video for video mimes', () => {
      expect(inferMediaTypeFromMime('video/mp4')).toBe('video');
    });

    it('returns null for others', () => {
      expect(inferMediaTypeFromMime('text/plain')).toBeNull();
      expect(inferMediaTypeFromMime(null)).toBeNull();
    });
  });

  describe('extensionFromMimeType', () => {
    it('resolves common mime types', () => {
      expect(extensionFromMimeType('image/jpeg')).toBe('.jpg');
      expect(extensionFromMimeType('image/png')).toBe('.png');
      expect(extensionFromMimeType('video/mp4')).toBe('.mp4');
    });

    it('falls back to default extensions based on mediaType', () => {
      expect(extensionFromMimeType('image/gif', 'image')).toBe('.jpg');
      expect(extensionFromMimeType('video/avi', 'video')).toBe('.mp4');
      expect(extensionFromMimeType('application/octet-stream')).toBe('.bin');
    });
  });

  describe('chunkArray', () => {
    it('chunks array into smaller batches', () => {
      const input = [1, 2, 3, 4, 5];
      expect(chunkArray(input, 2)).toEqual([[1, 2], [3, 4], [5]]);
      expect(chunkArray(input, 10)).toEqual([[1, 2, 3, 4, 5]]);
    });
  });

  describe('isOlderThan', () => {
    it('returns true if timestamp is older than duration', () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      expect(isOlderThan(tenMinutesAgo, 5 * 60 * 1000)).toBe(true);
      expect(isOlderThan(tenMinutesAgo, 15 * 60 * 1000)).toBe(false);
    });

    it('returns false for invalid timestamps', () => {
      expect(isOlderThan(null, 1000)).toBe(false);
      expect(isOlderThan('invalid-date', 1000)).toBe(false);
    });
  });

  describe('stripStoragePrefix', () => {
    it('strips prefix from path correctly', () => {
      expect(stripStoragePrefix({ storagePath: 'prefix/sub/path.jpg', prefix: 'prefix' })).toBe('sub/path.jpg');
      expect(stripStoragePrefix({ storagePath: 'prefix', prefix: 'prefix' })).toBe('');
    });
  });

  describe('parsePostMediaOwner', () => {
    it('extracts userId and postId', () => {
      expect(parsePostMediaOwner({ storagePath: 'post-media/user123/post456/file.jpg' })).toEqual({
        userId: 'user123',
        postId: 'post456',
      });
    });
  });

  describe('parseProfilePictureOwner', () => {
    it('extracts userId', () => {
      expect(parseProfilePictureOwner({ storagePath: 'profile-picture/user789/avatar.jpg' })).toEqual({
        userId: 'user789',
        postId: null,
      });
    });
  });
});
