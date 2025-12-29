import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonList } from '@/components/Skeleton';
import { apiFetch } from '@/config/api';
import { Trophy, Medal, Crown, Flame, Clock, TrendingUp, Sparkles } from 'lucide-react';

interface LeaderboardUser {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
  totalPoints: number;
  totalStudyMinutes: number;
  streak: number;
}

const getRankIcon = (index: number) => {
  if (index === 0) return <Crown className="h-6 w-6 text-amber-500" />;
  if (index === 1) return <Medal className="h-5 w-5 text-slate-400" />;
  if (index === 2) return <Medal className="h-5 w-5 text-amber-700" />;
  return null;
};

const getRankGradient = (index: number) => {
  if (index === 0) return 'from-amber-500/20 via-yellow-500/10 to-orange-500/20 border-amber-500/30';
  if (index === 1) return 'from-slate-400/20 via-slate-300/10 to-slate-500/20 border-slate-400/30';
  if (index === 2) return 'from-amber-700/20 via-amber-600/10 to-amber-800/20 border-amber-700/30';
  return 'from-transparent to-transparent border-border/50';
};

export default function Leaderboard() {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      const res = await apiFetch('/api/users/leaderboard');
      if (res.ok) setUsers(await res.json());
      setLoading(false);
    };
    fetchLeaderboard();
  }, []);

  const topThree = users.slice(0, 3);
  const rest = users.slice(3);

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="animate-slide-up">
        <h1 className="text-3xl sm:text-4xl font-bold flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25">
            <Trophy className="h-6 w-6 text-white" />
          </div>
          Leaderboard
        </h1>
        <p className="text-muted-foreground mt-2">Top performers this week</p>
      </div>

      {/* Top 3 Podium */}
      {!loading && topThree.length >= 3 && (
        <div className="grid grid-cols-3 gap-4 animate-scale-in">
          {/* Second Place */}
          <div className="flex flex-col items-center pt-8">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-slate-400 to-slate-500 rounded-full blur-xl opacity-30 group-hover:opacity-50 transition-opacity" />
              <img src={topThree[1]?.avatar || 'https://via.placeholder.com/80'} alt={topThree[1]?.name}
                className="relative w-20 h-20 rounded-full ring-4 ring-slate-400/50 shadow-xl" />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-slate-400 to-slate-500 text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center shadow-lg">
                2
              </div>
            </div>
            <p className="mt-4 font-semibold text-sm truncate max-w-full">{topThree[1]?.username || topThree[1]?.name?.split(' ')[0]}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />{topThree[1]?.totalPoints}
            </p>
          </div>

          {/* First Place */}
          <div className="flex flex-col items-center">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full blur-xl opacity-50 group-hover:opacity-70 transition-opacity animate-pulse-glow" />
              <img src={topThree[0]?.avatar || 'https://via.placeholder.com/96'} alt={topThree[0]?.name}
                className="relative w-24 h-24 rounded-full ring-4 ring-amber-500/50 shadow-2xl" />
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <Crown className="h-8 w-8 text-amber-500 drop-shadow-lg" />
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center shadow-lg">
                1
              </div>
            </div>
            <p className="mt-4 font-bold truncate max-w-full">{topThree[0]?.username || topThree[0]?.name?.split(' ')[0]}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-4 w-4 text-amber-500" />{topThree[0]?.totalPoints}
            </p>
          </div>

          {/* Third Place */}
          <div className="flex flex-col items-center pt-12">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-700 to-amber-800 rounded-full blur-xl opacity-30 group-hover:opacity-50 transition-opacity" />
              <img src={topThree[2]?.avatar || 'https://via.placeholder.com/72'} alt={topThree[2]?.name}
                className="relative w-16 h-16 rounded-full ring-4 ring-amber-700/50 shadow-xl" />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-700 to-amber-800 text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center shadow-lg">
                3
              </div>
            </div>
            <p className="mt-4 font-semibold text-sm truncate max-w-full">{topThree[2]?.username || topThree[2]?.name?.split(' ')[0]}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />{topThree[2]?.totalPoints}
            </p>
          </div>
        </div>
      )}

      {/* Full List */}
      <Card className="overflow-hidden rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm animate-slide-up animation-delay-200">
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-500" />
            Rankings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6"><SkeletonList count={5} /></div>
          ) : (
            <div className="divide-y divide-border/50">
              {users.map((user, index) => (
                <div 
                  key={user.id} 
                  className={`
                    group flex items-center gap-4 p-4 transition-all duration-300 hover:bg-accent/30
                    bg-gradient-to-r ${getRankGradient(index)} border-l-4
                    animate-slide-up
                  `}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Rank */}
                  <div className="w-12 flex items-center justify-center">
                    {getRankIcon(index) || (
                      <span className="text-lg font-bold text-muted-foreground">{index + 1}</span>
                    )}
                  </div>
                  
                  {/* Avatar */}
                  <div className="relative">
                    <img src={user.avatar || 'https://via.placeholder.com/40'} alt={user.name}
                      className="h-12 w-12 rounded-full ring-2 ring-border group-hover:ring-violet-500/50 transition-all" />
                    {user.streak > 0 && (
                      <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Flame className="h-3 w-3" />{user.streak}
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{user.username ? `@${user.username}` : user.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {Math.floor(user.totalStudyMinutes / 60)}h {user.totalStudyMinutes % 60}m
                      </span>
                      <span className="flex items-center gap-1">
                        <Flame className="h-3 w-3 text-orange-500" />
                        {user.streak} day streak
                      </span>
                    </div>
                  </div>
                  
                  {/* Points */}
                  <div className="text-right">
                    <p className="text-xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                      {user.totalPoints}
                    </p>
                    <p className="text-xs text-muted-foreground">points</p>
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <div className="text-center py-16">
                  <Trophy className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">No users yet</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
