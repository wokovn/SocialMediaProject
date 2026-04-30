import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Admin = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAdminStats = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/admin/stats`);
        setStats(response.data);
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAdminStats();
    
    // Auto refresh every 30s
    const interval = setInterval(fetchAdminStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) return <div style={styles.container}>Loading admin dashboard...</div>;
  if (error) return <div style={styles.container}>Error: {error}</div>;

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>Quản trị viên (Admin Dashboard)</h1>
      <p style={styles.subtitle}>Không yêu cầu đăng nhập. Tự động cập nhật mỗi 30 giây.</p>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>🔥 Top Bài Viết Thịnh Hành (Trending Feed)</h2>
        <p style={{marginBottom: '16px', color: '#666'}}>Dữ liệu lấy từ hệ thống Ranking Engine (Redis Sorted Set)</p>
        
        {stats?.trendingPosts?.length > 0 ? (
          <div style={styles.grid}>
            {stats.trendingPosts.map((post, index) => (
              <div key={post.id} style={styles.card}>
                <div style={styles.rankBadge}>#{index + 1}</div>
                <div style={styles.cardHeader}>
                  <strong>{post.author?.fullName}</strong> (@{post.author?.username})
                </div>
                <div style={styles.cardBody}>
                  {post.content ? (
                    <p>{post.content.length > 100 ? post.content.substring(0, 100) + '...' : post.content}</p>
                  ) : (
                    <p style={{color: '#999', fontStyle: 'italic'}}>[Bài viết chỉ chứa Media]</p>
                  )}
                </div>
                <div style={styles.cardFooter}>
                  <span>👍 {post.likesCount}</span>
                  <span>💬 {post.commentsCount}</span>
                  <span>↪️ {post.sharesCount}</span>
                </div>
                <div style={styles.scoreBadge}>
                  Hot Score: {Number(post.hotScore).toFixed(4)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>Chưa có bài viết nào lọt vào danh sách thịnh hành.</p>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '30px',
    maxWidth: '1200px',
    margin: '0 auto',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  header: {
    fontSize: '28px',
    marginBottom: '8px',
    color: '#333'
  },
  subtitle: {
    color: '#666',
    marginBottom: '30px'
  },
  section: {
    backgroundColor: '#f8f9fa',
    padding: '24px',
    borderRadius: '12px',
    border: '1px solid #eee'
  },
  sectionTitle: {
    marginTop: 0,
    fontSize: '20px',
    color: '#e03131',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px'
  },
  card: {
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '16px',
    position: 'relative',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  rankBadge: {
    position: 'absolute',
    top: '-10px',
    left: '-10px',
    backgroundColor: '#ff6b6b',
    color: 'white',
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    boxShadow: '0 2px 4px rgba(255,107,107,0.4)'
  },
  cardHeader: {
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: '1px solid #f0f0f0',
    color: '#333'
  },
  cardBody: {
    color: '#444',
    marginBottom: '16px',
    minHeight: '60px'
  },
  cardFooter: {
    display: 'flex',
    gap: '16px',
    color: '#666',
    fontSize: '14px',
    marginBottom: '12px'
  },
  scoreBadge: {
    backgroundColor: '#fff0f6',
    color: '#c2255c',
    padding: '6px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    display: 'inline-block'
  }
};

export default Admin;
