import { describe, it, expect, vi, beforeEach } from 'vitest';
import AuthService from '../../../modules/auth/auth.service.js';
import db from '../../../modules/db/db.js';
import { supabase } from '../../../modules/auth/supabase.js';
import authRedis from '../../../modules/auth/auth.redis.js';

// Mock dependencies
vi.mock('../../../modules/db/db.js', () => {
    const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
    };
    return { default: mockDb };
});

vi.mock('../../../modules/auth/supabase.js', () => ({
    supabase: {
        auth: {
            signIn: vi.fn()
        }
    }
}));

vi.mock('../../../modules/auth/auth.redis.js', () => ({
    default: {
        blacklistToken: vi.fn()
    }
}));

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
    eq: vi.fn(),
    or: vi.fn()
}));

describe('AuthService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('login()', () => {
        it('should login directly with email', async () => {
            const mockSession = { user: { id: 1 }, session: 'session_token' };
            supabase.auth.signIn.mockResolvedValueOnce(mockSession);

            const result = await AuthService.login('test@example.com', 'password123');

            expect(supabase.auth.signIn).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password123'
            });
            expect(result).toEqual(mockSession);
            expect(db.select).not.toHaveBeenCalled();
        });

        it('should look up email by username if not an email', async () => {
            const mockSession = { user: { id: 1 }, session: 'session_token' };
            
            // Mock db chain to return a found user
            db.limit.mockResolvedValueOnce([{ email: 'user@example.com' }]);
            supabase.auth.signIn.mockResolvedValueOnce(mockSession);

            const result = await AuthService.login('testuser', 'password123');

            expect(db.select).toHaveBeenCalled();
            expect(supabase.auth.signIn).toHaveBeenCalledWith({
                email: 'user@example.com',
                password: 'password123'
            });
            expect(result).toEqual(mockSession);
        });

        it('should throw Error if username not found', async () => {
            db.limit.mockResolvedValueOnce([]); // No user found

            await expect(AuthService.login('nonexistent', 'password123'))
                .rejects.toThrow('User not found');
            
            expect(supabase.auth.signIn).not.toHaveBeenCalled();
        });

        it('should throw Error if Supabase signIn fails', async () => {
            supabase.auth.signIn.mockResolvedValueOnce({ error: new Error('Invalid credentials') });

            await expect(AuthService.login('test@example.com', 'badpass'))
                .rejects.toThrow('Invalid credentials');
        });

        it('should propagate Supabase signIn rejection', async () => {
            supabase.auth.signIn.mockRejectedValueOnce(new Error('network error'));

            await expect(AuthService.login('test@example.com', 'password123'))
                .rejects.toThrow('network error');
        });

        it('should propagate db errors when looking up username', async () => {
            db.limit.mockRejectedValueOnce(new Error('db failure'));

            await expect(AuthService.login('testuser', 'password123'))
                .rejects.toThrow('db failure');
        });
    });

    describe('logout()', () => {
        it('should throw an Error if no token provided', async () => {
            await expect(AuthService.logout()).rejects.toThrow('Token is required for logout');
        });

        it('should blacklist the token and return success', async () => {
            authRedis.blacklistToken.mockResolvedValueOnce();

            const result = await AuthService.logout('valid_token');

            expect(authRedis.blacklistToken).toHaveBeenCalledWith('valid_token');
            expect(result.success).toBe(true);
        });

        it('should propagate blacklist failures', async () => {
            authRedis.blacklistToken.mockRejectedValueOnce(new Error('redis down'));

            await expect(AuthService.logout('valid_token')).rejects.toThrow('redis down');
        });
    });
});
