import React, { useEffect, useState } from 'react';
import { 
  ChartBarIcon, 
  FireIcon, 
  ArrowPathIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  HeartIcon,
  ShareIcon
} from '@heroicons/react/24/outline';
import apiClient from '../services/apiClient';

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
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-white p-4">
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-blue-400 font-medium animate-pulse">Loading System Intelligence...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-blue-500/30">
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute top-[40%] -right-[10%] w-[30%] h-[30%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <ChartBarIcon className="w-8 h-8 text-blue-500" />
              </div>
              <span className="text-blue-500 font-bold tracking-widest uppercase text-sm">System Overview</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-2">
              Admin <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Intelligence</span>
            </h1>
            <p className="text-slate-400 max-w-2xl text-lg">
              Real-time feed distribution metrics and ranking engine observability. 
              <span className="hidden md:inline ml-2 text-slate-500">Auto-refreshing every 30s.</span>
            </p>
          </div>
          
          <button 
            onClick={() => fetchAdminStats(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all duration-300 group"
          >
            <ArrowPathIcon className={`w-5 h-5 text-blue-400 ${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            <span className="font-medium text-white">{refreshing ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
            <span>System Error: {error}</span>
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            { label: 'Push Distribution', value: 'Hybrid', icon: ShareIcon, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
            { label: 'Fan-out Latency', value: '< 150ms', icon: FireIcon, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
            { label: 'Redis Strategy', value: 'Pull-Heavy', icon: ChartBarIcon, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
            { label: 'Active Sessions', value: 'Real-time', icon: UserGroupIcon, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
          ].map((item, idx) => (
            <div key={idx} className={`p-6 rounded-2xl bg-white/5 border ${item.border} hover:bg-white/10 transition-colors cursor-default`}>
              <div className="flex items-center justify-between mb-4">
                <item.icon className={`w-6 h-6 ${item.color}`} />
                <span className={`text-xs font-bold px-2 py-1 ${item.bg} ${item.color} rounded-md`}>Live</span>
              </div>
              <div className="text-2xl font-bold text-white mb-1">{item.value}</div>
              <div className="text-slate-500 text-sm font-medium">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Main Section: Trending Feed */}
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl overflow-hidden backdrop-blur-md">
          <div className="p-8 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-500/10 rounded-xl">
                <FireIcon className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Trending Feed Ranking</h2>
                <p className="text-slate-500 text-sm mt-1">Ranking Engine (Redis Sorted Set) with Time-Decay Algorithm</p>
              </div>
            </div>
          </div>
          
          <div className="p-8">
            {stats?.trendingPosts?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {stats.trendingPosts.map((post, index) => (
                  <div 
                    key={post.id} 
                    className="group relative bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-blue-500/30 hover:bg-white/[0.07] transition-all duration-300 flex flex-col"
                  >
                    {/* Rank Badge */}
                    <div className="absolute -top-3 -right-3 w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl flex items-center justify-center font-black shadow-lg shadow-blue-500/20 transform group-hover:scale-110 transition-transform">
                      {index + 1}
                    </div>

                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-slate-400 font-bold border border-white/10">
                        {post.author?.username?.charAt(0).toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-white font-bold truncate">{post.author?.fullName}</div>
                        <div className="text-slate-500 text-xs truncate">@{post.author?.username}</div>
                      </div>
                    </div>

                    <div className="text-slate-300 text-sm leading-relaxed mb-6 flex-grow">
                      {post.content ? (
                        <p className="line-clamp-4">{post.content}</p>
                      ) : (
                        <p className="text-slate-500 italic">[Media Only Content]</p>
                      )}
                    </div>

                    <div className="mt-auto">
                      <div className="flex items-center gap-4 text-xs font-bold text-slate-400 mb-4 pb-4 border-b border-white/5">
                        <div className="flex items-center gap-1.5 hover:text-red-400 transition-colors">
                          <HeartIcon className="w-4 h-4" /> {post.likesCount}
                        </div>
                        <div className="flex items-center gap-1.5 hover:text-blue-400 transition-colors">
                          <ChatBubbleLeftRightIcon className="w-4 h-4" /> {post.commentsCount}
                        </div>
                        <div className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
                          <ShareIcon className="w-4 h-4" /> {post.sharesCount}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-tighter border border-blue-500/20">
                          Score: {Number(post.hotScore).toFixed(4)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          ID: {post.id.substring(0, 8)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center flex flex-col items-center">
                <div className="p-4 bg-white/5 rounded-full mb-4">
                  <ChartBarIcon className="w-12 h-12 text-slate-700" />
                </div>
                <h3 className="text-xl font-bold text-slate-400">No trending data available</h3>
                <p className="text-slate-600 mt-2">Ranking engine might be processing initial metrics...</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-12 text-center">
          <p className="text-slate-600 text-xs flex items-center justify-center gap-2 italic">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
            Observing backend metrics at {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Admin;

