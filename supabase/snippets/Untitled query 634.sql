DELETE FROM posts
WHERE user_id IN (
    SELECT id FROM users 
    WHERE username LIKE 'bot_%'
);
