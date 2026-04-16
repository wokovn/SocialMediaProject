import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const MAX_BUFFER_BYTES = 10 * 1024 * 1024;

let ffmpegAvailabilityCache = null;

const runCommand = async (binary, args = [], timeout = 120000) => {
  return execFileAsync(binary, args, {
    windowsHide: true,
    maxBuffer: MAX_BUFFER_BYTES,
    timeout,
  });
};

const checkBinary = async (binary) => {
  try {
    await runCommand(binary, ['-version'], 20000);
    return true;
  } catch {
    return false;
  }
};

const createTempWorkspace = async () => {
  return mkdtemp(path.join(tmpdir(), 'socialz-media-'));
};

const parseProbeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeDurationSeconds = (value) => {
  const parsed = parseProbeNumber(value);
  if (!parsed) {
    return null;
  }

  return Math.max(0, Math.round(parsed));
};

const ffmpegService = {
  async isAvailable() {
    if (ffmpegAvailabilityCache !== null) {
      return ffmpegAvailabilityCache;
    }

    const [ffmpegOk, ffprobeOk] = await Promise.all([
      checkBinary('ffmpeg'),
      checkBinary('ffprobe'),
    ]);

    ffmpegAvailabilityCache = ffmpegOk && ffprobeOk;
    return ffmpegAvailabilityCache;
  },

  async probeMedia(inputPathOrUrl) {
    const { stdout } = await runCommand(
      'ffprobe',
      [
        '-v',
        'error',
        '-print_format',
        'json',
        '-show_streams',
        '-show_format',
        inputPathOrUrl,
      ],
      45000,
    );

    const parsed = JSON.parse(stdout || '{}');
    const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
    const videoStream = streams.find((stream) => stream.codec_type === 'video') || null;

    return {
      width: parseProbeNumber(videoStream?.width),
      height: parseProbeNumber(videoStream?.height),
      duration: normalizeDurationSeconds(
        videoStream?.duration ?? parsed?.format?.duration,
      ),
      size: parseProbeNumber(parsed?.format?.size),
      formatName: parsed?.format?.format_name || null,
    };
  },

  async createImageVariant({
    inputPathOrUrl,
    maxSize = 960,
    quality = 3,
  }) {
    const workspace = await createTempWorkspace();
    const outputPath = path.join(workspace, 'image-variant.jpg');

    try {
      await runCommand(
        'ffmpeg',
        [
          '-y',
          '-hide_banner',
          '-loglevel',
          'error',
          '-i',
          inputPathOrUrl,
          '-vf',
          `scale=${maxSize}:${maxSize}:force_original_aspect_ratio=decrease`,
          '-frames:v',
          '1',
          '-q:v',
          String(quality),
          outputPath,
        ],
        120000,
      );

      const metadata = await this.probeMedia(outputPath);

      return {
        outputPath,
        width: metadata.width,
        height: metadata.height,
        cleanup: async () => rm(workspace, { recursive: true, force: true }),
      };
    } catch (error) {
      await rm(workspace, { recursive: true, force: true });
      throw error;
    }
  },

  async createVideoThumbnail({
    inputPathOrUrl,
    seekSeconds = 0.5,
    maxSize = 960,
    quality = 3,
  }) {
    const workspace = await createTempWorkspace();
    const outputPath = path.join(workspace, 'video-thumbnail.jpg');

    try {
      await runCommand(
        'ffmpeg',
        [
          '-y',
          '-hide_banner',
          '-loglevel',
          'error',
          '-ss',
          String(seekSeconds),
          '-i',
          inputPathOrUrl,
          '-frames:v',
          '1',
          '-vf',
          `scale=${maxSize}:${maxSize}:force_original_aspect_ratio=decrease`,
          '-q:v',
          String(quality),
          outputPath,
        ],
        180000,
      );

      const metadata = await this.probeMedia(outputPath);

      return {
        outputPath,
        width: metadata.width,
        height: metadata.height,
        cleanup: async () => rm(workspace, { recursive: true, force: true }),
      };
    } catch (error) {
      await rm(workspace, { recursive: true, force: true });
      throw error;
    }
  },
};

export default ffmpegService;