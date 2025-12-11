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

### 7. Subscription Management & In-App Purchases
- Tiers: Trial, Basic, Advanced, Unlimited
- Connection limits based on tier
- Subscription status display in Settings
- Native iOS StoreKit integration via expo-in-app-purchases
- Monthly and yearly billing periods with 17% yearly discount
- SubscriptionScreen with tier cards, features, and pricing
- Restore Purchases functionality for App Store compliance
- Auto-renewal disclosure and legal links (Terms, Privacy)

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
- Fixed Card component to allow parent Pressable touch events (uses Animated.View when no onPress)
- Added SubscriptionScreen with native iOS StoreKit IAP integration
- Created IAP service layer (lib/iap.ts) for purchases, restores, and product loading
- Added monthly/yearly billing toggle with 17% yearly discount badge
- Integrated Forgot Password functionality in LoginScreen
- Added navigation from HomeScreen and SettingsScreen to SubscriptionScreen

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

### ConversationThreads
- Slide-in panel from right showing previous conversation threads
- Stacked cards visual effect with layered backgrounds
- Active/Archived sections with thread counts
- Turn status indicator (your turn/their turn)
- Create new thread functionality

## Authentication
- Uses `accessToken` and `refreshToken` from desktop API format
- Handles `requiresEmailVerification` for new signups
- Tokens stored securely in AsyncStorage
- Automatic token refresh on 401 responses

## In-App Purchases (iOS StoreKit)

### Product IDs
The following product IDs need to be configured in App Store Connect:
- `com.deeper.app.basic.monthly` - Basic Monthly ($4.99)
- `com.deeper.app.basic.yearly` - Basic Yearly ($49.99)
- `com.deeper.app.advanced.monthly` - Advanced Monthly ($9.99)
- `com.deeper.app.advanced.yearly` - Advanced Yearly ($99.99)
- `com.deeper.app.unlimited.monthly` - Unlimited Monthly ($19.99)
- `com.deeper.app.unlimited.yearly` - Unlimited Yearly ($199.99)

### Required Backend Endpoints
For App Store release, the following endpoints need to be added to joindeeper.com:

1. **POST /api/mobile/subscriptions/ios/verify**
   - Accepts: `{ receiptData, productId, transactionId, platform }`
   - Validates receipt with Apple's verifyReceipt API
   - Updates user's subscription tier in database
   - Returns: `{ valid, tier, expiresAt, error? }`

2. **GET /api/mobile/subscriptions/status**
   - Returns current subscription status
   - Returns: `{ tier, status, expiresAt?, maxConnections }`

### Development Notes
- expo-in-app-purchases requires a development build (EAS Build)
- Native IAP does NOT work in Expo Go - the app gracefully falls back to mock data
- For testing in Expo Go, purchase buttons show an informative message
- When building for App Store, run `eas build` to create a development build with StoreKit

### Building for App Store
1. Configure products in App Store Connect
2. Add `expo-in-app-purchases` to app.json plugins
3. Run `eas build --platform ios` to create a development build
4. Implement backend receipt validation endpoints
5. Test with TestFlight sandbox purchases
