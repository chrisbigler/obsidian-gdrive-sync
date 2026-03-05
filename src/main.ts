import { Notice, Plugin } from "obsidian";
import { GDriveSyncSettingTab } from "./settings";
import { sync } from "./sync";
import { DEFAULT_SETTINGS, type GDriveSyncSettings } from "./types";

const ENCRYPTED_FIELDS: (keyof GDriveSyncSettings)[] = ["clientSecret", "refreshToken"];
const ENC_PREFIX = "enc:";

function canEncrypt(): boolean {
  try {
    const { safeStorage } = require("electron");
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function encrypt(value: string): string {
  if (!value) return value;
  const { safeStorage } = require("electron");
  const buf: Buffer = safeStorage.encryptString(value);
  return ENC_PREFIX + buf.toString("base64");
}

function decrypt(value: string): string {
  if (!value || !value.startsWith(ENC_PREFIX)) return value;
  const { safeStorage } = require("electron");
  const buf = Buffer.from(value.slice(ENC_PREFIX.length), "base64");
  return safeStorage.decryptString(buf);
}

export default class GDriveSyncPlugin extends Plugin {
  settings: GDriveSyncSettings = DEFAULT_SETTINGS;
  private syncIntervalId: number | null = null;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new GDriveSyncSettingTab(this.app, this));

    this.addCommand({
      id: "sync-now",
      name: "Sync Google Drive meetings now",
      callback: () => this.runSync(),
    });

    this.addRibbonIcon("refresh-cw", "Sync GDrive meetings", () => this.runSync());

    this.startSyncInterval();
  }

  onunload() {
    this.syncIntervalId = null;
  }

  async loadSettings() {
    const stored = (await this.loadData()) || {};

    // Decrypt secret fields
    if (canEncrypt()) {
      for (const field of ENCRYPTED_FIELDS) {
        if (typeof stored[field] === "string") {
          stored[field] = decrypt(stored[field]);
        }
      }
    }

    this.settings = Object.assign({}, DEFAULT_SETTINGS, stored);
  }

  async saveSettings() {
    const toStore = { ...this.settings };

    // Encrypt secret fields before persisting
    if (canEncrypt()) {
      for (const field of ENCRYPTED_FIELDS) {
        const val = toStore[field];
        if (typeof val === "string" && val && !val.startsWith(ENC_PREFIX)) {
          (toStore as Record<string, unknown>)[field] = encrypt(val);
        }
      }
    }

    await this.saveData(toStore);
  }

  async runSync() {
    if (!this.settings.refreshToken) {
      new Notice("GDrive Sync: Not authorized. Open settings to connect Google.");
      return;
    }
    if (!this.settings.folderId) {
      new Notice("GDrive Sync: No folder ID configured.");
      return;
    }

    new Notice("GDrive sync starting...");
    try {
      const result = await sync(this.app, this.settings);
      const parts: string[] = [];
      if (result.newCount > 0) parts.push(`${result.newCount} new`);
      if (result.adoptedCount > 0) parts.push(`${result.adoptedCount} adopted`);
      parts.push(`${result.skippedCount} skipped`);
      if (result.errorCount > 0) parts.push(`${result.errorCount} errors`);
      new Notice(`GDrive sync: ${parts.join(", ")}`);
    } catch (e) {
      console.error("[gdrive-sync] Sync failed:", e);
      new Notice(`GDrive sync failed: ${String(e)}`);
    }
  }

  restartSyncInterval() {
    // Clear old interval if we had one registered outside registerInterval
    if (this.syncIntervalId !== null) {
      window.clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    this.startSyncInterval();
  }

  private startSyncInterval() {
    const minutes = this.settings.syncIntervalMinutes;
    if (minutes <= 0) return;

    const ms = minutes * 60 * 1000;
    this.syncIntervalId = this.registerInterval(
      window.setInterval(() => this.runSync(), ms)
    );
  }
}
