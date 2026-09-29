'use client';

import { memo, useCallback, useState } from 'react';
import { Check, Copy, Share2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { ToolSection } from './shared';

/**
 * The one section on this page that works in a browser as well as the app, so it
 * takes no `disabled` prop: nothing here touches the device.
 */
export const InviteSection = memo(function InviteSection({
  inviteLink,
  open,
  onToggle,
}: {
  inviteLink: string;
  open: boolean;
  onToggle: (id: string) => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Could not copy',
        description: 'Select the link and copy it manually.',
        variant: 'destructive',
      });
    }
  }, [inviteLink, toast]);

  const share = useCallback(async () => {
    if (!inviteLink) return;
    const shareFn = (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share;
    if (!shareFn) {
      await copy();
      return;
    }
    try {
      await shareFn.call(navigator, {
        title: 'Study with me on StudyBuddy',
        text: 'Join me on StudyBuddy and we can keep each other accountable.',
        url: inviteLink,
      });
    } catch {
      /* the user dismissed the share sheet */
    }
  }, [inviteLink, copy]);

  return (
    <ToolSection
      id="invite"
      title="Invite a study partner"
      icon={<UserPlus className="h-5 w-5" />}
      minBodyHeight={140}
      open={open}
      onToggle={onToggle}
    >
      <p className="text-sm text-muted-foreground">
        Share this link. Opening it sends you a friend request, so you can see each other&apos;s
        streaks and study time.
      </p>
      {inviteLink ? (
        <>
          <Label htmlFor="invite-link" className="text-xs">
            Your invite link
          </Label>
          <Input id="invite-link" readOnly value={inviteLink} className="font-mono text-xs" />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={() => void copy()}
            >
              {copied ? (
                <Check aria-hidden="true" className="mr-1.5 h-4 w-4" />
              ) : (
                <Copy aria-hidden="true" className="mr-1.5 h-4 w-4" />
              )}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button type="button" size="sm" className="min-h-11" onClick={() => void share()}>
              <Share2 aria-hidden="true" className="mr-1.5 h-4 w-4" />
              Share
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Sign in to get your invite link.</p>
      )}
    </ToolSection>
  );
});
