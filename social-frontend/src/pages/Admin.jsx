import React, { useEffect, useState } from 'react';
import { 
  ChartBarIcon, 
  FireIcon, 
  ArrowPathIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  HeartIcon,
  ShareIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../services/apiClient';
import TwitterLayout from '../components/TwitterLayout';

const Admin = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchAdminStats = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const { data, error: apiError } = await apiClient.get('/api/admin/stats');
      if (apiError) throw new Error(apiError);
      setStats(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to fetch stats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdminStats();
    
    // Auto refresh every 30s
    const interval = setInterval(() => fetchAdminStats(), 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1d9bf0]"></div>
        <p className="text-[#71767b] text-sm font-semibold mt-4">Loading System Intelligence...</p>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-[#2f3336] px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-display text-white">System Intelligence</h2>
          <p className="text-xs text-[#71767b]">Real-time feed distribution and metrics</p>
        </div>
        
        <button 
          onClick={() => fetchAdminStats(true)}
          disabled={refreshing}
          className="p-2 rounded-full hover:bg-[#16181c] text-[#1d9bf0] transition"
          title="Refresh Data"
        >
          <ArrowPathIcon className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-4 space-y-6">
        
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[#f4212e] text-sm">
            System Error: {error}
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Push Distribution', value: 'Hybrid', icon: ShareIcon, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'Fan-out Latency', value: '< 150ms', icon: FireIcon, color: 'text-orange-400', bg: 'bg-orange-500/10' },
            { label: 'Redis Strategy', value: 'Pull-Heavy', icon: CpuChipIcon, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Active Sessions', value: 'Real-time', icon: UserGroupIcon, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          ].map((item, idx) => (
            <div key={idx} className="p-4 rounded-2xl bg-[#16181c] border border-[#2f3336]">
              <div className="flex items-center justify-between mb-2">
                <item.icon className={`w-5 h-5 ${item.color}`} />
                <span className="text-[10px] font-black uppercase tracking-wider text-[#71767b]">Live</span>
              </div>
              <div className="text-lg font-bold text-white mb-0.5">{item.value}</div>
              <div className="text-[#71767b] text-xs font-semibold">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Main Section: Trending Feed */}
        <div className="rounded-2xl border border-[#2f3336] bg-[#16181c]/30 overflow-hidden">
          <div className="p-4 border-b border-[#2f3336] flex items-center gap-3 bg-[#16181c]">
            <FireIcon className="w-5 h-5 text-orange-500" />
            <div>
              <h3 className="font-bold text-white">Trending Feed Ranking</h3>
              <p className="text-xs text-[#71767b]">Redis Sorted Set Time-Decay Algorithm</p>
            </div>
          </div>
          
          <div className="divide-y divide-[#2f3336]">
            {stats?.trendingPosts?.length > 0 ? (
              stats.trendingPosts.map((post, index) => (
                <div 
                  key={post.id} 
                  className="p-4 flex gap-3 hover:bg-[#16181c]/60 transition duration-200"
                >
                  {/* Rank Counter */}
                  <div className="flex-shrink-0 flex items-start pt-1">
                    <span className="w-6 h-6 rounded-full bg-[#1d9bf0]/10 text-[#1d9bf0] font-black text-xs flex items-center justify-center">
                      {index + 1}
                    </span>
                  </div>

                  <div className="flex-grow min-w-0 space-y-1.5">
                    {/* Author Meta */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-white">{post.author?.fullName}</span>
                      <span className="text-xs text-[#71767b]">@{post.author?.username}</span>
                    </div>

                    {/* Content Snippet */}
                    <div className="text-sm text-[#e7e9ea] break-words">
                      {post.content ? (
                        <p className="line-clamp-3">{post.content}</p>
                      ) : (
                        <p className="text-[#71767b] italic">[Media Only Content]</p>
                      )}
                    </div>

                    {/* Stats and HotScore */}
                    <div className="flex items-center justify-between gap-4 pt-1.5">
                      <div className="flex items-center gap-3 text-xs text-[#71767b]">
                        <span className="flex items-center gap-1">
                          <HeartIcon className="w-3.5 h-3.5" /> {post.likesCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" /> {post.commentsCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <ShareIcon className="w-3.5 h-3.5" /> {post.sharesCount}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-[#1d9bf0]/10 text-[#1d9bf0] border border-[#1d9bf0]/25 rounded text-[10px] font-black uppercase">
                          Score: {Number(post.hotScore).toFixed(4)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center">
                <ChartBarIcon className="w-10 h-10 text-[#71767b] mx-auto mb-2" />
                <h4 className="font-bold text-white">No trending posts</h4>
                <p className="text-xs text-[#71767b] mt-1">Ranking engine is processing metrics...</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer timestamp */}
        <div className="text-center pt-2">
          <p className="text-[#71767b] text-xs flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#1d9bf0] rounded-full animate-ping"></span>
            Last update at {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>
    </>
  );
};

export default Admin;
