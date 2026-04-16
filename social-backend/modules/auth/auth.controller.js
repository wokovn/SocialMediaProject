
import authService from './auth.service.js';

const authController = {
    logout: async (req, res) => {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(400).json({ message: 'Missing or invalid Authorization header' });
        }

        const token = authHeader.split(' ')[1];

        try {
            await authService.logout(token);
            return res.status(200).json({ message: 'Logout successful' });
        } catch (error) {
            return res.status(500).json({ message: error.message || 'Logout failed' });
        }
    }
};

export default authController;