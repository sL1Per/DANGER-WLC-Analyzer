const REPO_URL = "https://github.com/sL1Per/DANGER-WLC-Analyzer";

/** Site-wide footer: credits, source link, and the running app version (linked to
 *  the changelog). Shown under every page by AppShell. */
export function AppFooter() {
  return (
    <footer className="app-footer">
      <p className="app-footer__credits">
        Built by <a href="https://github.com/sL1Per" target="_blank" rel="noreferrer">Pedro Viegas</a>
        {" · "}Inspired by Shariva's <a href="https://discord.gg/nGvt5zH" target="_blank" rel="noreferrer">CLA &amp; RPB</a> sheets
        {" · "}Data from <a href="https://classic.warcraftlogs.com" target="_blank" rel="noreferrer">Warcraft Logs</a>
      </p>
      <p className="app-footer__meta">
        <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a>
        {" · "}
        <a href={`${REPO_URL}/blob/main/CHANGELOG.md`} target="_blank" rel="noreferrer" className="mono">v{__APP_VERSION__}</a>
        {" · "}Not affiliated with Blizzard Entertainment or Warcraft Logs.
      </p>
    </footer>
  );
}
