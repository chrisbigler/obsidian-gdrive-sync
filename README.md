# GDrive Meeting Sync

An Obsidian plugin that syncs Google Docs from a Google Drive folder into your vault as markdown files. Designed for meeting notes that land in a shared Drive folder and need to show up in Obsidian automatically.

## Features

- **One-way sync** - Downloads Google Docs as markdown. "Download once, then forget" - files are synced once and never re-downloaded or overwritten.
- **Auto-sync on interval** - Runs in the background on a configurable interval (default: 30 min). Also available as a manual command.
- **Native OAuth** - Authorize with Google directly from the plugin settings. No CLI tools or external dependencies needed.
- **Encrypted secrets** - Client secret and refresh token are encrypted via the OS keychain (Electron safeStorage) before being stored on disk.
- **Duplicate handling** - If multiple Drive docs share the same name, the plugin appends a counter (`_2`, `_3`, etc.) to avoid collisions.
- **Desktop only** - Requires Electron APIs for OAuth and file picking. Not compatible with Obsidian mobile.

## Installation

### Via BRAT (recommended)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin from Community Plugins
2. Open BRAT settings and click **Add Beta plugin**
3. Enter: `chrisbigler/obsidian-gdrive-sync`
4. Enable **GDrive Meeting Sync** in Settings > Community Plugins

### Manual

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/chrisbigler/obsidian-gdrive-sync/releases/latest)
2. Create a folder at `<your-vault>/.obsidian/plugins/gdrive-sync/`
3. Copy both files into that folder
4. Enable **GDrive Meeting Sync** in Settings > Community Plugins

## Setup

The plugin needs OAuth credentials from a Google Cloud project to access your Drive. You only need to do this once.

### 1. Create a Google Cloud project

- Go to [Google Cloud Console - New Project](https://console.cloud.google.com/projectcreate)
- Give it any name (e.g. "Obsidian GDrive Sync")

### 2. Enable the Google Drive API

- Go to [Drive API Library Page](https://console.cloud.google.com/apis/library/drive.googleapis.com)
- Make sure your project is selected, then click **Enable**

### 3. Configure the OAuth consent screen

- Go to [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
- Choose **External** (fine for personal use)
- Fill in the required fields (app name, support email)
- Add the scope: `https://www.googleapis.com/auth/drive.readonly`
- Add your Google account as a test user

### 4. Create OAuth credentials

- Go to [Create OAuth Client ID](https://console.cloud.google.com/apis/credentials/oauthclient)
- Application type: **Desktop app**
- Give it any name
- Copy the **Client ID** and **Client Secret**

### 5. Configure the plugin

Open the plugin settings in Obsidian:

1. Paste the **Client ID** and **Client Secret**
2. Click **Authorize with Google** - a browser window opens for consent
3. Paste the **Drive folder URL** (or just the folder ID) of the folder you want to sync
4. Click **Choose folder** to pick where synced files should go in your vault
5. Adjust the sync interval if desired (default: 30 minutes, set to 0 to disable)

### 6. Run your first sync

Open the command palette (`Cmd+P`) and run **Sync Google Drive meetings now**. You can also click the refresh icon in the ribbon.

## Usage

Once configured, the plugin syncs automatically on the configured interval. You can also:

- **Manual sync**: Command palette > "Sync Google Drive meetings now"
- **Ribbon icon**: Click the refresh icon in the left sidebar
- **Check status**: Sync results appear as Obsidian notification toasts

## Building from source

```bash
git clone https://github.com/chrisbigler/obsidian-gdrive-sync.git
cd obsidian-gdrive-sync
npm install
npm run build
```

The built `main.js` will be in the project root. Copy it along with `manifest.json` to your vault's `.obsidian/plugins/gdrive-sync/` folder.
