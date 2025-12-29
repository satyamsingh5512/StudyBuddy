import { useState, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, Check, CheckCheck, Trash2, MessageCircle, Users, Sparkles } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/components/ui/use-toast';
import { API_URL } from '@/config/api';
import { soundManager } from '@/lib/sounds';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Message {
  id: string;
  message: string;
  createdAt: string;
  read?: boolean;
  user: {
    id: string;
    name: string;
    username?: string;
    avatar?: string;
    showProfile?: boolean;
    examGoal?: string;
    streak?: number;
  };
}

interface UserProfile {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
  examGoal?: string;
  streak?: number;
}

export default function Chat() {
  const [user] = useAtom(userAtom);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const newSocket = io(API_URL, { withCredentials: true });

    newSocket.on('connect', () => newSocket.emit('join-chat', user?.id));
    newSocket.on('chat-history', (history: Message[]) => {
      setMessages(history);
      setUnreadCount(history.filter((m) => !m.read && m.user.id !== user?.id).length);
    });
    newSocket.on('new-message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
      if (message.user.id !== user?.id) {
        soundManager.playMessageNotification();
        setUnreadCount((prev) => prev + 1);
      }
    });
    newSocket.on('message-deleted', (messageId: string) => setMessages((prev) => prev.filter((m) => m.id !== messageId)));
    newSocket.on('online-users', (users: string[]) => setOnlineUsers(new Set(users)));
    newSocket.on('user-online', (userId: string) => setOnlineUsers((prev) => new Set([...prev, userId])));
    newSocket.on('user-offline', (userId: string) => {
      setOnlineUsers((prev) => { const s = new Set(prev); s.delete(userId); return s; });
    });
    newSocket.on('rate-limit', (data: { remainingSeconds: number }) => {
      toast({ title: 'Slow mode', description: `Wait ${data.remainingSeconds}s`, variant: 'destructive' });
    });

    setSocket(newSocket);
    return () => { newSocket.close(); };
  }, [user?.id, toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (messages.length > 0 && socket) {
      const unread = messages.filter((m) => !m.read && m.user.id !== user?.id);
      if (unread.length > 0) {
        socket.emit('mark-read', unread.map((m) => m.id));
        setUnreadCount(0);
      }
    }
  }, [messages, socket, user?.id]);

  const sendMessage = () => {
    if (!newMessage.trim() || !socket) return;
    socket.emit('send-message', { message: newMessage });
    setNewMessage('');
  };

  const deleteMessage = (messageId: string) => socket?.emit('delete-message', messageId);

  const viewProfile = (userId: string) => {
    const msg = messages.find((m) => m.user.id === userId);
    if (!msg) return;
    if (msg.user.showProfile === false) {
      toast({ title: 'Profile hidden', description: 'This user has a private profile' });
      return;
    }
    setSelectedProfile({
      id: msg.user.id, name: msg.user.name, username: msg.user.username,
      avatar: msg.user.avatar, examGoal: msg.user.examGoal, streak: msg.user.streak,
    });
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between animate-slide-up">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-violet-500/25">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            Community Chat
          </h1>
          <p className="text-muted-foreground mt-2">Connect with fellow students</p>
        </div>
        {unreadCount > 0 && (
          <Badge className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-4 py-2 text-sm rounded-full shadow-lg">
            {unreadCount} unread
          </Badge>
        )}
      </div>

      <Card className="h-[600px] flex flex-col overflow-hidden rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm animate-scale-in">
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-indigo-500/5 to-violet-500/5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-500" />
                Global Chat
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Slow mode: 30 seconds</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{onlineUsers.size} online</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, index) => {
              const isOnline = onlineUsers.has(msg.user.id);
              const isOwn = msg.user.id === user?.id;
              const displayName = msg.user.username || msg.user.name;
              
              return (
                <div 
                  key={msg.id} 
                  className={`flex gap-3 group animate-slide-up ${isOwn ? 'flex-row-reverse' : ''}`}
                  style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
                >
                  <button onClick={() => viewProfile(msg.user.id)} className="flex-shrink-0 relative">
                    <img src={msg.user.avatar || 'https://via.placeholder.com/40'} alt={displayName}
                      className="h-10 w-10 rounded-full ring-2 ring-border hover:ring-violet-500/50 transition-all" />
                    {isOnline && (
                      <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
                    )}
                  </button>
                  
                  <div className={`flex-1 max-w-[75%] ${isOwn ? 'text-right' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {!isOwn && (
                        <button onClick={() => viewProfile(msg.user.id)} className="font-semibold text-sm hover:text-violet-500 transition-colors">
                          {displayName}
                        </button>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isOwn && (
                        <>
                          {msg.read ? <CheckCheck className="h-3 w-3 text-blue-500" /> : <Check className="h-3 w-3 text-muted-foreground" />}
                          <button onClick={() => deleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="h-3 w-3 text-destructive hover:text-destructive/80" />
                          </button>
                        </>
                      )}
                    </div>
                    <div className={`inline-block px-4 py-2.5 rounded-2xl ${
                      isOwn 
                        ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-br-md' 
                        : 'bg-muted/50 rounded-bl-md'
                    }`}>
                      <p className="text-sm">{msg.message}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border/50 bg-gradient-to-r from-indigo-500/5 to-violet-500/5">
            <div className="flex gap-3">
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                className="h-12 rounded-2xl border-2 border-border/50 focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/10"
              />
              <Button onClick={sendMessage} size="icon"
                className="h-12 w-12 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-500/25 transition-all hover:-translate-y-1">
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Dialog */}
      <Dialog open={!!selectedProfile} onOpenChange={() => setSelectedProfile(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>User Profile</DialogTitle></DialogHeader>
          {selectedProfile && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full blur-xl opacity-50" />
                  <img src={selectedProfile.avatar || 'https://via.placeholder.com/80'} alt={selectedProfile.name}
                    className="relative h-20 w-20 rounded-full ring-4 ring-violet-500/30" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedProfile.username || selectedProfile.name}</h3>
                  {selectedProfile.username && <p className="text-sm text-muted-foreground">{selectedProfile.name}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {selectedProfile.examGoal && (
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20">
                    <p className="text-xs text-muted-foreground">Exam Goal</p>
                    <p className="font-bold mt-1">{selectedProfile.examGoal}</p>
                  </div>
                )}
                {selectedProfile.streak !== undefined && (
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/20">
                    <p className="text-xs text-muted-foreground">Streak</p>
                    <p className="font-bold mt-1">{selectedProfile.streak} days 🔥</p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className={onlineUsers.has(selectedProfile.id) ? 'text-emerald-500' : 'text-muted-foreground'}>
                  {onlineUsers.has(selectedProfile.id) ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
