import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus } from 'lucide-react';
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
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 8 AM to 10 PM
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  useEffect(() => {
    fetchSchedules();
  }, [selectedDate]);

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
        // Convert database format to grid format
        const converted = data.map((item: any) => {
          const date = new Date(item.date);
          const dayIndex = (date.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
          const hour = parseInt(item.startTime.split(':')[0]);
          return {
            id: item.id,
            day: days[dayIndex],
            hour,
            text: item.title,
            date: item.date,
          };
        });
        setSchedule(converted);
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEntry = (day: string, hour: number) => {
    return schedule.find(e => e.day === day && e.hour === hour);
  };

  const getDateForDayHour = (day: string) => {
    const date = new Date(selectedDate);
    const currentDay = (date.getDay() + 6) % 7; // Convert to Mon=0
    const targetDay = days.indexOf(day);
    const diff = targetDay - currentDay;
    date.setDate(date.getDate() + diff);
    return date.toISOString().split('T')[0];
  };

  const handleCellClick = async (day: string, hour: number) => {
    if (creating) return; // Prevent multiple clicks
    
    console.log('Cell clicked:', day, hour);
    const entry = getEntry(day, hour);
    if (entry) {
      console.log('Editing existing entry:', entry);
      setEditingId(entry.id);
      setEditText(entry.text);
    } else {
      // Create new entry
      const date = getDateForDayHour(day);
      console.log('Creating new entry for date:', date);
      
      setCreating(true);
      try {
        const response = await fetch(`${API_URL}/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            date,
            startTime: `${hour.toString().padStart(2, '0')}:00`,
            endTime: `${(hour + 1).toString().padStart(2, '0')}:00`,
            title: '',
            subject: '',
            notes: '',
          }),
        });

        console.log('Response status:', response.status);
        
        if (response.ok) {
          const created = await response.json();
          console.log('Created schedule:', created);
          setSchedule(prev => [...prev, {
            id: created.id,
            day,
            hour,
            text: '',
            date,
          }]);
          setEditingId(created.id);
          setEditText('');
        } else {
          const error = await response.text();
          console.error('Failed to create schedule:', error);
          alert('Failed to create schedule. Please try again.');
        }
      } catch (error) {
        console.error('Error creating schedule:', error);
        alert('Error creating schedule. Check console for details.');
      } finally {
        setCreating(false);
      }
    }
  };

  const handleSave = async (id: string) => {
    if (editText.trim()) {
      try {
        const response = await fetch(`${API_URL}/schedule/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ title: editText.trim() }),
        });

        if (response.ok) {
          setSchedule(prev =>
            prev.map(e => (e.id === id ? { ...e, text: editText.trim() } : e))
          );
        }
      } catch (error) {
        console.error('Error updating schedule:', error);
      }
    } else {
      // If empty, remove the entry
      await handleDelete(id);
    }
    setEditingId(null);
    setEditText('');
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/schedule/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setSchedule(prev => prev.filter(e => e.id !== id));
        if (editingId === id) {
          setEditingId(null);
          setEditText('');
        }
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
    }
  };

  const handleClear = async () => {
    if (!confirm('Clear all schedule entries for this week?')) return;

    try {
      // Delete all entries in current view
      await Promise.all(schedule.map(entry => 
        fetch(`${API_URL}/schedule/${entry.id}`, {
          method: 'DELETE',
          credentials: 'include',
        })
      ));
      
      setSchedule([]);
      setEditingId(null);
      setEditText('');
    } catch (error) {
      console.error('Error clearing schedule:', error);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 pb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-2xl md:text-3xl font-bold">Weekly Schedule</h1>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleClear}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear All
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Time Planner</CardTitle>
          <p className="text-sm text-muted-foreground">Click on any time slot to add or edit tasks</p>
        </CardHeader>
        <CardContent className="p-2 md:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-250px)]">
              <div className="min-w-[600px] md:min-w-[800px]">
                {/* Header Row */}
                <div className="grid grid-cols-8 gap-1 md:gap-2 mb-2 sticky top-0 bg-background z-10 pb-2">
                  <div className="w-16 md:w-20"></div>
                  {days.map((day) => (
                    <div key={day} className="text-center font-semibold text-xs md:text-sm p-1 md:p-2 bg-primary/10 rounded">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Time Slots */}
                {hours.map((hour) => (
                  <div key={`row-${hour}`} className="grid grid-cols-8 gap-1 md:gap-2 mb-1 md:mb-2">
                    <div className="w-16 md:w-20 text-xs md:text-sm text-muted-foreground font-medium py-2 px-1 flex items-start justify-end sticky left-0 bg-background">
                      {hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`}
                    </div>
                    {days.map((day) => {
                      const entry = getEntry(day, hour);
                      const isEditing = editingId === entry?.id;
                      
                      return (
                        <div
                          key={`${day}-${hour}`}
                          className={`
                            relative border rounded min-h-[60px] md:min-h-[70px] transition-all
                            ${entry && !isEditing ? 'bg-primary/5 border-primary/20 hover:bg-primary/10' : 'hover:bg-accent/30 border-border'}
                            ${isEditing ? 'ring-2 ring-primary' : ''}
                            cursor-pointer group
                          `}
                          onClick={() => !isEditing && handleCellClick(day, hour)}
                        >
                          {entry && !isEditing && (
                            <div className="p-1.5 md:p-2 h-full flex flex-col justify-between">
                              <p className="text-xs md:text-sm line-clamp-3 break-words">{entry.text}</p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(entry.id);
                                }}
                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive/80 hover:bg-destructive text-destructive-foreground rounded p-1"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                          
                          {isEditing && (
                            <div className="p-1.5 md:p-2 h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
                              <textarea
                                autoFocus
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onBlur={() => handleSave(entry!.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSave(entry!.id);
                                  } else if (e.key === 'Escape') {
                                    setEditingId(null);
                                    setEditText('');
                                  }
                                }}
                                placeholder="Enter task..."
                                className="w-full h-full text-xs md:text-sm bg-transparent border-none outline-none resize-none"
                              />
                              <div className="text-xs text-muted-foreground mt-1">
                                Press Enter to save, Esc to cancel
                              </div>
                            </div>
                          )}
                          
                          {!entry && !isEditing && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
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
