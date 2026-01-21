// Simple sound effects using Web Audio API
type SoundCategory = 'ui' | 'notifications' | 'timer' | 'auth';

class SoundManager {
  private audioContext: AudioContext | null = null;
  private initialized = false;

  // Pre-initialize audio context to avoid first-click delay
  initialize() {
    if (this.initialized) return;
    try {
      this.getContext();
      this.initialized = true;
    } catch (error) {
      console.debug('Audio initialization failed');
    }
  }

  private getContext(): AudioContext {
    if (!this.audioContext) {
      const AudioContextConstructor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioContextConstructor();
    }
    return this.audioContext;
  }

  setEnabled(enabled: boolean, category?: SoundCategory) {
    if (category) {
      localStorage.setItem(`sound_${category}`, enabled.toString());
    } else {
      localStorage.setItem('soundEnabled', enabled.toString());
    }
  }

  isEnabled(category?: SoundCategory): boolean {
    // Check global setting first
    const globalEnabled = localStorage.getItem('soundEnabled');
    if (globalEnabled === 'false') return false;

    // Check category-specific setting
    if (category) {
      const categoryEnabled = localStorage.getItem(`sound_${category}`);
      return categoryEnabled === null ? true : categoryEnabled === 'true';
    }

    return globalEnabled === null ? true : globalEnabled === 'true';
  }

  // Play a subtle click sound
  playClick() {
    if (!this.isEnabled('ui')) return;
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

  // Play a button press sound (deeper than click)
  playButtonPress() {
    if (!this.isEnabled('ui')) return;
    try {
      const ctx = this.getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = 500;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.12);
    } catch (error) {
      console.debug('Audio not available');
    }
  }

  // Play add/create sound (ascending)
  playAdd() {
    if (!this.isEnabled('ui')) return;
    try {
      const ctx = this.getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(500, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.15);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.15);
    } catch (error) {
      console.debug('Audio not available');
    }
  }

  // Play input focus sound (soft)
  playInputFocus() {
    if (!this.isEnabled('ui')) return;
    try {
      const ctx = this.getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = 1000;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.08);
    } catch (error) {
      console.debug('Audio not available');
    }
  }

  // Play a subtle toggle sound (two tones)
  playToggle(isDark: boolean) {
    if (!this.isEnabled('ui')) return;
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
    if (!this.isEnabled('notifications')) return;
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
    if (!this.isEnabled('notifications')) return;
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

  // Play login/signin success sound
  playLogin() {
    if (!this.isEnabled('auth')) return;
    try {
      const ctx = this.getContext();
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
      playTone(523, now, 0.1); // C
      playTone(659, now + 0.1, 0.1); // E
      playTone(784, now + 0.2, 0.2); // G
    } catch (error) {
      console.debug('Audio not available');
    }
  }

  // Play delete sound
  playDelete() {
    if (!this.isEnabled('ui')) return;
    try {
      const ctx = this.getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.frequency.setValueAtTime(800, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.2);
    } catch (error) {
      console.debug('Audio not available');
    }
  }

  // Play timer complete sound
  playTimerComplete() {
    if (!this.isEnabled('timer')) return;
    try {
      const ctx = this.getContext();
      const playTone = (freq: number, startTime: number, duration: number) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.value = freq;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.2, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      const now = ctx.currentTime;
      // Play a celebratory sequence
      playTone(523, now, 0.15);
      playTone(659, now + 0.15, 0.15);
      playTone(784, now + 0.3, 0.15);
      playTone(1047, now + 0.45, 0.3);
    } catch (error) {
      console.debug('Audio not available');
    }
  }

  // Play success sound
  playSuccess() {
    if (!this.isEnabled('ui')) return;
    try {
      const ctx = this.getContext();
      const playTone = (freq: number, startTime: number, duration: number) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.value = freq;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.12, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      const now = ctx.currentTime;
      playTone(659, now, 0.1);
      playTone(784, now + 0.1, 0.2);
    } catch (error) {
      console.debug('Audio not available');
    }
  }
}

export const soundManager = new SoundManager();
