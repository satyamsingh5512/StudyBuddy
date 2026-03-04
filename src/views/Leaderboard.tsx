import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Flame, Star, Award, ChevronUp } from 'lucide-react';
import { SkeletonList } from '@/components/Skeleton';
import { apiFetch } from '@/config/api';
import { getAvatarUrl } from '@/lib/avatar';

interface LeaderboardUser {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
  avatarType?: string;
  totalPoints: number;
  totalStudyMinutes: number;
  streak: number;
}

export default function Leaderboard() {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async () => {
    setLoading(true);
    const res = await apiFetch('/users/leaderboard');
    if (res.ok) {
      const data = await res.json();
      const cleanData = data.map((user: any) => ({
        ...user,
        totalPoints: typeof user.totalPoints === 'number' ? user.totalPoints : 0,
        totalStudyMinutes: typeof user.totalStudyMinutes === 'number' ? user.totalStudyMinutes : 0,
        streak: typeof user.streak === 'number' ? user.streak : 0,
      }));
      // Sort users by points explicitly just to be safe
      const sortedUsers = cleanData.sort((a: any, b: any) => b.totalPoints - a.totalPoints);
      setUsers(sortedUsers);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const topThree = users.slice(0, 3);
  const remainingUsers = users.slice(3);

  // Helper to get podium styles
  const getPodiumStyle = (rank: number) => {
    switch (rank) {
      case 1: return { height: 'h-48', color: 'from-amber-400 to-amber-600', shadow: 'shadow-amber-500/30', border: 'border-amber-400/50', icon: Trophy };
      case 2: return { height: 'h-40', color: 'from-slate-300 to-slate-500', shadow: 'shadow-slate-400/20', border: 'border-slate-300/50', icon: Medal };
      case 3: return { height: 'h-32', color: 'from-orange-700 to-stone-600', shadow: 'shadow-orange-900/40', border: 'border-orange-800/50', icon: Award };
      default: return { height: 'h-0', color: 'bg-card', shadow: '', border: '', icon: Star };
    }
  };

  return (
    <div className="space-y-12 pb-10 max-w-4xl mx-auto">
      <div className="text-center space-y-2 mt-4">
        <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/60">
          Global Leaderboard
        </h1>
        <p className="text-muted-foreground">Study consistently to climb the ranks and earn badges.</p>
      </div>

      {loading ? (
        <div className="p-4 bg-card/50 rounded-2xl border border-border/50">
          <SkeletonList count={8} />
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {topThree.length > 0 && (
            <div className="flex items-end justify-center gap-4 md:gap-8 mt-16 mb-8 px-4 h-64">
              {/* Rank 2 */}
              {topThree[1] && (
                <motion.div
                  initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, type: 'spring' }}
                  className="flex flex-col items-center relative w-1/4 max-w-[120px]"
                >
                  <div className="absolute -top-16 flex flex-col items-center pointer-events-none">
                    <img src={getAvatarUrl(topThree[1])} alt={topThree[1].name} className="w-16 h-16 rounded-full border-4 border-slate-400" />
                    <div className="bg-slate-500 text-white text-xs font-bold px-2 py-0.5 rounded-full -mt-3 z-10">#2</div>
                  </div>
                  <div className={`w-full ${getPodiumStyle(2).height} bg-gradient-to-t ${getPodiumStyle(2).color} rounded-t-xl opacity-90 border-t-2 ${getPodiumStyle(2).border} flex items-end justify-center pb-4`}>
                    <span className="font-bold text-white/90 truncate max-w-full px-2">{topThree[1].totalPoints} XP</span>
                  </div>
                </motion.div>
              )}

              {/* Rank 1 */}
              {topThree[0] && (
                <motion.div
                  initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, type: 'spring' }}
                  className="flex flex-col items-center relative w-1/3 max-w-[150px] z-10"
                >
                  <div className="absolute -top-20 flex flex-col items-center pointer-events-none">
                    <Trophy className="h-8 w-8 text-amber-400 mb-2 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
                    <img src={getAvatarUrl(topThree[0])} alt={topThree[0].name} className="w-20 h-20 rounded-full border-4 border-amber-400 drop-shadow-xl" />
                    <div className="bg-amber-500 text-white text-sm font-bold px-3 py-0.5 rounded-full -mt-3 z-10 shadow-lg">#1</div>
                  </div>
                  <div className={`w-full ${getPodiumStyle(1).height} bg-gradient-to-t ${getPodiumStyle(1).color} rounded-t-xl shadow-2xl ${getPodiumStyle(1).shadow} border-t-2 ${getPodiumStyle(1).border} flex items-end justify-center pb-6`}>
                    <span className="font-extrabold text-white text-lg truncate max-w-full px-2">{topThree[0].totalPoints} XP</span>
                  </div>
                </motion.div>
              )}

              {/* Rank 3 */}
              {topThree[2] && (
                <motion.div
                  initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, type: 'spring' }}
                  className="flex flex-col items-center relative w-1/4 max-w-[120px]"
                >
                  <div className="absolute -top-16 flex flex-col items-center pointer-events-none">
                    <img src={getAvatarUrl(topThree[2])} alt={topThree[2].name} className="w-16 h-16 rounded-full border-4 border-orange-700" />
                    <div className="bg-orange-800 text-white text-xs font-bold px-2 py-0.5 rounded-full -mt-3 z-10">#3</div>
                  </div>
                  <div className={`w-full ${getPodiumStyle(3).height} bg-gradient-to-t ${getPodiumStyle(3).color} rounded-t-xl opacity-90 border-t-2 ${getPodiumStyle(3).border} flex items-end justify-center pb-4`}>
                    <span className="font-bold text-white/90 truncate max-w-full px-2">{topThree[2].totalPoints} XP</span>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Remaining Users List */}
          <div className="space-y-3">
            {remainingUsers.map((user, index) => {
              const rank = index + 4;
              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + (index * 0.05) }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-card/80 backdrop-blur-xl border border-border/50 hover:bg-card hover:border-primary/30 transition-all shadow-sm group"
                >
                  <div className="w-8 text-center font-bold text-muted-foreground group-hover:text-primary transition-colors">
                    {rank}
                  </div>

                  <img src={getAvatarUrl(user)} alt={user.name} className="h-10 w-10 rounded-full ring-2 ring-transparent group-hover:ring-primary/20 transition-all" />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{user.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1 font-medium bg-secondary px-2 py-0.5 rounded-full">
                        <Flame className="h-3 w-3 text-orange-500" />
                        {user.streak} days
                      </span>
                      <span>{Math.floor(user.totalStudyMinutes / 60)}h {user.totalStudyMinutes % 60}m studied</span>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end">
                    <p className="text-base font-extrabold tracking-tight text-foreground">{user.totalPoints}</p>
                    <div className="flex items-center text-[10px] text-success font-medium uppercase tracking-wider">
                      <ChevronUp className="h-3 w-3 mr-0.5" />
                      XP
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {users.length === 0 && (
              <div className="text-center py-20 bg-card/50 rounded-2xl border border-border/50">
                <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground font-medium">No users on the leaderboard yet. Be the first!</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
