
import authService from './auth.service.js';

const authController = {
    logout: (req, res) => {
        const token = req.headers['authorization'].replace('Bearer ', '');
        authService.logout(token);
        return res.status(200).json({ message: 'Logout successful' });
    }
};

export default authController;