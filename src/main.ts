import { app, BrowserWindow, ipcMain, dialog, shell, Notification, Menu } from "electron";
import { createHash } from "node:crypto";
import path from "node:path";

// Every renderer capability in ONE allowlist. The preload exposes a single
// `hanzo:call` channel, so adding a command here is the only way to widen the
// attack surface — and it is impossible to widen it by accident.
const COMMANDS: Record<string, (a: any, w: BrowserWindow | null) => unknown> = {
  versions: () => ({ ...process.versions, platform: process.platform, arch: process.arch }),

  digest: ({ text }: { text: string }) => "sha256:" + createHash("sha256").update(text).digest("hex"),

  metrics: () =>
    app.getAppMetrics().map((m) => ({
      pid: m.pid,
      type: m.type,
      cpu: m.cpu?.percentCPUUsage ?? 0,
      mem: m.memory?.workingSetSize ?? 0,
    })),

  open_file: async (_a, w) => {
    const r = await dialog.showOpenDialog(w!, { properties: ["openFile"] });
    return r.canceled ? "cancelled" : r.filePaths[0];
  },

  notify: ({ title, body }: { title: string; body: string }) => {
    new Notification({ title, body }).show();
    return "notified";
  },

  new_window: () => {
    win();
    return "opened a BrowserWindow";
  },

  open_external: ({ url }: { url: string }) => {
    shell.openExternal(url);
    return url;
  },

  winctl: ({ k }: { k: "close" | "minimize" | "toggleMaximize" }, w) => {
    if (k === "close") w?.close();
    else if (k === "minimize") w?.minimize();
    else w?.isMaximized() ? w.unmaximize() : w?.maximize();
    return k;
  },
};

ipcMain.handle("hanzo:call", (_e, cmd: string, args: unknown) => {
  const fn = COMMANDS[cmd];
  if (!fn) throw new Error(`unknown command: ${cmd}`);
  return fn(args as any, BrowserWindow.getFocusedWindow());
});

function win() {
  const w = new BrowserWindow({
    width: 1120,
    height: 740,
    minWidth: 720,
    minHeight: 480,
    // Frameless: src/shell.tsx draws the titlebar, same as the Tauri templates.
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#0b0b0c",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // MAIN_WINDOW_VITE_DEV_SERVER_URL is injected by @electron-forge/plugin-vite.
  const url = process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL;
  if (url) w.loadURL(url);
  else w.loadFile(path.join(__dirname, `../renderer/${process.env.MAIN_WINDOW_VITE_NAME}/index.html`));
  return w;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }, { role: "viewMenu" }]));
  win();
  app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && win());
});

app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
