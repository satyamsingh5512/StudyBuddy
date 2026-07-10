import { useMemo, useState, type FormEvent } from 'react';
import { Newspaper, Calendar, TrendingUp, AlertCircle, Sparkles, RefreshCw, Search, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';

import { userAtom } from '@/store/atoms';
import { apiFetchJSON } from '@/config/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface NewsItem {
  title: string;
  content: string;
  category: 'announcement' | 'syllabus' | 'notification' | 'tips' | 'motivation' | 'strategy' | 'result';
  date: string;
  source: string;
}

interface ImportantDate {
  event: string;
  date: string;
  description: string;
}

interface NewsResponse {
  news: NewsItem[];
}

interface NewsDatesResponse {
  dates: ImportantDate[];
}

type CategoryType = 'all' | NewsItem['category'];

const categoryIcons = {
  announcement: AlertCircle,
  syllabus: Newspaper,
  notification: TrendingUp,
  tips: Sparkles,
  motivation: Sparkles,
  strategy: Sparkles,
  result: TrendingUp,
} as const;

const categoryColors = {
  announcement: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  syllabus: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  notification: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  tips: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  motivation: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  strategy: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  result: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
} as const;

const categoryLabels: Record<CategoryType, string> = {
  all: 'All',
  announcement: 'Announcements',
  syllabus: 'Syllabus',
  notification: 'Notifications',
  tips: 'Tips',
  motivation: 'Motivation',
  strategy: 'Strategy',
  result: 'Results',
};

const normalizeCategory = (category: string): NewsItem['category'] => {
  const key = category as NewsItem['category'];
  if (key in categoryIcons) return key;
  return 'announcement';
};

export default function News() {
  const user = useAtomValue(userAtom);
  const [activeCategory, setActiveCategory] = useState<CategoryType>('all');
  const [queryInput, setQueryInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const examType = user?.examGoal || 'JEE';

  const {
    data: newsData,
    isLoading: loading,
    isFetching: newsFetching,
    error,
    refetch: refetchNews,
  } = useQuery<NewsResponse, Error>({
    queryKey: ['news', examType],
    queryFn: () => apiFetchJSON<NewsResponse>(`/news/${examType}`),
    staleTime: 60 * 60 * 1000,  // 1 hour — matches backend cache
    gcTime: 120 * 60 * 1000,    // 2 hours
    retry: false,               // backend already retries; don't double-hit
    refetchOnWindowFocus: false, // prevent refetch on every tab switch
  });

  const {
    data: datesData,
    isLoading: datesLoading,
    isFetching: datesFetching,
    refetch: refetchDates,
  } = useQuery<NewsDatesResponse, Error>({
    queryKey: ['newsDates', examType],
    queryFn: () => apiFetchJSON<NewsDatesResponse>(`/news/${examType}/dates`),
    staleTime: 60 * 60 * 1000,
    gcTime: 120 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const {
    data: searchData,
    isFetching: searchFetching,
    error: searchError,
    refetch: refetchSearch,
  } = useQuery<NewsResponse, Error>({
    queryKey: ['newsSearch', examType, activeSearch],
    queryFn: () =>
      apiFetchJSON<NewsResponse>(`/news/${examType}/search`, {
        method: 'POST',
        body: JSON.stringify({ query: activeSearch }),
      }),
    enabled: activeSearch.trim().length > 0,
    staleTime: 60 * 60 * 1000,
    gcTime: 120 * 60 * 1000,
    retry: false,
  });

  const isSearching = activeSearch.trim().length > 0;
  const news = newsData?.news ?? [];
  const searchResults = searchData?.news ?? [];
  const sourceNews = isSearching ? searchResults : news;
  const dates = datesData?.dates ?? [];
  const feedLoading = isSearching ? searchFetching : loading;
  const feedError = isSearching ? searchError : error;
  const isRefreshing = newsFetching || datesFetching;
  const showCachedIndicator = !isSearching && !loading && !isRefreshing && news.length > 0;

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = queryInput.trim();
    if (!q) return;
    setActiveSearch(q);
    setActiveCategory('all');
  };

  const clearSearch = () => {
    setActiveSearch('');
    setQueryInput('');
    setActiveCategory('all');
  };

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

  const filteredNews = useMemo(() => {
    if (activeCategory === 'all') return sourceNews;
    return sourceNews.filter((item) => normalizeCategory(item.category) === activeCategory);
  }, [sourceNews, activeCategory]);

  const featuredNews = filteredNews[0];
  const remainingNews = filteredNews.slice(1);

  const availableCategories = useMemo(() => {
    const cats = new Set(sourceNews.map((n) => normalizeCategory(n.category)));
    return ['all', ...Array.from(cats)] as CategoryType[];
  }, [sourceNews]);

  const handleRefresh = async () => {
    await Promise.all([refetchNews(), refetchDates()]);
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <Newspaper className="w-7 h-7 text-primary" />
            {examType} News & Updates
          </h1>
          <p className="text-muted-foreground mt-1">
            Stay updated with the latest announcements and important dates
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={loading || datesLoading || isRefreshing}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Search box: query current or past exam news */}
      <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder={`Search ${examType} news — e.g. "2022 cutoff trends" or "expected 2027 exam dates"`}
            aria-label="Search exam news"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={!queryInput.trim() || searchFetching} className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            Search
          </Button>
          {isSearching && (
            <Button type="button" variant="ghost" onClick={clearSearch} className="flex items-center gap-2">
              <X className="w-4 h-4" />
              Clear
            </Button>
          )}
        </div>
      </form>

      {isSearching && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/40 px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">
            {searchFetching ? 'Searching for ' : 'Showing results for '}
            <span className="font-semibold text-foreground">&ldquo;{activeSearch}&rdquo;</span>
          </span>
          <button
            type="button"
            onClick={clearSearch}
            className="text-xs font-semibold text-primary hover:underline whitespace-nowrap"
          >
            Back to latest news
          </button>
        </div>
      )}

      {showCachedIndicator && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" title="Showing cached data and refreshing in the background when needed.">
          <div className="relative group cursor-help">
            <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-popover border border-border rounded-lg shadow-lg text-xs text-popover-foreground whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              Using cached data (auto-refresh handled by React Query)
              <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-border"></div>
            </div>
          </div>
        </div>
      )}

      {!feedLoading && sourceNews.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {availableCategories.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory(cat)}
              className="capitalize"
            >
              {categoryLabels[cat]}
            </Button>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {feedLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card rounded-2xl p-6 animate-pulse">
                  <div className="h-5 bg-muted rounded w-3/4 mb-3"></div>
                  <div className="h-3 bg-muted rounded w-full mb-2"></div>
                  <div className="h-3 bg-muted rounded w-5/6"></div>
                </div>
              ))}
            </div>
          ) : feedError ? (
            <div className="glass-card rounded-2xl p-8 text-center border-destructive/50">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
              <p className="text-destructive font-medium">
                {feedError.message?.includes('rate limit') || feedError.message?.includes('429') || feedError.message?.includes('quota')
                  ? '⏳ AI is busy — too many requests. Please wait a minute and try again.'
                  : feedError.message || 'Failed to load news.'}
              </p>
              <Button onClick={isSearching ? () => refetchSearch() : handleRefresh} variant="destructive" className="mt-4">
                Try Again
              </Button>
            </div>
          ) : filteredNews.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <Newspaper className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">
                {isSearching ? 'No results found for your search' : 'No news available for this category'}
              </p>
            </div>
          ) : (
            <>
              {featuredNews && (() => {
                const featuredCategory = normalizeCategory(featuredNews.category);
                const FeaturedIcon = categoryIcons[featuredCategory];
                return (
                  <div className="glass-card rounded-2xl p-6 border-l-4 border-l-primary">
                    <div className="flex items-start gap-4">
                      <div className={`p-4 rounded-xl flex-shrink-0 ${categoryColors[featuredCategory]}`}>
                        <FeaturedIcon className="w-7 h-7" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${categoryColors[featuredCategory]}`}>
                            {featuredCategory}
                          </span>
                          <span className="text-xs text-muted-foreground">{formatDate(featuredNews.date)}</span>
                        </div>
                        <h2 className="text-xl font-bold mb-2 leading-tight">{featuredNews.title}</h2>
                        <p className="text-muted-foreground leading-relaxed mb-3">{featuredNews.content}</p>
                        <p className="text-xs text-muted-foreground">Source: {featuredNews.source}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {remainingNews.length > 0 && (
                <div className="grid sm:grid-cols-2 gap-4">
                  {remainingNews.map((item, index) => {
                    const itemCategory = normalizeCategory(item.category);
                    const Icon = categoryIcons[itemCategory];
                    return (
                      <div
                        key={`${item.title}-${index}`}
                        className="glass-card rounded-xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className={`p-2.5 rounded-lg flex-shrink-0 ${categoryColors[itemCategory]}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>
                            <h3 className="font-semibold text-sm leading-tight mt-0.5 line-clamp-2">{item.title}</h3>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-3">{item.content}</p>
                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${categoryColors[itemCategory]}`}>
                            {itemCategory}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{item.source}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="glass-card rounded-2xl p-6 sticky top-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-bold">Important Dates</h2>
            </div>

            {datesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex gap-3">
                    <div className="w-12 h-12 bg-muted rounded-xl"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-muted rounded w-3/4"></div>
                      <div className="h-2 bg-muted rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : dates.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No upcoming dates</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dates.map((date, index) => (
                  <div
                    key={`${date.event}-${index}`}
                    className="group flex items-start gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-xl flex flex-col items-center justify-center text-primary border border-primary/20 group-hover:scale-105 transition-transform">
                      <span className="text-[10px] font-bold uppercase">
                        {new Date(date.date).toLocaleString('default', { month: 'short' })}
                      </span>
                      <span className="text-lg font-bold leading-none">{new Date(date.date).getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm mb-0.5 line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                        {date.event}
                      </h4>
                      {date.description && <p className="text-xs text-muted-foreground line-clamp-1">{date.description}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(date.date).getFullYear()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
