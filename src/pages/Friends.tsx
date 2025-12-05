import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  UserPlus, 
  UserCheck, 
  UserX, 
  MessageCircle, 
  Users,
  Clock,
  Check,
  X,
  Ban,
  Shield
} from 'lucide-react';
import { API_URL } from '@/config/api';

interface User {
  id: string;
  username: string;
  name: string;
  avatar: string;
  avatarType: string;
  examGoal: string;
  totalPoints: number;
  friendshipStatus?: string | null;
  isSender?: boolean;
  lastActive?: string;
}

interface FriendRequest {
  id: string;
  sender: User;
  createdAt: string;
}

interface BlockedUser {
  id: string;
  blocked: User;
  createdAt: string;
}

export default function Friends() {
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search' | 'blocked'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (activeTab === 'friends') fetchFriends();
    if (activeTab === 'requests') fetchRequests();
    if (activeTab === 'blocked') fetchBlocked();
  }, [activeTab]);

  const fetchFriends = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/friends/list`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setFriends(data);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/friends/requests`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBlocked = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/friends/blocked`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setBlocked(data);
      }
    } catch (error) {
      console.error('Error fetching blocked users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      const response = await fetch(
        `${API_URL}/friends/search?query=${encodeURIComponent(searchQuery)}`,
        { credentials: 'include' }
      );
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (userId: string) => {
    try {
      const response = await fetch(`${API_URL}/friends/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ receiverId: userId }),
      });
      if (response.ok) {
        handleSearch(); // Refresh search results
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
    }
  };

  const acceptRequest = async (requestId: string) => {
    try {
      const response = await fetch(`${API_URL}/friends/request/${requestId}/accept`, {
        method: 'PUT',
        credentials: 'include',
      });
      if (response.ok) {
        fetchRequests();
        fetchFriends();
      }
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      const response = await fetch(`${API_URL}/friends/request/${requestId}/reject`, {
        method: 'PUT',
        credentials: 'include',
      });
      if (response.ok) {
        fetchRequests();
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  const unfriend = async (friendshipId: string) => {
    if (!confirm('Are you sure you want to unfriend this user?')) return;

    try {
      const response = await fetch(`${API_URL}/friends/${friendshipId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
        fetchFriends();
      }
    } catch (error) {
      console.error('Error unfriending:', error);
    }
  };

  const blockUser = async (userId: string) => {
    if (!confirm('Are you sure you want to block this user?')) return;

    try {
      const response = await fetch(`${API_URL}/friends/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId }),
      });
      if (response.ok) {
        fetchFriends();
        setActiveTab('blocked');
      }
    } catch (error) {
      console.error('Error blocking user:', error);
    }
  };

  const unblockUser = async (userId: string) => {
    try {
      const response = await fetch(`${API_URL}/friends/block/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
        fetchBlocked();
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
    }
  };

  const openChat = (userId: string) => {
    navigate(`/messages/${userId}`);
  };

  const renderUserCard = (user: User, actions: React.ReactNode) => (
    <div
      key={user.id}
      className="flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 hover:border-primary/50 hover:shadow-sm"
    >
      <img
        src={user.avatar || 'https://via.placeholder.com/40'}
        alt={user.username}
        className="h-10 w-10 rounded-full ring-2 ring-border"
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">@{user.username}</p>
        <p className="text-xs text-muted-foreground truncate">{user.name}</p>
        <p className="text-xs text-muted-foreground">{user.examGoal} • {user.totalPoints} pts</p>
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );

  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-2xl md:text-3xl font-bold">Friends</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button
          variant={activeTab === 'friends' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('friends')}
          className="flex items-center gap-2"
        >
          <Users className="h-4 w-4" />
          Friends ({friends.length})
        </Button>
        <Button
          variant={activeTab === 'requests' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('requests')}
          className="flex items-center gap-2"
        >
          <Clock className="h-4 w-4" />
          Requests ({requests.length})
        </Button>
        <Button
          variant={activeTab === 'search' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('search')}
          className="flex items-center gap-2"
        >
          <Search className="h-4 w-4" />
          Search
        </Button>
        <Button
          variant={activeTab === 'blocked' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('blocked')}
          className="flex items-center gap-2"
        >
          <Ban className="h-4 w-4" />
          Blocked ({blocked.length})
        </Button>
      </div>

      {/* Search Tab */}
      {activeTab === 'search' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Search Users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by username or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={loading}>
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((user) =>
                  renderUserCard(
                    user,
                    <>
                      {!user.friendshipStatus && (
                        <Button
                          size="sm"
                          onClick={() => sendFriendRequest(user.id)}
                          className="flex items-center gap-1"
                        >
                          <UserPlus className="h-4 w-4" />
                          Add
                        </Button>
                      )}
                      {user.friendshipStatus === 'PENDING' && (
                        <Button size="sm" variant="outline" disabled>
                          {user.isSender ? 'Sent' : 'Pending'}
                        </Button>
                      )}
                      {user.friendshipStatus === 'ACCEPTED' && (
                        <Button size="sm" variant="outline" disabled>
                          <UserCheck className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )
                )}
              </div>
            )}

            {searchResults.length === 0 && searchQuery && !loading && (
              <p className="text-center text-muted-foreground py-8">No users found</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Friends Tab */}
      {activeTab === 'friends' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">My Friends</CardTitle>
          </CardHeader>
          <CardContent>
            {friends.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No friends yet. Search for users to add!
              </p>
            ) : (
              <div className="space-y-2">
                {friends.map((friend) =>
                  renderUserCard(
                    friend,
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openChat(friend.id)}
                        className="flex items-center gap-1"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => unfriend((friend as any).friendshipId)}
                        className="text-destructive hover:text-destructive"
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => blockUser(friend.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    </>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Friend Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No pending requests</p>
            ) : (
              <div className="space-y-2">
                {requests.map((request) =>
                  renderUserCard(
                    request.sender,
                    <>
                      <Button
                        size="sm"
                        onClick={() => acceptRequest(request.id)}
                        className="flex items-center gap-1"
                      >
                        <Check className="h-4 w-4" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectRequest(request.id)}
                        className="flex items-center gap-1"
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Blocked Tab */}
      {activeTab === 'blocked' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Blocked Users</CardTitle>
          </CardHeader>
          <CardContent>
            {blocked.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No blocked users</p>
            ) : (
              <div className="space-y-2">
                {blocked.map((block) =>
                  renderUserCard(
                    block.blocked,
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => unblockUser(block.blocked.id)}
                      className="flex items-center gap-1"
                    >
                      <Shield className="h-4 w-4" />
                      Unblock
                    </Button>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
