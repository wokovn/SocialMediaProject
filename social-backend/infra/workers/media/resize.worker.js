import { Worker } from 'bullmq';
import { workerOptions } from '../workers.config.js';
import QueueNames from '../../queue/queue.names.js';
import MediaService from '../../../modules/media/media.service.js';
import ffmpegService from '../../media/ffmpeg.service.js';

const mediaResizeWorker = new Worker(
	QueueNames.MEDIA_RESIZE_QUEUE,
	async (job) => {
		return MediaService.processResizeJob(job.data || {});
	},
	{
		...workerOptions,
		concurrency: parseInt(process.env.MEDIA_RESIZE_CONCURRENCY || '3', 10),
	},
);

mediaResizeWorker.on('completed', (job) => {
	console.log(`✓ Media resize job ${job.id} completed`);
});

mediaResizeWorker.on('ready', async () => {
	const available = await ffmpegService.isAvailable();
	console.log(
		`[media-resize] ffmpeg ${available ? 'is available' : 'is unavailable, using fallback mode'}`,
	);
});

mediaResizeWorker.on('failed', (job, err) => {
	console.error(`✗ Media resize job ${job?.id} failed:`, err.message);
});

export default mediaResizeWorker;
