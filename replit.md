# Deeper - iOS Mobile App

## Overview
Deeper is an iOS mobile app built with React Native (Expo) that replicates the desktop application at joindeeper.com. The app features a turn-based conversation system designed to facilitate deeper connections between people through thoughtful questions and responses.

## Project Structure
```
client/                      # React Native (Expo) frontend
  ├── App.tsx               # Main app entry with providers
  ├── components/           # Reusable UI components
  │   ├── Button.tsx
  │   ├── Card.tsx
  │   ├── ErrorBoundary.tsx
  │   ├── HeaderTitle.tsx
  │   ├── KeyboardAwareScrollView.tsx
  │   ├── QuestionSuggestions.tsx  # Curated questions by relationship type
  │   ├── ThemedText.tsx
  │   ├── ThemedView.tsx
  │   └── VoiceRecorder.tsx        # Voice recording/playback component
  ├── constants/            # Theme and design tokens
  │   └── theme.ts          # Ocean blue/amber color palette
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
  ├── screens/              # App screens
  │   ├── ConnectionsScreen.tsx      # View and manage connections
  │   ├── ConversationListScreen.tsx # List of conversation threads
  │   ├── ConversationScreen.tsx     # Turn-based messaging interface
  │   ├── HomeScreen.tsx             # Dashboard with stats
  │   ├── InviteConnectionScreen.tsx # Invite new connections
  │   ├── LoginScreen.tsx
  │   ├── OnboardingScreen.tsx
  │   ├── SettingsScreen.tsx         # Settings with subscription info
  │   └── SignupScreen.tsx
  └── types/                # TypeScript type definitions
      └── api.ts            # API response types
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
- `GET /api/connections/:email` - Get user's connections
- `GET /api/conversations/connection/:connectionId` - Get conversations for a connection
- `GET /api/conversations/:conversationId/messages` - Get messages in a conversation
- `POST /api/conversations` - Create new conversation
- `POST /api/conversations/:conversationId/messages` - Send a message
- `GET /api/mobile/user/profile` - Get user profile with subscription info

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

### 4. Connection Management
- View accepted connections with relationship types
- Accept/decline pending invitations
- Invite new connections with relationship roles
- Connection limits based on subscription tier

### 5. Turn-Based Conversations
- Question/response format messaging
- Current turn indicator showing whose turn it is
- Message type labels (question vs response)
- Date headers and timestamps
- Support for voice messages with transcription

### 6. Question Suggestions
- Curated questions organized by relationship type
- Categories: Memories, Understanding, Dreams, Connection, etc.
- Relationship-specific questions for Parent-Child, Partners, Friends, etc.

### 7. Subscription Management
- Tiers: Trial, Basic, Advanced, Unlimited
- Connection limits based on tier
- Subscription status display in Settings

### 8. Dashboard
- Connection and conversation statistics
- Pending invitation alerts
- "Your turn" conversation alerts
- Recent connections quick access

## Design System
- **Primary Color**: Ocean Blue (#3B82F6)
- **Accent Color**: Amber Gold (#F59E0B)
- **Background (Dark)**: Deep Ocean (#1B2137)
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
- Added ConversationScreen with turn-based messaging interface
- Created ConversationListScreen for viewing conversation threads
- Enhanced HomeScreen dashboard with connection/conversation stats, subscription status, trial countdown
- Added VoiceRecorder component with pause/resume, volume level bars, playback preview
- Created QuestionSuggestions component with curated/AI toggle, shuffle, custom prompt input
- Updated Settings with subscription tier display and management
- Updated theme colors to ocean blue/amber palette matching desktop
- Added connection management screens with invite functionality
- Created Popups.tsx with desktop-parity popups: WaitingTurnPopup, TrialExpirationPopup, ExchangeRequiredPopup, ThoughtfulResponsePopup, OnboardingPopup, ConnectionLimitPopup
- Added role-based glowing borders to messages (ocean for inviter, amber for invitee)
- Implemented stacked paper visual effects for messages matching desktop aesthetic

## Components
### Popups (client/components/Popups.tsx)
- **WaitingTurnPopup**: Shown when user tries to send while waiting for partner's response
- **TrialExpirationPopup**: Trial countdown and upgrade prompt
- **ExchangeRequiredPopup**: Explains the question/response exchange pattern
- **ThoughtfulResponsePopup**: 10-minute response timer display
- **OnboardingPopup**: Multi-step app introduction
- **ConnectionLimitPopup**: Subscription-based connection limits

### QuestionSuggestions
- Curated questions by relationship type (Parent-Child, Romantic Partners, Friends, Siblings, etc.)
- AI-generated questions via `/api/ai/generate-questions` endpoint
- Custom prompt input for personalized questions
- Shuffle functionality for curated questions
