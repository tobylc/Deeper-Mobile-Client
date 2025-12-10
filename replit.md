# Deeper - iOS Mobile App

## Overview
Deeper is an iOS mobile app built with React Native (Expo) that provides a secure authentication experience connecting to the joindeeper.com backend API. Features include email/password login, biometric authentication (Face ID/Touch ID), push notifications, and an onboarding flow for new users.

## Project Structure
```
client/                      # React Native (Expo) frontend
  ├── App.tsx               # Main app entry with providers
  ├── components/           # Reusable UI components
  │   ├── Button.tsx
  │   ├── Card.tsx
  │   ├── ErrorBoundary.tsx
  │   ├── KeyboardAwareScrollView.tsx
  │   ├── ThemedText.tsx
  │   └── ThemedView.tsx
  ├── constants/            # Theme and design tokens
  │   └── theme.ts
  ├── hooks/                # Custom React hooks
  │   ├── useScreenOptions.ts
  │   └── useTheme.ts
  ├── lib/                  # Core utilities and services
  │   ├── api.ts            # API client with retry logic
  │   ├── auth.tsx          # Authentication context and hooks
  │   ├── biometric.ts      # Biometric auth (Face ID/Touch ID)
  │   ├── notifications.ts  # Push notification handling
  │   └── query-client.ts   # React Query setup
  ├── navigation/           # Navigation configuration
  │   └── RootStackNavigator.tsx
  └── screens/              # App screens
      ├── HomeScreen.tsx
      ├── LoginScreen.tsx
      ├── OnboardingScreen.tsx
      ├── SettingsScreen.tsx
      └── SignupScreen.tsx
server/                     # Express backend (proxy)
  └── index.ts
```

## Tech Stack
- **Framework**: React Native with Expo (v54)
- **Navigation**: React Navigation 7+ (Stack navigator)
- **State Management**: React Query (@tanstack/react-query)
- **Authentication**: JWT tokens with secure storage
- **Biometrics**: expo-local-authentication, expo-secure-store
- **Notifications**: expo-notifications
- **UI**: Custom components with iOS 26 liquid glass design

## Backend API Endpoints
All API calls go to `https://joindeeper.com`:
- `POST /api/mobile/auth/login` - Email/password login
- `POST /api/mobile/auth/signup` - User registration
- `GET /api/mobile/auth/user` - Get current user data
- `POST /api/mobile/auth/refresh` - Refresh JWT token
- `POST /api/mobile/push-token` - Register push notification token

## Key Features

### 1. Authentication
- JWT-based authentication with access and refresh tokens
- Tokens stored securely in expo-secure-store
- Automatic token refresh on 401 responses

### 2. Biometric Login
- Face ID and Touch ID support via expo-local-authentication
- Credentials stored in Keychain/SecureStore (not plain text)
- Toggle in Settings to enable/disable biometric login
- Biometric button appears on login screen when available

### 3. Push Notifications
- Automatic push token registration on login
- Notification received/clicked listeners
- Badge clearing on app open
- Toggle in Settings to enable/disable notifications

### 4. Onboarding Flow
- 3-slide carousel for first-time users
- Stored completion state in AsyncStorage
- Skip button available on all slides
- Shows before login for new installs

### 5. Error Handling
- Centralized API error handling in lib/api.ts
- Exponential backoff retry (3 attempts max)
- Retries on 408, 429, 5xx status codes
- Network error detection and retry

## Design System
- **Primary Color**: Deep Blue (#1E3A5F)
- **Accent Color**: Vibrant Blue (#2563EB)
- **Navigation**: Stack-only (no tab bar)
- **Style**: iOS 26 liquid glass interface design

## Development

### Running the App
```bash
npm run all:dev
```
- Expo dev server runs on port 8081
- Express proxy server runs on port 5000

### Testing on Device
Scan the QR code with Expo Go (iOS/Android) to test on physical device.

## Security Notes
- All sensitive data (tokens, passwords for biometric) stored in SecureStore
- Biometric preference flag stored in AsyncStorage (not sensitive)
- Onboarding completion flag stored in AsyncStorage

## Recent Changes (Dec 2024)
- Added biometric authentication with Face ID/Touch ID support
- Implemented push notification handling with badge clearing
- Created 3-slide onboarding flow for new users
- Added centralized API error handling with exponential backoff retry
- Enhanced logout to clear all stored data including biometric credentials
- Migrated biometric credential storage from AsyncStorage to SecureStore for security
