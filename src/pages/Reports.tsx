import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/config/api';

interface Report {
  id: string;
  date: string;
  tasksPlanned: number;
  tasksCompleted: number;
  questionsEasy: number;
  questionsMedium: number;
  questionsHard: number;
  studyHours: number;
  understanding: number;
  completionPct: number;
}

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();

  const fetchReports = async () => {
    const res = await apiFetch('/reports');
    if (res.ok) {
      const data = await res.json();
      setReports(data);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const submitReport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const tasksPlanned = Number(formData.get('tasksPlanned'));
    const tasksCompleted = Number(formData.get('tasksCompleted'));
    
    const data = {
      tasksPlanned,
      tasksCompleted,
      questionsEasy: Number(formData.get('questionsEasy')),
      questionsMedium: Number(formData.get('questionsMedium')),
      questionsHard: Number(formData.get('questionsHard')),
      studyHours: Number(formData.get('studyHours')),
      understanding: Number(formData.get('understanding')),
      completionPct: (tasksCompleted / tasksPlanned) * 100,
    };

    const res = await apiFetch('/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      toast({ title: 'Report submitted successfully' });
      setShowForm(false);
      fetchReports();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Daily Reports</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'New Report'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Submit Daily Report</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitReport} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tasksPlanned">Tasks Planned</Label>
                  <Input id="tasksPlanned" name="tasksPlanned" type="number" required />
                </div>
                <div>
                  <Label htmlFor="tasksCompleted">Tasks Completed</Label>
                  <Input id="tasksCompleted" name="tasksCompleted" type="number" required />
                </div>
                <div>
                  <Label htmlFor="questionsEasy">Easy Questions</Label>
                  <Input id="questionsEasy" name="questionsEasy" type="number" required />
                </div>
                <div>
                  <Label htmlFor="questionsMedium">Medium Questions</Label>
                  <Input id="questionsMedium" name="questionsMedium" type="number" required />
                </div>
                <div>
                  <Label htmlFor="questionsHard">Hard Questions</Label>
                  <Input id="questionsHard" name="questionsHard" type="number" required />
                </div>
                <div>
                  <Label htmlFor="studyHours">Study Hours</Label>
                  <Input id="studyHours" name="studyHours" type="number" step="0.5" required />
                </div>
                <div>
                  <Label htmlFor="understanding">Understanding (1-5)</Label>
                  <Input id="understanding" name="understanding" type="number" min="1" max="5" required />
                </div>
              </div>
              <Button type="submit">Submit Report</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {new Date(report.date).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {report.tasksCompleted}/{report.tasksPlanned} tasks • {report.studyHours}h study
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{Math.round(report.completionPct)}%</p>
                  <p className="text-sm text-muted-foreground">completion</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
