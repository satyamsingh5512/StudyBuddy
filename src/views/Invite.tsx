'use client';

/**
 * Invite landing page for `/invite/<userId>`.
 *
 * Reached three ways: a plain web link, the `studybuddy://invite/<id>` scheme from
 * the native share sheet, and `https://sbd.satym.in/invite/<id>` opened in the
 * installed APK. NativeAppBridge routes the latter two here.
 *
 * The page deliberately shows nothing about the inviter. A user id in a link is not
 * proof of a relationship, so revealing a name, avatar or streak to anyone holding
 * the link would leak profile data to strangers. The id is only used as the
 * recipient of a friend request, which the invited user still has to send and the
 * inviter still has to accept.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSendFriendRequest } from '@/lib/queries';
import { CheckCircle2, Loader2, UserPlus, Users } from 'lucide-react';

/** Mongo ObjectId hex form. Anything else was never a StudyBuddy user id. */
const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

type Outcome =
  | { kind: 'idle' }
  | { kind: 'sent' }
  | { kind: 'already' }
  | { kind: 'error'; message: string };

export default function Invite() {
  // useParams rather than the page's `params` prop: in this Next version route
  // params arrive as a Promise on the server, and a client component reading them
  // synchronously through the hook avoids having to unwrap that.
  const params = useParams<{ userId?: string | string[] }>();
  const [user] = useAtom(userAtom);
  const { mutateAsync: sendFriendRequest, isPending } = useSendFriendRequest();
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });

  const inviterId = useMemo(() => {
    const raw = params?.userId;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === 'string' && OBJECT_ID_PATTERN.test(value) ? value : null;
  }, [params]);

  const isSelfInvite = Boolean(inviterId && user?.id && inviterId === user.id);

  useEffect(() => {
    setOutcome({ kind: 'idle' });
  }, [inviterId]);

  const accept = async () => {
    if (!inviterId) return;
    try {
      await sendFriendRequest({ receiverId: inviterId });
      setOutcome({ kind: 'sent' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      // A repeat tap, or an invite from someone who already added you, is not a
      // failure worth showing as one.
      if (/already|exist|duplicate|pending/i.test(message)) {
        setOutcome({ kind: 'already' });
        return;
      }
      setOutcome({
        kind: 'error',
        message: message || 'The request could not be sent. Try again in a moment.',
      });
    }
  };

  if (!inviterId) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">That invite link is not valid</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The link may have been cut short when it was shared. Ask your friend to send it again.
            </p>
            <Button asChild size="sm" variant="outline" className="min-h-11">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg break-words">
            <Users aria-hidden="true" className="h-5 w-5 flex-shrink-0 text-primary" />
            A friend invited you to study together
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Accepting sends them a friend request. Once they accept, you will both see each
            other&apos;s study time and streaks, and can compare progress on the leaderboard.
          </p>

          {isSelfInvite ? (
            <>
              <p className="text-sm">
                This is your own invite link — share it with someone else rather than opening it
                yourself.
              </p>
              <Button asChild size="sm" variant="outline" className="min-h-11">
                <Link href="/focus-tools">Back to your invite link</Link>
              </Button>
            </>
          ) : outcome.kind === 'sent' || outcome.kind === 'already' ? (
            <>
              <p className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 aria-hidden="true" className="h-4 w-4 flex-shrink-0 text-primary" />
                <span className="min-w-0">
                  {outcome.kind === 'sent'
                    ? 'Friend request sent. They will see it next time they open StudyBuddy.'
                    : 'You have already sent this person a request.'}
                </span>
              </p>
              <Button asChild size="sm" className="min-h-11">
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              {outcome.kind === 'error' && (
                <p role="alert" className="text-sm text-destructive break-words">
                  {outcome.message}
                </p>
              )}
              <Button type="button" size="sm" disabled={isPending} onClick={() => void accept()} className="min-h-11">
                {isPending ? (
                  <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 flex-shrink-0 animate-spin" />
                ) : (
                  <UserPlus aria-hidden="true" className="mr-1.5 h-4 w-4 flex-shrink-0" />
                )}
                {isPending ? 'Sending…' : 'Send friend request'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
