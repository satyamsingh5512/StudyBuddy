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

  const fetchNews = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`${API_URL}/api/news/${examType}`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to fetch news');

      const data = await response.json();
      setNews(data.news);
      setCached(data.cached);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDates = async () => {
    try {
      setDatesLoading(true);
      const response = await fetch(`${API_URL}/api/news/${examType}/dates`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to fetch dates');

      const data = await response.json();
      setDates(data.dates || []);
    } catch (err: any) {
      console.error('Dates fetch error:', err);
    } finally {
      setDatesLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    fetchDates();
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
            onClick={fetchNews}
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
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 animate-pulse">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <p className="text-red-700 dark:text-red-400">{error}</p>
                <button
                  onClick={fetchNews}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Try Again
                </button>
              </div>
            ) : news.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center">
                <Newspaper className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">No news available</p>
              </div>
            ) : (
              news.map((item, index) => {
                const Icon = categoryIcons[item.category];
                return (
                  <div
                    key={index}
                    className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${categoryColors[item.category]}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                            {item.title}
                          </h3>
                          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-4">
                            {formatDate(item.date)}
                          </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-3">
                          {item.content}
                        </p>
                        <div className="flex items-center gap-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${categoryColors[item.category]}`}>
                            {item.category}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">
                            Source: {item.source}
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
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Important Dates
                </h2>
              </div>

              {datesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : dates.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No dates available
                </p>
              ) : (
                <div className="space-y-4">
                  {dates.map((date, index) => (
                    <div
                      key={index}
                      className="pb-4 border-b border-gray-200 dark:border-gray-700 last:border-0"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                            {new Date(date.date).getDate()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                            {date.event}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            {formatDate(date.date)}
                          </p>
                          {date.description && (
                            <p className="text-xs text-gray-600 dark:text-gray-300">
                              {date.description}
                            </p>
                          )}
                        </div>
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
