import { Router } from 'express';
import multer from 'multer';
import MediaController from './media.controller.js';

const router = Router();
const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 25 * 1024 * 1024,
		files: 1,
	},
});

const uploadSingleFile = (req, res, next) => {
	upload.single('file')(req, res, (error) => {
		if (!error) {
			return next();
		}

		if (error.code === 'LIMIT_FILE_SIZE') {
			return res.status(413).json({
				message: 'File is too large. Max allowed size is 25MB.',
			});
		}

		return res.status(400).json({
			message: error.message || 'Invalid file upload request.',
		});
	});
};

router.post('/upload-temp', uploadSingleFile, MediaController.uploadTempMedia);
router.post('/profile-picture/finalize', MediaController.finalizeProfilePicture);
router.post('/cleanup', MediaController.triggerCleanup);

export default router;