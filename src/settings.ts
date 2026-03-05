import { App, PluginSettingTab, Setting, normalizePath } from "obsidian";
import * as path from "path";
import type GDriveSyncPlugin from "./main";
import { startOAuthFlow, clearTokenCache } from "./auth";

function extractFolderId(input: string): string {
  input = input.trim();
  // Full URL: https://drive.google.com/drive/folders/FOLDER_ID or with query params
  const match = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Already a raw ID (no slashes, no dots)
  return input;
}

export class GDriveSyncSettingTab extends PluginSettingTab {
  plugin: GDriveSyncPlugin;

  constructor(app: App, plugin: GDriveSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private createCredentialDesc(label: string): DocumentFragment {
    const { shell } = require("electron");
    const frag = document.createDocumentFragment();
    const details = frag.createEl("details");
    details.style.marginTop = "2px";
    const summary = details.createEl("summary");
    summary.style.cursor = "pointer";
    summary.style.fontSize = "inherit";
    summary.style.color = "var(--text-muted)";
    summary.setText(`OAuth 2.0 ${label}`);
    const steps = details.createEl("ol");
    steps.style.margin = "6px 0 0 0";
    steps.style.paddingLeft = "1.4em";
    steps.style.color = "var(--text-muted)";

    const items: { text: string; url?: string }[] = [
      { text: "Create or select a GCP project", url: "https://console.cloud.google.com/projectcreate" },
      { text: "Enable the Google Drive API", url: "https://console.cloud.google.com/apis/library/drive.googleapis.com" },
      { text: "Configure the OAuth consent screen", url: "https://console.cloud.google.com/apis/credentials/consent" },
      { text: "Create an OAuth 2.0 Client ID (type: Desktop app)", url: "https://console.cloud.google.com/apis/credentials/oauthclient" },
      { text: `Copy the ${label} from the credential details` },
    ];
    for (const item of items) {
      const li = steps.createEl("li");
      if (item.url) {
        const link = li.createEl("a", { text: `${item.text} \u2197` });
        link.style.cursor = "pointer";
        link.addEventListener("click", (e) => {
          e.preventDefault();
          shell.openExternal(item.url!);
        });
      } else {
        li.setText(item.text);
      }
    }
    return frag;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // -- Google OAuth credentials --

    new Setting(containerEl)
      .setName("Client ID")
      .setDesc(this.createCredentialDesc("Client ID"))
      .addText((text) =>
        text
          .setPlaceholder("xxxx.apps.googleusercontent.com")
          .setValue(this.plugin.settings.clientId)
          .onChange(async (value) => {
            this.plugin.settings.clientId = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Client Secret")
      .setDesc(this.createCredentialDesc("Client Secret"))
      .addText((text) => {
        text
          .setPlaceholder("GOCSPX-...")
          .setValue(this.plugin.settings.clientSecret)
          .onChange(async (value) => {
            this.plugin.settings.clientSecret = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
      });

    // -- Auth status + button --

    const isConnected = !!this.plugin.settings.refreshToken;

    const authDescFrag = document.createDocumentFragment();
    if (isConnected) {
      const dot = authDescFrag.createSpan();
      dot.style.display = "inline-block";
      dot.style.width = "8px";
      dot.style.height = "8px";
      dot.style.borderRadius = "50%";
      dot.style.backgroundColor = "#4ade80";
      dot.style.marginRight = "6px";
      dot.style.verticalAlign = "middle";
      authDescFrag.createSpan({ text: "Connected" });
    } else {
      authDescFrag.createSpan({ text: "Not connected" });
    }

    const authSetting = new Setting(containerEl)
      .setName("Google authorization")
      .setDesc(authDescFrag);

    if (this.plugin.settings.refreshToken) {
      authSetting.addButton((btn) => {
        btn
          .setButtonText("Disconnect")
          .onClick(async () => {
            this.plugin.settings.refreshToken = "";
            clearTokenCache();
            await this.plugin.saveSettings();
            this.display();
          });
        const el = btn.buttonEl;
        el.style.backgroundColor = "var(--background-modifier-error)";
        el.style.color = "white";
      });
    } else {
      authSetting.addButton((btn) =>
        btn.setButtonText("Authorize with Google").setCta().onClick(() => {
          startOAuthFlow(this.plugin.settings, async (refreshToken) => {
            this.plugin.settings.refreshToken = refreshToken;
            await this.plugin.saveSettings();
            this.display();
          });
        })
      );
    }

    // -- Sync settings --

    new Setting(containerEl)
      .setName("Drive folder")
      .setDesc("Paste a Google Drive folder URL or ID")
      .addText((text) =>
        text
          .setPlaceholder("https://drive.google.com/drive/folders/...")
          .setValue(this.plugin.settings.folderId)
          .onChange(async (value) => {
            this.plugin.settings.folderId = extractFolderId(value);
            await this.plugin.saveSettings();
            // Show the resolved ID in the field after a URL paste
            if (value.includes("/")) {
              text.setValue(this.plugin.settings.folderId);
            }
          })
      );

    const hasFolder = !!this.plugin.settings.destFolder;
    const destSetting = new Setting(containerEl)
      .setName("Destination folder")
      .setDesc(hasFolder ? this.plugin.settings.destFolder : "No folder selected");

    const openPicker = async () => {
      const electron = require("electron");
      const vaultBase = (this.app.vault.adapter as any).basePath as string;
      const defaultPath = path.join(vaultBase, this.plugin.settings.destFolder);

      const result = await electron.remote.dialog.showOpenDialog({
        title: "Choose destination folder",
        defaultPath,
        properties: ["openDirectory", "createDirectory"],
      });

      if (result.canceled || !result.filePaths?.length) return;

      const chosen = result.filePaths[0];
      if (!chosen.startsWith(vaultBase)) {
        new (require("obsidian").Notice)("Folder must be inside the vault.");
        return;
      }
      const relative = normalizePath(chosen.slice(vaultBase.length + 1));
      this.plugin.settings.destFolder = relative || "";
      await this.plugin.saveSettings();
      this.display();
    };

    if (hasFolder) {
      destSetting.addButton((btn) =>
        btn.setButtonText("Change").onClick(openPicker)
      );
    } else {
      destSetting.addButton((btn) =>
        btn.setButtonText("Choose folder").setCta().onClick(openPicker)
      );
    }

    new Setting(containerEl)
      .setName("Sync interval (minutes)")
      .setDesc("How often to auto-sync. Set to 0 to disable auto-sync.")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.syncIntervalMinutes))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num >= 0) {
              this.plugin.settings.syncIntervalMinutes = num;
              await this.plugin.saveSettings();
              this.plugin.restartSyncInterval();
            }
          })
      );

    new Setting(containerEl)
      .setName("Manifest path")
      .setDesc("Path to the shared manifest.json file (for coexistence with launchd sync)")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.manifestPath)
          .onChange(async (value) => {
            this.plugin.settings.manifestPath = value.trim();
            await this.plugin.saveSettings();
          })
      );
  }
}
