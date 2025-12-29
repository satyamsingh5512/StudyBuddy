import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Calendar, Clock } from 'lucide-react';
import { API_URL } from '@/config/api';

interface ScheduleEntry {
  id: string;
  day: string;
  hour: number;
  text: string;
  date: string;
}

export default function Schedule() {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const hours = Array.from({ length: 14 }, (_, i) => i + 8);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        setLoading(true);
        const startDate = new Date(selectedDate);
        startDate.setDate(startDate.getDate() - 7);
        const endDate = new Date(selectedDate);
        endDate.setDate(endDate.getDate() + 7);

        const response = await fetch(
          `${API_URL}/schedule?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
          { credentials: 'include' }
        );
        
        if (response.ok) {
          const data = await response.json();
          const converted = data.map((item: any) => {
            const date = new Date(item.date);
            const dayIndex = (date.getDay() + 6) % 7;
            return { id: item.id, day: days[dayIndex], hour: parseInt(item.startTime.split(':')[0]), text: item.title, date: item.date };
          });
          setSchedule(converted);
        }
      } catch (error) {
        console.error('Error fetching schedules:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSchedules();
  }, [selectedDate]);

  const getEntry = (day: string, hour: number) => schedule.find(e => e.day === day && e.hour === hour);

  const getDateForDayHour = (day: string) => {
    const date = new Date(selectedDate);
    const currentDay = (date.getDay() + 6) % 7;
    const targetDay = days.indexOf(day);
    date.setDate(date.getDate() + (targetDay - currentDay));
    return date.toISOString().split('T')[0];
  };

  const handleCellClick = async (day: string, hour: number) => {
    if (creating) return;
    const entry = getEntry(day, hour);
    if (entry) {
      setEditingId(entry.id);
      setEditText(entry.text);
    } else {
      const date = getDateForDayHour(day);
      setCreating(true);
      try {
        const response = await fetch(`${API_URL}/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ date, startTime: `${hour.toString().padStart(2, '0')}:00`, endTime: `${(hour + 1).toString().padStart(2, '0')}:00`, title: '', subject: '', notes: '' }),
        });
        if (response.ok) {
          const created = await response.json();
          setSchedule(prev => [...prev, { id: created.id, day, hour, text: '', date }]);
          setEditingId(created.id);
          setEditText('');
        }
      } catch (error) {
        console.error('Error creating schedule:', error);
      } finally {
        setCreating(false);
      }
    }
  };

  const handleSave = async (id: string) => {
    if (editText.trim()) {
      try {
        await fetch(`${API_URL}/schedule/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ title: editText.trim() }),
        });
        setSchedule(prev => prev.map(e => (e.id === id ? { ...e, text: editText.trim() } : e)));
      } catch (error) {
        console.error('Error updating schedule:', error);
      }
    } else {
      await handleDelete(id);
    }
    setEditingId(null);
    setEditText('');
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API_URL}/schedule/${id}`, { method: 'DELETE', credentials: 'include' });
      setSchedule(prev => prev.filter(e => e.id !== id));
      if (editingId === id) { setEditingId(null); setEditText(''); }
    } catch (error) {
      console.error('Error deleting schedule:', error);
    }
  };

  const handleClear = async () => {
    if (!confirm('Clear all schedule entries for this week?')) return;
    await Promise.all(schedule.map(entry => fetch(`${API_URL}/schedule/${entry.id}`, { method: 'DELETE', credentials: 'include' })));
    setSchedule([]);
    setEditingId(null);
    setEditText('');
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-slide-up">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/25">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            Weekly Schedule
          </h1>
          <p className="text-muted-foreground mt-2">Plan your study sessions</p>
        </div>
        <div className="flex items-center gap-3">
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
            className="h-11 rounded-xl border-2 border-border/50 focus:border-blue-500/50" />
          <Button variant="outline" onClick={handleClear} className="rounded-xl border-2 hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />Clear
          </Button>
        </div>
      </div>
      
      <Card className="overflow-hidden rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm animate-scale-in">
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-blue-500/5 to-cyan-500/5">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            Time Planner
          </CardTitle>
          <p className="text-sm text-muted-foreground">Click any slot to add or edit tasks</p>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-full blur-xl opacity-50 animate-pulse" />
                <div className="relative h-12 w-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]">
              <div className="min-w-[700px]">
                {/* Header Row */}
                <div className="grid grid-cols-8 gap-2 mb-3 sticky top-0 bg-background/80 backdrop-blur-sm z-10 pb-2">
                  <div className="w-16" />
                  {days.map((day) => (
                    <div key={day} className="text-center font-semibold text-sm p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Time Slots */}
                {hours.map((hour) => (
                  <div key={`row-${hour}`} className="grid grid-cols-8 gap-2 mb-2">
                    <div className="w-16 text-xs text-muted-foreground font-medium py-3 px-2 flex items-start justify-end">
                      {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                    </div>
                    {days.map((day) => {
                      const entry = getEntry(day, hour);
                      const isEditing = editingId === entry?.id;
                      
                      return (
                        <div
                          key={`${day}-${hour}`}
                          className={`
                            relative rounded-xl min-h-[70px] transition-all duration-300 cursor-pointer group overflow-hidden
                            ${entry && !isEditing 
                              ? 'bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-2 border-blue-500/30 hover:border-blue-500/50' 
                              : 'bg-muted/30 border-2 border-transparent hover:border-blue-500/30 hover:bg-blue-500/5'
                            }
                            ${isEditing ? 'ring-2 ring-blue-500 border-blue-500' : ''}
                          `}
                          onClick={() => !isEditing && handleCellClick(day, hour)}
                        >
                          {entry && !isEditing && (
                            <div className="p-2 h-full flex flex-col justify-between">
                              <p className="text-xs font-medium line-clamp-3">{entry.text}</p>
                              <button onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-destructive/90 hover:bg-destructive text-white">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                          
                          {isEditing && (
                            <div className="p-2 h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
                              <textarea autoFocus value={editText} onChange={(e) => setEditText(e.target.value)}
                                onBlur={() => handleSave(entry!.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(entry!.id); }
                                  else if (e.key === 'Escape') { setEditingId(null); setEditText(''); }
                                }}
                                placeholder="Enter task..."
                                className="w-full h-full text-xs bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/50"
                              />
                            </div>
                          )}
                          
                          {!entry && !isEditing && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="p-2 rounded-full bg-blue-500/20">
                                <Plus className="h-4 w-4 text-blue-500" />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
