# Design Guidelines: Deeper Mobile App

## Architecture Decisions

### Authentication
**Auth Required** - The app explicitly uses JWT-based authentication with email/password.

**Authentication Implementation:**
- Email/password authentication (already implemented in backend)
- Login screen with email and password fields
- Signup screen with email, password, and confirm password fields
- Automatic token refresh before expiration
- Secure token storage using AsyncStorage
- Include "Forgot Password?" link on login screen (placeholder for future implementation)
- Privacy policy & terms of service links on signup screen (placeholder URLs)

**Account Management:**
- Profile/settings screen with:
  - User email display (from GET /api/mobile/auth/user)
  - Log out button with confirmation alert
  - Delete account option (nested under Settings > Account > Delete, with double confirmation)
  - Push notification preferences toggle

### Navigation
**Stack-Only Navigation** - The app has two distinct navigation stacks:

1. **Unauthenticated Stack:**
   - Login Screen (initial screen)
   - Signup Screen (push from Login)

2. **Authenticated Stack:**
   - Home Screen (main screen after login)
   - Profile/Settings Screen (accessible from Home)

No tab bar needed - simple stack navigation with modal transitions for Settings.

### Screen Specifications

#### Login Screen
- **Purpose:** Authenticate existing users
- **Layout:**
  - No custom header (full-screen experience)
  - Centered content with keyboard-aware scrolling
  - Top inset: insets.top + Spacing.xl
  - Bottom inset: insets.bottom + Spacing.xl
- **Components:**
  - App logo/branding at top
  - Email input field (keyboard type: email-address)
  - Password input field (secure text entry, eye icon toggle)
  - "Forgot Password?" text link (align right, below password)
  - Primary "Log In" button (full-width, loading state)
  - "Don't have an account? Sign Up" text link at bottom
- **Validation:** Real-time validation on blur, error states for invalid credentials

#### Signup Screen
- **Purpose:** Create new user accounts
- **Layout:**
  - Custom header with back button (left)
  - Title: "Create Account"
  - Scrollable form content
  - Top inset: Spacing.xl (header handles safe area)
  - Bottom inset: insets.bottom + Spacing.xl
- **Components:**
  - Email input field
  - Password input field (strength indicator below)
  - Confirm password input field
  - Terms & privacy policy text with links
  - Primary "Sign Up" button (full-width, loading state)
  - "Already have an account? Log In" text link at bottom
- **Validation:** Email format, password strength (min 8 characters), password match

#### Home Screen
- **Purpose:** Main authenticated landing screen
- **Layout:**
  - Transparent header with title "Home"
  - Settings icon button (right header button)
  - Scrollable content area
  - Top inset: headerHeight + Spacing.xl
  - Bottom inset: insets.bottom + Spacing.xl
- **Components:**
  - Welcome message with user's email
  - Placeholder content area (for future features)
  - Subtle loading state on initial data fetch

#### Profile/Settings Screen
- **Purpose:** User account management and app preferences
- **Layout:**
  - Default navigation header with "Settings" title
  - Back button (left header button)
  - Scrollable list/form content
  - Top inset: Spacing.xl (header handles safe area)
  - Bottom inset: insets.bottom + Spacing.xl
- **Components:**
  - User info section (email display)
  - Push notifications toggle
  - "Log Out" button (destructive style)
  - "Delete Account" link (nested, subtle, at bottom)
- **Interaction:** Log out shows confirmation alert, Delete account requires double confirmation

## Design System

### Color Palette
- **Primary:** #2563EB (Blue 600) - for CTAs, links, active states
- **Background:** #FFFFFF (Light mode), #1F2937 (Dark mode optional)
- **Surface:** #F9FAFB (Light gray for cards/inputs)
- **Text Primary:** #111827 (Gray 900)
- **Text Secondary:** #6B7280 (Gray 500)
- **Error:** #DC2626 (Red 600)
- **Success:** #10B981 (Green 500)
- **Border:** #E5E7EB (Gray 200)

### Typography
- **Headings (H1):** 28px, Bold (SF Pro Display on iOS)
- **Headings (H2):** 20px, Semibold
- **Body:** 16px, Regular
- **Caption:** 14px, Regular
- **Links:** 16px, Medium, Primary color

### Spacing Scale
- xs: 4px
- sm: 8px
- md: 12px
- lg: 16px
- xl: 24px
- 2xl: 32px

### Visual Design

**Input Fields:**
- Height: 48px
- Border radius: 8px
- Border: 1px solid Border color
- Background: Surface color
- Padding: lg (horizontal)
- Focus state: Primary color border, no shadow
- Error state: Error color border, helper text below in Error color

**Buttons:**
- Primary: Background Primary, white text, 48px height, 8px border radius
- Full-width on auth screens
- Loading state: opacity 0.7 with activity indicator
- Pressed state: opacity 0.9
- NO drop shadows on buttons

**Text Links:**
- Primary color text
- Underline on press (visual feedback)
- Medium weight font

**Touchable Feedback:**
- All touchable elements have 0.7 opacity when pressed
- No haptic feedback (keep it simple)

**Icons:**
- Use Feather icons from @expo/vector-icons
- 24px for header icons
- 20px for inline icons (e.g., password visibility toggle)
- Icons: "settings", "eye", "eye-off", "log-out", "user", "mail", "lock"

### Accessibility Requirements
- All input fields have labels (visible or aria-label)
- Minimum touch target size: 44x44px
- Color contrast ratio: 4.5:1 for text
- Form validation errors announced to screen readers
- Loading states with accessible labels
- Keyboard return key types: "next" for inputs (except last), "go" for final submit

### Assets
**No custom assets required** - This is a utility/auth-focused app. Use system icons only. Future versions may add user avatars, but for MVP, display user email only.

### Error Handling & Loading States
- Network errors: Toast/alert with retry option
- Form validation: Inline errors below fields
- API errors: Display user-friendly messages
- Loading: Activity indicator on buttons during API calls
- Empty states: "No data yet" messaging on Home screen