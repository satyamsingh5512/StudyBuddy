import { useState } from 'react';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { User, Sparkles, Loader2, HelpCircle } from 'lucide-react';
import ImageUpload from '@/components/ImageUpload';
import UsernameInput from '@/components/UsernameInput';
import { apiFetch } from '@/config/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import UnifiedPageWrapper from '@/components/UnifiedPageWrapper';

const AVATAR_STYLES = [
  { id: 'adventurer', name: 'Adventurer' },
  { id: 'avataaars', name: 'Avataaars' },
  { id: 'bottts', name: 'Bottts' },
  { id: 'lorelei', name: 'Lorelei' },
  { id: 'micah', name: 'Micah' },
  { id: 'pixel-art', name: 'Pixel Art' },
];

const EXAMS = [
  // Engineering
  { id: 'JEE_MAIN', name: 'JEE Main', category: 'Engineering', hasAttempts: true },
  { id: 'JEE_ADVANCED', name: 'JEE Advanced', category: 'Engineering', hasAttempts: true },
  { id: 'BITSAT', name: 'BITSAT', category: 'Engineering', hasAttempts: false },
  { id: 'VITEEE', name: 'VITEEE', category: 'Engineering', hasAttempts: false },
  { id: 'SRMJEEE', name: 'SRMJEEE', category: 'Engineering', hasAttempts: false },
  { id: 'WBJEE', name: 'WBJEE', category: 'Engineering', hasAttempts: false },
  { id: 'MHT_CET', name: 'MHT-CET', category: 'Engineering', hasAttempts: false },

  // Medical
  { id: 'NEET_UG', name: 'NEET UG', category: 'Medical', hasAttempts: true },
  { id: 'NEET_PG', name: 'NEET PG', category: 'Medical', hasAttempts: false },
  { id: 'AIIMS', name: 'AIIMS', category: 'Medical', hasAttempts: false },

  // Government/Civil Services
  { id: 'UPSC_CSE', name: 'UPSC Civil Services', category: 'Government', hasAttempts: false },
  { id: 'UPSC_NDA', name: 'UPSC NDA', category: 'Government', hasAttempts: false },
  { id: 'UPSC_CDS', name: 'UPSC CDS', category: 'Government', hasAttempts: false },
  { id: 'SSC_CGL', name: 'SSC CGL', category: 'Government', hasAttempts: false },
  { id: 'SSC_CHSL', name: 'SSC CHSL', category: 'Government', hasAttempts: false },
  { id: 'IBPS_PO', name: 'IBPS PO', category: 'Government', hasAttempts: false },
  { id: 'IBPS_CLERK', name: 'IBPS Clerk', category: 'Government', hasAttempts: false },
  { id: 'SBI_PO', name: 'SBI PO', category: 'Government', hasAttempts: false },
  { id: 'RBI_GRADE_B', name: 'RBI Grade B', category: 'Government', hasAttempts: false },
  { id: 'RAILWAYS', name: 'Railway Exams', category: 'Government', hasAttempts: false },

  // MBA/Management
  { id: 'CAT', name: 'CAT', category: 'MBA', hasAttempts: false },
  { id: 'XAT', name: 'XAT', category: 'MBA', hasAttempts: false },
  { id: 'SNAP', name: 'SNAP', category: 'MBA', hasAttempts: false },
  { id: 'MAT', name: 'MAT', category: 'MBA', hasAttempts: false },
  { id: 'CMAT', name: 'CMAT', category: 'MBA', hasAttempts: false },
  { id: 'NMAT', name: 'NMAT', category: 'MBA', hasAttempts: false },

  // Graduate/Post Graduate
  { id: 'GATE', name: 'GATE', category: 'Graduate', hasAttempts: false },
  { id: 'NET_JRF', name: 'UGC NET/JRF', category: 'Graduate', hasAttempts: false },
  { id: 'CSIR_NET', name: 'CSIR NET', category: 'Graduate', hasAttempts: false },
  { id: 'CUET_UG', name: 'CUET UG', category: 'Graduate', hasAttempts: false },
  { id: 'CUET_PG', name: 'CUET PG', category: 'Graduate', hasAttempts: false },

  // Law
  { id: 'CLAT', name: 'CLAT', category: 'Law', hasAttempts: false },
  { id: 'AILET', name: 'AILET', category: 'Law', hasAttempts: false },
  { id: 'LSAT', name: 'LSAT India', category: 'Law', hasAttempts: false },

  // Defence
  { id: 'AFCAT', name: 'AFCAT', category: 'Defence', hasAttempts: false },
  { id: 'CAPF', name: 'CAPF', category: 'Defence', hasAttempts: false },

  // Design & Architecture
  { id: 'NATA', name: 'NATA', category: 'Architecture', hasAttempts: false },
  { id: 'NID', name: 'NID DAT', category: 'Design', hasAttempts: false },
  { id: 'NIFT', name: 'NIFT', category: 'Design', hasAttempts: false },
  { id: 'UCEED', name: 'UCEED', category: 'Design', hasAttempts: false },

  // School Level
  { id: 'NTSE', name: 'NTSE', category: 'School', hasAttempts: false },
  { id: 'KVPY', name: 'KVPY', category: 'School', hasAttempts: false },
  { id: 'OLYMPIAD', name: 'Olympiads', category: 'School', hasAttempts: false },
  { id: 'BOARDS_10', name: 'Class 10 Boards', category: 'School', hasAttempts: false },
  { id: 'BOARDS_12', name: 'Class 12 Boards', category: 'School', hasAttempts: false },

  // Other
  { id: 'CUSTOM', name: '🎯 Custom Goal', category: 'Other', hasAttempts: false },
];

const CLASSES = ['11th', '12th', 'Dropper', 'Graduate', 'Working Professional'];

export default function Onboarding() {
  const [user, setUser] = useAtom(userAtom);
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [usernameValid, setUsernameValid] = useState(false);
  const [avatarType, setAvatarType] = useState<'photo' | 'animated'>('photo');
  const [uploadedAvatar, setUploadedAvatar] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState('adventurer');
  const [examGoal, setExamGoal] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [batch, setBatch] = useState('');
  const [examAttempt, setExamAttempt] = useState(1);
  const [loading, setLoading] = useState(false);
  const [faqs, setFaqs] = useState<any[]>([]);
  const { toast } = useToast();

  const selectedExam = EXAMS.find((e) => e.id === examGoal);
  const maxAttempts = examGoal.startsWith('JEE') ? 3 : examGoal.startsWith('NEET') ? 2 : 0;

  const fetchExamData = async () => {
    if (!examGoal) return;

    try {
      const res = await apiFetch('/ai/exam-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examType: examGoal }),
      });

      if (res.ok) {
        await res.json();
        toast({ title: 'Exam information fetched successfully' });
      }
    } catch (error) {
      console.error('Failed to fetch exam data:', error);
    }
  };

  const fetchFAQs = async () => {
    if (!examGoal) return;

    try {
      const res = await apiFetch(`/faqs/${examGoal}`);
      if (res.ok) {
        const data = await res.json();
        setFaqs(data);
      }
    } catch (error) {
      console.error('Failed to fetch FAQs:', error);
    }
  };

  const handleSubmit = async () => {
    if (!username.trim()) {
      toast({ title: 'Username required', variant: 'destructive' });
      return;
    }

    if (!examGoal || !studentClass || !batch) {
      toast({ title: 'Please complete all fields', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      let finalAvatarType = avatarType;
      let finalAvatarUrl = null;

      if (avatarType === 'animated') {
        finalAvatarType = 'animated' as const;
        finalAvatarUrl = selectedStyle; // Store the style in avatar field
      } else {
        finalAvatarUrl = uploadedAvatar || user?.avatar;
      }

      // Fetch exam date from AI
      let examDate = null;
      try {
        const examInfoRes = await apiFetch('/ai/exam-date', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ examType: examGoal, batch }),
        });

        if (examInfoRes.ok) {
          const examInfo = await examInfoRes.json();
          examDate = examInfo.examDate;
        }
      } catch (error) {
        console.error('Failed to fetch exam date:', error);
      }

      const res = await apiFetch('/users/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          avatarType: finalAvatarType,
          avatar: finalAvatarUrl,
          examGoal,
          studentClass,
          batch,
          examAttempt: selectedExam?.hasAttempts ? examAttempt : null,
          examDate, // Include exam date
        }),
      });

      if (res.ok) {
        const updatedUser = await res.json();
        setUser(updatedUser);
        toast({
          title: `🎉 Welcome aboard, ${name}!`,
          description: "Your journey to success starts now. We're thrilled to have you with us!"
        });
      } else {
        const error = await res.json();
        toast({ title: error.error || 'Failed to complete onboarding', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Something went wrong', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <UnifiedPageWrapper>
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Welcome to StudyBuddy!</CardTitle>
            <CardDescription>Let's set up your profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Username */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="username">Choose a username</Label>
                  <UsernameInput
                    value={username}
                    onChange={setUsername}
                    onValidationChange={setUsernameValid}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This will be your unique identifier on StudyBuddy
                  </p>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button onClick={() => setStep(2)} disabled={!usernameValid} className="flex-1">
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Exam Details */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Label>Which exam are you preparing for?</Label>
                  <Select value={examGoal} onValueChange={setExamGoal}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select exam" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EXAMS.reduce((acc, exam) => {
                        const category = exam.category || 'Other';
                        if (!acc[category]) acc[category] = [];
                        acc[category].push(exam);
                        return acc;
                      }, {} as Record<string, typeof EXAMS>)).map(([category, exams]) => (
                        <div key={category}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/30">
                            {category}
                          </div>
                          {exams.map((exam) => (
                            <SelectItem key={exam.id} value={exam.id}>
                              {exam.name}
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {examGoal && (
                  <>
                    <div>
                      <Label>Current Class/Status</Label>
                      <Select value={studentClass} onValueChange={setStudentClass}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                          {CLASSES.map((cls) => (
                            <SelectItem key={cls} value={cls}>
                              {cls}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Academic Batch</Label>
                      <Select value={batch} onValueChange={setBatch}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select batch" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2024-25">2024-25</SelectItem>
                          <SelectItem value="2025-26">2025-26</SelectItem>
                          <SelectItem value="2026-27">2026-27</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedExam?.hasAttempts && (
                      <div>
                        <Label>Exam Attempt</Label>
                        <Select
                          value={examAttempt.toString()}
                          onValueChange={(v) => setExamAttempt(Number(v))}
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: maxAttempts }, (_, i) => i + 1).map((num) => (
                              <SelectItem key={num} value={num.toString()}>
                                Attempt {num}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Maximum {maxAttempts} attempts allowed
                        </p>
                      </div>
                    )}

                    {faqs.length > 0 && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="w-full gap-2">
                            <HelpCircle className="h-4 w-4" />
                            View FAQs about {examGoal}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>{examGoal} - Frequently Asked Questions</DialogTitle>
                            <DialogDescription>
                              Important information about the exam
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            {faqs.map((faq) => (
                              <div key={faq.id} className="space-y-2">
                                <h4 className="font-medium">{faq.question}</h4>
                                <p className="text-sm text-muted-foreground">{faq.answer}</p>
                              </div>
                            ))}
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </>
                )}

                <div className="flex gap-4 pt-4">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                    Back
                  </Button>
                  <Button
                    onClick={() => {
                      fetchExamData();
                      fetchFAQs();
                      setStep(3);
                    }}
                    disabled={!examGoal || !studentClass || !batch}
                    className="flex-1"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Avatar */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <Label>Choose your avatar style</Label>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <button
                      onClick={() => setAvatarType('photo')}
                      className={`p-4 rounded-lg border-2 transition-all ${avatarType === 'photo'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                        }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div className="text-center">
                          <p className="font-medium">Upload Photo</p>
                          <p className="text-xs text-muted-foreground">Upload your own picture</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setAvatarType('animated')}
                      className={`p-4 rounded-lg border-2 transition-all ${avatarType === 'animated'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                        }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                          <Sparkles className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div className="text-center">
                          <p className="font-medium">Animated Avatar</p>
                          <p className="text-xs text-muted-foreground">Choose a fun style</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {avatarType === 'photo' && (
                  <div className="flex justify-center">
                    <ImageUpload
                      type="profile"
                      currentImage={uploadedAvatar || user?.avatar}
                      onUploadComplete={(url) => setUploadedAvatar(url)}
                    />
                  </div>
                )}

                {avatarType === 'animated' && (
                  <div>
                    <Label>Select avatar style</Label>
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      {AVATAR_STYLES.map((style) => (
                        <button
                          key={style.id}
                          onClick={() => setSelectedStyle(style.id)}
                          className={`p-3 rounded-lg border-2 transition-all ${selectedStyle === style.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                            }`}
                        >
                          <img
                            src={`https://api.dicebear.com/7.x/${style.id}/svg?seed=${username || 'preview'}`}
                            alt={style.name}
                            className="w-full aspect-square rounded-lg mb-2"
                          />
                          <p className="text-xs font-medium text-center">{style.name}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                    Back
                  </Button>
                  <Button onClick={handleSubmit} disabled={loading} className="flex-1">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Setting up...
                      </>
                    ) : (
                      'Complete Setup'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </UnifiedPageWrapper>
  );
}
