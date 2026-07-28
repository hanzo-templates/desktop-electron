import { useEffect, useState } from "react";
import { Win, NavItem } from "./shell";
import { isNative } from "./native";
import { call } from "./web";

const RELEASES = "https://github.com/hanzo-templates/desktop-electron/releases/latest";

type Versions = Record<string, string>;
type Metrics = { pid: number; type: string; cpu: number; mem: number }[];

const PANES = ["Overview", "IPC", "Processes", "Native"] as const;
type Pane = (typeof PANES)[number];

export default function App() {
  const [pane, setPane] = useState<Pane>("Overview");
  const [v, setV] = useState<Versions>({});

  useEffect(() => { call("versions").then(setV); }, []);

  return (
    <Win
      title="Electron"
      sub="forge + vite + react"
      releases={RELEASES}
      status={
        <>
          <span>electron {v.electron ?? "—"}</span>
          <span className="grow" />
          <span>chromium {v.chrome ?? "—"}</span>
          <span>node {v.node ?? "—"}</span>
        </>
      }
      side={
        <>
          <h2>Template</h2>
          <nav className="nav">
            {PANES.map((p) => (
              <NavItem key={p} on={pane === p} onClick={() => setPane(p)} dot={pane === p}>{p}</NavItem>
            ))}
          </nav>
          <h2>Processes</h2>
          <div style={{ padding: "0 8px", fontSize: 12 }}>
            {[["main", "src/main.ts", "Node — windows, menus, disk"],
              ["preload", "src/preload.ts", "the bridge, contextIsolated"],
              ["renderer", "src/app.tsx", "Chromium — no Node at all"]].map(([k, f, why]) => (
              <div key={k} style={{ marginBottom: 10 }}>
                <div>{k}</div>
                <div className="dim mono" style={{ fontSize: 11 }}>{f}</div>
                <div className="dim" style={{ fontSize: 11 }}>{why}</div>
              </div>
            ))}
          </div>
        </>
      }
    >
      {pane === "Overview" && <Overview v={v} />}
      {pane === "IPC" && <Ipc />}
      {pane === "Processes" && <Procs />}
      {pane === "Native" && <Native />}
    </Win>
  );
}

function Overview({ v }: { v: Versions }) {
  return (
    <>
      <h3>When Electron, and when not</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Most Hanzo desktop templates are Tauri — a 4 MB installer against the OS
        webview. Electron is the right answer when you need Chromium itself:
        <span className="mono"> desktopCapturer</span>, a Node-only library in-process,
        or byte-identical rendering across every OS. This template is that baseline.
      </p>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", marginTop: 16 }}>
        {Object.entries(v).slice(0, 8).map(([k, x]) => (
          <div className="card" key={k}>
            <div className="dim" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em" }}>{k}</div>
            <div className="mono" style={{ fontSize: 17, marginTop: 4 }}>{x}</div>
          </div>
        ))}
        {Object.keys(v).length === 0 && <div className="card dim">reading versions…</div>}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Security posture</h3>
        <ul className="muted" style={{ margin: "8px 0 0", paddingLeft: 18 }}>
          <li><code className="mono">contextIsolation: true</code> — renderer and preload never share a realm</li>
          <li><code className="mono">nodeIntegration: false</code> — the page cannot <code className="mono">require</code></li>
          <li><code className="mono">sandbox: true</code> — renderer runs in the OS sandbox</li>
          <li>one <code className="mono">hanzo:call</code> channel; the main process owns the command allowlist</li>
        </ul>
      </div>
    </>
  );
}

function Ipc() {
  const [text, setText] = useState("hanzo");
  const [out, setOut] = useState("");
  const [ms, setMs] = useState(0);
  async function go() {
    const t = performance.now();
    setOut(await call("digest", { text }));
    setMs(Math.round((performance.now() - t) * 100) / 100);
  }
  useEffect(() => { go(); }, []);
  return (
    <>
      <h3>IPC round-trip</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        renderer → <code className="mono">window.hanzo.call</code> → preload →{" "}
        <code className="mono">ipcRenderer.invoke</code> → main. The browser build resolves the
        same call through <code className="mono">src/web.ts</code>.
      </p>
      <div className="row" style={{ marginTop: 16 }}>
        <input className="inp" value={text} onChange={(e) => setText(e.target.value)}
               onKeyDown={(e) => e.key === "Enter" && go()} />
        <button className="btn pri" onClick={go}>invoke</button>
      </div>
      <div className="card mono" style={{ marginTop: 12, wordBreak: "break-all" }}>{out || "…"}</div>
      <div className="dim mono" style={{ marginTop: 8, fontSize: 11 }}>
        {isNative ? "main process (node sha256)" : "web crypto (sha256)"} · {ms} ms
      </div>
    </>
  );
}

function Procs() {
  const [m, setM] = useState<Metrics>([]);
  useEffect(() => {
    const tick = () => call("metrics").then(setM);
    tick();
    const iv = setInterval(tick, 1500);
    return () => clearInterval(iv);
  }, []);
  return (
    <>
      <h3>Process tree</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        <code className="mono">app.getAppMetrics()</code> — every Chromium process this app owns,
        which is the honest answer to "why is Electron heavy".
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
        <thead><tr className="dim" style={{ fontSize: 11, textAlign: "left" }}>
          <th style={{ padding: "6px 0" }}>PID</th><th>TYPE</th>
          <th style={{ textAlign: "right" }}>CPU</th><th style={{ textAlign: "right" }}>MEM</th>
        </tr></thead>
        <tbody>
          {m.map((p) => (
            <tr key={p.pid} style={{ borderTop: "1px solid var(--line)" }}>
              <td className="mono dim" style={{ padding: "6px 0" }}>{p.pid}</td>
              <td>{p.type}</td>
              <td className="mono" style={{ textAlign: "right" }}>{p.cpu.toFixed(1)}%</td>
              <td className="mono dim" style={{ textAlign: "right" }}>{(p.mem / 1024).toFixed(0)} MB</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="dim mono" style={{ marginTop: 10, fontSize: 11 }}>
        total {(m.reduce((a, b) => a + b.mem, 0) / 1024).toFixed(0)} MB across {m.length} processes
      </div>
    </>
  );
}

function Native() {
  const [note, setNote] = useState("");
  const acts: [string, string, () => Promise<unknown>][] = [
    ["Open file…", "native OS file dialog", () => call("open_file")],
    ["Notify", "OS notification centre", () => call("notify", { title: "Electron", body: "from the main process" })],
    ["New window", "a second BrowserWindow", () => call("new_window")],
    ["Open hanzo.ai", "shell.openExternal", () => call("open_external", { url: "https://hanzo.ai" })],
  ];
  return (
    <>
      <h3>Native surfaces</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Everything below is main-process API. In the browser build these degrade
        to the closest web equivalent, or say plainly that there isn't one.
      </p>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", marginTop: 16 }}>
        {acts.map(([label, why, fn]) => (
          <div className="card" key={label}>
            <div className="row">
              <b>{label}</b><span className="grow" />
              <button className="btn" onClick={async () => setNote(String(await fn()))}>run</button>
            </div>
            <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>{why}</div>
          </div>
        ))}
      </div>
      {note && <div className="card mono" style={{ marginTop: 14, wordBreak: "break-all" }}>{note}</div>}
    </>
  );
}
