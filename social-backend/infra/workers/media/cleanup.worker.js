import { Worker } from 'bullmq';
import { workerOptions } from '../workers.config.js';
import QueueNames from '../../queue/queue.names.js';
import { mediaCleanupQueue } from '../../queue/media.queue.js';
import MediaService from '../../../modules/media/media.service.js';

const CLEANUP_INTERVAL_MS =
	Number(process.env.MEDIA_CLEANUP_INTERVAL_MS) || 60 * 60 * 1000;
const CLEANUP_REPEAT_KEY = 'media-cleanup-repeat';

const mediaCleanupWorker = new Worker(
	QueueNames.MEDIA_CLEANUP_QUEUE,
	async () => {
		return MediaService.cleanupOrphanedMedia();
	},
	{
		...workerOptions,
		concurrency: parseInt(process.env.MEDIA_CLEANUP_CONCURRENCY || '1', 10),
	},
);

mediaCleanupWorker.on('ready', async () => {
	try {
		await mediaCleanupQueue.removeRepeatableByKey(CLEANUP_REPEAT_KEY);
	} catch {
		// No previous repeat job found.
	}

	try {
		await mediaCleanupQueue.add(
			'media-cleanup-schedule',
			{ triggeredBy: 'system' },
			{
				repeat: {
					every: CLEANUP_INTERVAL_MS,
					key: CLEANUP_REPEAT_KEY,
				},
				removeOnComplete: true,
				removeOnFail: parseInt(process.env.MEDIA_CLEANUP_REMOVE_ON_FAIL_COUNT || '200', 10),
			},
		);

		console.log(
			`[media-cleanup] Scheduled recurring cleanup every ${CLEANUP_INTERVAL_MS}ms`,
		);
	} catch (error) {
		console.error('[media-cleanup] Failed to schedule recurring cleanup:', error);
	}
});

mediaCleanupWorker.on('completed', (job) => {
	console.log(`✓ Media cleanup job ${job.id} completed`);
});

mediaCleanupWorker.on('failed', (job, err) => {
	console.error(`✗ Media cleanup job ${job?.id} failed:`, err.message);
});

export default mediaCleanupWorker;
