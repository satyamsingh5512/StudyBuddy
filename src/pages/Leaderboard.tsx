import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { SkeletonList } from '@/components/Skeleton';
import { apiFetch } from '@/config/api';

interface LeaderboardUser {
  id: string;
  name: string;
  avatar?: string;
  totalPoints: number;
  streak: number;
}

export default function Leaderboard() {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    setLoading(true);
    const res = await apiFetch('/api/users/leaderboard');
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Leaderboard</h1>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4">
              <SkeletonList count={5} />
            </div>
          ) : (
            <div className="divide-y">
              {users.map((user, index) => (
                <div key={user.id} className="flex items-center gap-4 p-4">
                  <div className="w-8 text-center font-medium text-muted-foreground">
                    {index + 1}
                  </div>
                  <img
                    src={user.avatar || 'https://via.placeholder.com/32'}
                    alt={user.name}
                    className="h-8 w-8 rounded-full"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.streak} day streak</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{user.totalPoints}</p>
                    <p className="text-xs text-muted-foreground">points</p>
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-12">No users yet</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
