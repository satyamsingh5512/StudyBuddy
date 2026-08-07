export type InstallPlatform = 'standalone' | 'ios' | 'chromium' | 'other';

export interface InstallEnvironment {
  userAgent: string;
  standalone: boolean;
  installPromptAvailable?: boolean;
}

export const detectInstallPlatform = (environment: InstallEnvironment): InstallPlatform => {
  if (environment.standalone) return 'standalone';
  if (/iPad|iPhone|iPod/i.test(environment.userAgent)) return 'ios';
  if (/Chrome|Chromium|Edg\//i.test(environment.userAgent) && !/CriOS/i.test(environment.userAgent)) return 'chromium';
  return 'other';
};

export const installInstructions = (environment: InstallEnvironment): { title: string; steps: string[]; canPrompt: boolean } => {
  const platform = detectInstallPlatform(environment);
  if (platform === 'standalone') return { title: 'StudyBuddy is installed', steps: ['Open it from your home screen or app launcher.'], canPrompt: false };
  if (platform === 'ios') return { title: 'Install on iPhone or iPad', steps: ['Open StudyBuddy in Safari.', 'Tap Share, then Add to Home Screen.', 'Confirm Add.'], canPrompt: false };
  if (platform === 'chromium') return {
    title: 'Install StudyBuddy',
    steps: environment.installPromptAvailable
      ? ['Use the Install button below and confirm the browser prompt.']
      : ['Open the browser menu.', 'Choose Install StudyBuddy or Add to home screen.', 'Confirm installation.'],
    canPrompt: Boolean(environment.installPromptAvailable),
  };
  return { title: 'Install from your browser', steps: ['Open your browser menu and look for Install app or Add to home screen. If unavailable, keep using StudyBuddy in the browser.'], canPrompt: false };
};
