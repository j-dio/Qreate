# Google OAuth Setup Guide

**Time required:** 5-10 minutes
**Difficulty:** Easy (just follow the steps with screenshots)

## Why do we need this?

To allow Qreate to create Google Docs and export PDFs to users' Google Drive, we need to set up OAuth 2.0 credentials. This is a **one-time developer setup** - end users won't need to do this.

---

## Step-by-Step Setup

### 1. Go to Google Cloud Console
Visit: https://console.cloud.google.com/

### 2. Create a New Project
1. Click "Select a project" dropdown at the top
2. Click "NEW PROJECT"
3. Project name: `Qreate`
4. Click "CREATE"

### 3. Enable Required APIs
1. Go to "APIs & Services" → "Library"
2. Search for and enable these APIs:
   - **Google Drive API** - Click "ENABLE"
   - **Google Docs API** - Click "ENABLE"

### 4. Configure OAuth Consent Screen
1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" user type
3. Click "CREATE"

**Fill in the form:**
- **App name:** Qreate
- **User support email:** [Your email]
- **Developer contact:** [Your email]
- Click "SAVE AND CONTINUE"

**Scopes:**
- Click "ADD OR REMOVE SCOPES"
- Search and select:
  - `https://www.googleapis.com/auth/drive.file` (Create and edit Drive files)
  - `https://www.googleapis.com/auth/documents` (View and manage Google Docs)
- Click "UPDATE" → "SAVE AND CONTINUE"

**Test users:**
- Add your Google account email
- Click "SAVE AND CONTINUE"

### 5. Create OAuth Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "CREATE CREDENTIALS" → "OAuth client ID"
3. Application type: **Desktop app**
4. Name: `Qreate Desktop`
5. Click "CREATE"

### 6. Download Credentials
1. You'll see a success dialog with Client ID and Client Secret
2. Click "DOWNLOAD JSON"
3. Save the file as `credentials.json` in the project root

**File location:**
```
Qreate/
├── credentials.json  ← Put it here
├── src/
├── package.json
└── ...
```

### 7. Add to .gitignore
The credentials file is already in `.gitignore`, but double-check:

```
credentials.json
token.json
```

---

## Security Notes

- ✅ `credentials.json` contains your OAuth client ID and secret
- ✅ It's safe to use in a desktop app (not exposed to users)
- ✅ For production, these credentials will be bundled with the app
- ⚠️ **Never commit these files to GitHub**
- ⚠️ The `.gitignore` already excludes them

---

## What happens next?

Once you have `credentials.json` in place:
1. User clicks "Connect Google Drive"
2. A browser opens with Google login
3. User grants permission
4. App receives access token
5. Token is stored securely in `token.json`
6. Future requests use the stored token (no re-login needed)

---

## Troubleshooting

### "Access blocked: This app is not verified"
This is normal during development! Click "Advanced" → "Go to Qreate (unsafe)".

For production deployment, you'll need to submit the app for Google verification.

### "Redirect URI mismatch"
Make sure you selected "Desktop app" type, not "Web application".

### "API not enabled"
Go back to "APIs & Services" → "Library" and enable the required APIs.

---

## Need Help?

If you encounter issues, check:
- https://developers.google.com/docs/api/quickstart/nodejs
- https://developers.google.com/drive/api/guides/about-auth
