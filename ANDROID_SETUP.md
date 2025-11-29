# Android App Setup with Capacitor

This guide will help you set up and build the StudyBuddy Android app using Capacitor.

## Prerequisites

### 1. Node.js Version Requirement
⚠️ **Important:** Capacitor 7 requires Node.js version **20.0.0 or higher**.

**Check your current Node version:**
```bash
node --version
```

**If you have Node.js < 20, upgrade using one of these methods:**

#### Option A: Using nvm (Node Version Manager) - Recommended
```bash
# Install nvm if you haven't
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node 20
nvm install 20
nvm use 20
nvm alias default 20
```

#### Option B: Using apt (Ubuntu/Debian)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Option C: Download from nodejs.org
Visit [nodejs.org](https://nodejs.org/) and download the LTS version (20.x or higher)

### 2. Android Studio
Download and install [Android Studio](https://developer.android.com/studio)

**Required components:**
- Android SDK (API 21 or higher)
- Android SDK Platform-Tools
- Android SDK Build-Tools
- Android Emulator (optional, for testing)

### 3. Environment Variables
Add these to your `~/.bashrc` or `~/.zshrc`:

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_HOME/emulator
```

Then reload:
```bash
source ~/.bashrc  # or source ~/.zshrc
```

### 4. Java Development Kit (JDK)
Capacitor requires JDK 17:

```bash
sudo apt install openjdk-17-jdk
```

Verify installation:
```bash
java -version
```

## Setup Steps

### 1. Initialize Android Platform

After upgrading Node.js to version 20+, run:

```bash
npm run cap:add:android
```

This creates the `android/` directory with your Android project.

### 2. Build the Web App

```bash
npm run build
```

This compiles your React app into the `dist/` directory.

### 3. Sync Web Assets to Android

```bash
npm run cap:sync:android
```

This copies your built web app into the Android project.

## Development Workflow

### Running in Development

**Option 1: Full rebuild and run**
```bash
npm run android:dev
```

**Option 2: Just sync and open**
```bash
npm run cap:sync:android
npm run cap:open:android
```

**Option 3: Connect to local dev server**

1. Update `capacitor.config.ts` and uncomment:
```typescript
server: {
  url: 'http://10.0.2.2:5173', // For Android emulator
  // url: 'http://YOUR_LOCAL_IP:5173', // For physical device
  cleartext: true,
}
```

2. Start your dev server:
```bash
npm run dev
```

3. Sync and run:
```bash
npm run cap:sync:android
npm run cap:run:android
```

### Testing on Emulator

1. Open Android Studio:
```bash
npm run cap:open:android
```

2. Click the green play button or press `Shift + F10`

### Testing on Physical Device

1. Enable **Developer Options** on your Android device:
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times

2. Enable **USB Debugging**:
   - Go to Settings → Developer Options
   - Enable USB Debugging

3. Connect your device via USB

4. Verify connection:
```bash
adb devices
```

5. Run the app:
```bash
npm run cap:run:android
```

## Building Release APK

### 1. Generate a Keystore

```bash
keytool -genkey -v -keystore studybuddy-release.keystore \
  -alias studybuddy -keyalg RSA -keysize 2048 -validity 10000
```

### 2. Configure Build Settings

Edit `android/app/build.gradle` and add:

```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file("../../studybuddy-release.keystore")
            storePassword "your_keystore_password"
            keyAlias "studybuddy"
            keyPassword "your_key_password"
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 3. Build the Release APK

```bash
cd android
./gradlew assembleRelease
```

The APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

### 4. Build App Bundle (for Play Store)

```bash
cd android
./gradlew bundleRelease
```

The AAB will be at: `android/app/build/outputs/bundle/release/app-release.aab`

## Available NPM Scripts

```bash
# Build web app
npm run build

# Add Android platform (first time only)
npm run cap:add:android

# Sync web assets to Android
npm run cap:sync
npm run cap:sync:android

# Open Android Studio
npm run cap:open:android

# Build, sync, and run on device/emulator
npm run cap:run:android
npm run android:dev
```

## Troubleshooting

### "The Capacitor CLI requires NodeJS >=20.0.0"
You need to upgrade Node.js. See Prerequisites section above.

### "ANDROID_HOME is not set"
Make sure you've set the environment variables and reloaded your shell.

### "SDK location not found"
Create `android/local.properties`:
```
sdk.dir=/home/YOUR_USERNAME/Android/Sdk
```

### "Installed Build Tools revision X.X.X is corrupted"
```bash
cd $ANDROID_HOME/build-tools/XX.X.X/
mv d8 d8.bak
mv lib/d8.jar lib/d8.jar.bak
ln -s ../../cmdline-tools/latest/bin/d8 d8
ln -s ../../cmdline-tools/latest/lib/d8.jar lib/d8.jar
```

### App not connecting to backend
Make sure your backend server is running and accessible from the Android device/emulator. For development:
- Emulator: Use `http://10.0.2.2:PORT`
- Physical device: Use your computer's IP address

### Hot reload not working
When using `server.url` in `capacitor.config.ts`, changes will reflect immediately. Otherwise, you need to rebuild and sync.

## Project Structure

```
StudyBuddy-main/
├── android/                    # Native Android project (generated)
├── capacitor.config.ts         # Capacitor configuration
├── dist/                       # Built web app
├── src/                        # React source code
└── package.json               # Dependencies and scripts
```

## Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Developer Guide](https://developer.android.com/guide)
- [Capacitor Android Guide](https://capacitorjs.com/docs/android)

## Next Steps

1. Upgrade Node.js to version 20+
2. Install Android Studio and required SDKs
3. Run `npm run cap:add:android`
4. Follow the development workflow above

---

For questions or issues, refer to the [Capacitor Discord](https://discord.gg/capacitor) or [GitHub Issues](https://github.com/ionic-team/capacitor/issues).
