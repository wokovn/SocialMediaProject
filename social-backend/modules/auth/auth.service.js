import authRedis from "./auth.redis.js";

const AuthService = {

    logout: async (token) => {
        
        try {
            const result = await authRedis.blacklistToken(token);
            return result;
        } catch (error) {
            return { error: error.message };
        }
    },

}
export default AuthService;