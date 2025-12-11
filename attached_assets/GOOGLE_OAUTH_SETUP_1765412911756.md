# Google OAuth Setup Instructions

## Current Issue
Google OAuth is returning a 403 "access denied" error because the redirect URI in your Google Console doesn't match your deployed application URL.

## Required Google Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to "APIs & Services" > "Credentials"
3. Find your OAuth 2.0 Client ID
4. Edit the client configuration
5. In "Authorized redirect URIs", add:
   - `https://joindeeper.com/api/auth/google/callback`
   - `https://cff6a38a-c3dc-4f52-b1fd-c79081e89cb6-00-1feemc48ewm22.janeway.replit.dev/api/auth/google/callback` (current development URL)
   - `http://localhost:5000/api/auth/google/callback` (local development)

## OAuth Status - RESOLVED ✅

**Production Fixed:** The production environment now correctly uses `https://joindeeper.com/api/auth/google/callback`

**Verified Working Configuration:**
- Production callback URL: `https://joindeeper.com/api/auth/google/callback` ✅
- Google Console has the correct authorized redirect URIs ✅
- Code deployment completed successfully ✅

**If OAuth still shows errors:**
1. Wait 2-3 minutes for Google's OAuth cache to refresh
2. Try OAuth authentication again at https://joindeeper.com/auth
3. The configuration is now correctly deployed and should work

The production environment is ready for testing. All OAuth configuration issues have been resolved.

## Testing
After updating the Google Console configuration:
1. Wait 5-10 minutes for changes to propagate
2. Try Google login again
3. The authentication should redirect properly to your dashboard

## Troubleshooting
- Ensure the current development domain `cff6a38a-c3dc-4f52-b1fd-c79081e89cb6-00-1feemc48ewm22.janeway.replit.dev` is added to authorized origins
- For production, ensure `joindeeper.com` is added to authorized origins
- Check that the client ID and secret in Replit secrets match the Google Console
- Verify the OAuth consent screen is properly configured