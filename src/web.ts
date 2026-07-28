import { bridge } from "./native";

/** Browser fallbacks. Where the web has no equivalent the fallback says so
 *  instead of faking success — the point of the preview is the interface. */
export const call = bridge({
  versions: () => ({
    electron: "web build",
    chrome: (navigator.userAgent.match(/Chrome\/([\d.]+)/) ?? [, "—"])[1] as string,
    node: "n/a in the browser",
    v8: "n/a in the browser",
    platform: navigator.platform,
    cores: String(navigator.hardwareConcurrency || 1),
  }),
  digest: async ({ text }: { text: string }) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return "sha256:" + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  },
  metrics: () => {
    const mem = (performance as any).memory;
    return [
      { pid: 1, type: "Browser", cpu: 0, mem: mem ? mem.usedJSHeapSize / 1024 : 0 },
    ];
  },
  open_file: () =>
    new Promise<string>((res) => {
      const i = document.createElement("input");
      i.type = "file";
      i.onchange = () => res(i.files?.[0] ? `${i.files[0].name} (${i.files[0].size} bytes)` : "cancelled");
      i.click();
    }),
  notify: async ({ title, body }: { title: string; body: string }) => {
    if (!("Notification" in window)) return "no Notification API";
    if (Notification.permission !== "granted") await Notification.requestPermission();
    if (Notification.permission !== "granted") return "permission denied";
    new Notification(title, { body });
    return "notified";
  },
  new_window: () => (window.open(location.href, "_blank") ? "opened a tab" : "popup blocked"),
  open_external: ({ url }: { url: string }) => {
    open(url, "_blank");
    return url;
  },
});
