import authRedis from "./auth.redis.js";

const AuthService = {

    logout: async (token) => {
        if (!token) {
            throw new Error('Token is required for logout');
        }

        await authRedis.blacklistToken(token);
        return { success: true };
    },

}
export default AuthService;