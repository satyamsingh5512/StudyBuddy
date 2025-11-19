// Simple sound effects using Web Audio API
class SoundManager {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    localStorage.setItem('soundEnabled', enabled.toString());
  }

  isEnabled(): boolean {
    const stored = localStorage.getItem('soundEnabled');
    return stored === null ? true : stored === 'true';
  }

  // Play a subtle click sound
  playClick() {
    if (!this.isEnabled()) return;
    try {
      const ctx = this.getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.1);
    } catch (error) {
      console.debug('Audio not available');
    }
  }

  // Play a subtle toggle sound (two tones)
  playToggle(isDark: boolean) {
    if (!this.isEnabled()) return;
    try {
      const ctx = this.getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = isDark ? 600 : 900;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.15);
    } catch (error) {
      console.debug('Audio not available');
    }
  }

  // Play message notification sound
  playMessageNotification() {
    if (!this.isEnabled()) return;
    try {
      const ctx = this.getContext();

      // Create a pleasant two-tone notification
      const playTone = (freq: number, startTime: number, duration: number) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = freq;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.15, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      playTone(800, now, 0.1);
      playTone(1000, now + 0.1, 0.15);
    } catch (error) {
      console.debug('Audio not available');
    }
  }

  // Play new notification sound
  playNotification() {
    if (!this.isEnabled()) return;
    try {
      const ctx = this.getContext();

      // Create a pleasant ascending tone
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(600, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.2);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (error) {
      console.debug('Audio not available');
    }
  }
}

export const soundManager = new SoundManager();
