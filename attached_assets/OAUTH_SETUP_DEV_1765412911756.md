# Development OAuth Setup - URGENT

## Current Development Domain
Your current development URL is: `https://cff6a38a-c3dc-4f52-b1fd-c79081e89cb6-00-1feemc48ewm22.janeway.replit.dev`

## Quick Fix Required

1. **Go to Google Cloud Console**: https://console.cloud.google.com
2. **Navigate to**: APIs & Services → Credentials  
3. **Find your OAuth 2.0 Client ID** (the one used for Deeper)
4. **Click Edit** on your OAuth client
5. **Add this URL to "Authorized redirect URIs"**:
   ```
   https://cff6a38a-c3dc-4f52-b1fd-c79081e89cb6-00-1feemc48ewm22.janeway.replit.dev/api/auth/google/callback
   ```

6. **Also add to "Authorized JavaScript origins"**:
   ```
   https://cff6a38a-c3dc-4f52-b1fd-c79081e89cb6-00-1feemc48ewm22.janeway.replit.dev
   ```

7. **Save** the configuration

## Wait Time
After saving, wait 2-3 minutes for Google's OAuth cache to refresh, then try authentication again.

## Current Status
- ✅ Development environment OAuth callback URL fixed
- ⏳ Google Console configuration needed (manual step)
- ✅ Production OAuth working correctly

## Note
Every time your Replit development URL changes, you'll need to update the Google Console with the new domain. Production OAuth at `joindeeper.com` will continue working without changes.