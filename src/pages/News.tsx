import { useState, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { userAtom } from '@/store/atoms';
import { Newspaper, Calendar, TrendingUp, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import { API_URL } from '@/config/api';

interface NewsItem {
  title: string;
  content: string;
  category: 'announcement' | 'syllabus' | 'notification' | 'tips' | 'motivation';
  date: string;
  source: string;
}

interface ImportantDate {
  event: string;
  date: string;
  description: string;
}

const categoryIcons = {
  announcement: AlertCircle,
  syllabus: Newspaper,
  notification: TrendingUp,
  tips: Sparkles,
  motivation: Sparkles,
};

const categoryColors = {
  announcement: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  syllabus: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  notification: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  tips: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  motivation: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

export default function News() {
  const user = useAtomValue(userAtom);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [dates, setDates] = useState<ImportantDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [datesLoading, setDatesLoading] = useState(false);
  const [error, setError] = useState('');
  const [cached, setCached] = useState(false);

  const examType = user?.examGoal || 'JEE';
  const CACHE_DURATION = 5 * 60 * 60 * 1000; // 5 hours

  const loadData = async (forceRefresh = false) => {
    const cacheKey = `news_cache_${examType}`;

    // Try to load from cache first
    if (!forceRefresh) {
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        try {
          const { news: cachedNews, dates: cachedDates, timestamp } = JSON.parse(cachedData);
          if (Date.now() - timestamp < CACHE_DURATION) {
            setNews(cachedNews);
            setDates(cachedDates);
            setCached(true);
            setLoading(false);
            setDatesLoading(false);
            return;
          }
        } catch (e) {
          console.error('Cache parse error', e);
          localStorage.removeItem(cacheKey);
        }
      }
    }

    try {
      setLoading(true);
      if (forceRefresh) setDatesLoading(true);
      setError('');

      // Fetch both in parallel
      const [newsRes, datesRes] = await Promise.all([
        fetch(`${API_URL}/api/news/${examType}`, { credentials: 'include' }),
        fetch(`${API_URL}/api/news/${examType}/dates`, { credentials: 'include' })
      ]);

      if (!newsRes.ok) throw new Error('Failed to fetch news');

      const newsData = await newsRes.json();
      const datesData = datesRes.ok ? await datesRes.json() : { dates: [] };

      setNews(newsData.news);
      setDates(datesData.dates || []);
      setCached(false);

      // Save to cache
      localStorage.setItem(cacheKey, JSON.stringify({
        news: newsData.news,
        dates: datesData.dates || [],
        timestamp: Date.now()
      }));

    } catch (err: any) {
      setError(err.message);
      // If fetch fails but we have stale cache, maybe show it? 
      // For now, adhere to standard error handling.
    } finally {
      setLoading(false);
      setDatesLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [examType]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Newspaper className="w-8 h-8 text-indigo-600" />
              {examType} News & Updates
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Stay updated with latest announcements and important dates
            </p>
          </div>
          <button
            onClick={() => loadData(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {cached && (
          <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-400">
            Showing cached news (updates every hour)
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* News Feed */}
          <div className="lg:col-span-2 space-y-4">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-6 animate-pulse shadow-sm">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <p className="text-red-700 dark:text-red-400 font-medium">{error}</p>
                <button
                  onClick={() => loadData(true)}
                  className="mt-4 px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors shadow-sm"
                >
                  Try Again
                </button>
              </div>
            ) : news.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center shadow-sm border border-gray-100 dark:border-gray-700">
                <Newspaper className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 font-medium">No news available at the moment</p>
              </div>
            ) : (
              news.map((item, index) => {
                const Icon = categoryIcons[item.category];
                return (
                  <div
                    key={index}
                    className="group bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-gray-100/50 dark:border-gray-700/50"
                  >
                    <div className="flex items-start gap-5">
                      <div className={`p-3.5 rounded-xl flex-shrink-0 ${categoryColors[item.category]} group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2 gap-4">
                          <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {item.title}
                          </h3>
                          <span className="text-xs font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap bg-gray-50 dark:bg-gray-900/50 px-2 py-1 rounded-lg">
                            {formatDate(item.date)}
                          </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4 text-base">
                          {item.content}
                        </p>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-50 dark:border-gray-700/50">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${categoryColors[item.category]}`}>
                            {item.category}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                            Via {item.source}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Important Dates Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700 sticky top-6">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                  <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Important Dates
                </h2>
              </div>

              {datesLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse flex gap-3">
                      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : dates.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No upcoming dates
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dates.map((date, index) => (
                    <div
                      key={index}
                      className="group flex items-start gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex flex-col items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 group-hover:scale-105 transition-transform">
                        <span className="text-xs font-bold uppercase">{new Date(date.date).toLocaleString('default', { month: 'short' })}</span>
                        <span className="text-lg font-bold leading-none">{new Date(date.date).getDate()}</span>
                      </div>
                      <div className="flex-1 min-w-0 py-0.5">
                        <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1 line-clamp-2 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {date.event}
                        </h4>
                        {date.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                            {date.description}
                          </p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1">
                          {new Date(date.date).getFullYear()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
