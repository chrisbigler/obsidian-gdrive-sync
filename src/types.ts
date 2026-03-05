export interface GDriveSyncSettings {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId: string;
  destFolder: string;
  syncIntervalMinutes: number;
  manifestPath: string;
}

export const DEFAULT_SETTINGS: GDriveSyncSettings = {
  clientId: "",
  clientSecret: "",
  refreshToken: "",
  folderId: "",
  destFolder: "Meetings",
  syncIntervalMinutes: 30,
  manifestPath: `${process.env.HOME}/.gdrive-sync/manifest.json`,
};

export interface ManifestEntry {
  name: string;
  localFile: string;
  modifiedTime: string;
  syncedAt: string;
}

export type Manifest = Record<string, ManifestEntry>;

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

export interface SyncResult {
  newCount: number;
  adoptedCount: number;
  skippedCount: number;
  errorCount: number;
}
