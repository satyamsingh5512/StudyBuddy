# StudyBuddy for Ubuntu (desktop app)

Native Ubuntu shell for StudyBuddy: a `.deb` / AppImage built with Electron that wraps the
deployed app (`https://sbd.satym.in`) exactly like the Android APK wraps it with Capacitor.
All AI, social, and backend features keep working server-side — the shell only adds Ubuntu
integration: dock/Activities entry, libnotify notifications, tray icon, launch-at-login,
`studybuddy://` deep links, and an offline page.

## What you get (vs the browser tab)

| Ubuntu app | Browser |
|---|---|
| Dock + Activities icon, own window, no browser chrome | Tab among tabs |
| System notifications (libnotify) when unfocused / minimized to tray | Toasts only while the tab is visible |
| Tray icon: Dashboard, Focus Timer, Show-up Check-in, Quit | Nothing |
| Start at login toggle in Settings | Manual reopen after reboot |
| `studybuddy://dashboard` links open in the app | — |
| Offline page when the network drops | Browser error page |

## Prerequisites

```bash
bash scripts/install-linux-deps.sh   # libnotify, fakeroot, dpkg helpers
npm install                          # pulls electron + electron-builder
```

## Run it (development)

Terminal 1 — web app:

```bash
npm run dev
```

Terminal 2 — desktop shell pointed at it:

```bash
STUDYBUDDY_URL=http://localhost:3000 npm run desktop:dev
```

Without `STUDYBUDDY_URL` the shell loads the live site (`https://sbd.satym.in`).

## Build the installer

```bash
npm run dist:linux      # dist-electron/StudyBuddy_<version>_amd64.deb
npm run desktop:dist    # .deb + AppImage
```

Install:

```bash
sudo apt install ./dist-electron/StudyBuddy_*_amd64.deb
```

StudyBuddy then appears in Activities/Search, can be pinned to the dock, and registers
`studybuddy://` links. Closing the window hides it to the tray (so reminders keep firing);
Quit from the tray menu exits fully.

## Notes

- Session stays signed in — the shell uses a persistent profile (`persist:studybuddy`).
- External links (anything outside the app origin) open in your default browser.
- Notifications need no browser permission inside the app: Settings shows
  “System notifications enabled” and reminders arrive as native cards.
- `npm run lint` covers `src/`; the `electron/` shell is plain Node (`.cjs`) and is
  excluded from the Next.js TypeScript build on purpose.
