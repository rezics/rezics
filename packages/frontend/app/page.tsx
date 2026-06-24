const navItems = [
  { href: "#home", label: "Home" },
  { href: "#library", label: "Library" },
  { href: "#search", label: "Search" },
  { href: "#operations", label: "Operations" },
];

const panels = [
  {
    title: "Library",
    id: "library",
    body: "Curated books, posts, realms, shelves, and progress surfaces.",
  },
  {
    title: "Search",
    id: "search",
    body: "Federated discovery across catalog, posts, comments, and entities.",
  },
  {
    title: "Operations",
    id: "operations",
    body: "Internal workflows for content, moderation, sync, and diagnostics.",
  },
];

export default function HomePage() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-name">Rezics</div>
          <div className="brand-meta">Unified web</div>
        </div>
        <nav aria-label="Primary" className="nav">
          {navItems.map((item) => (
            <a href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="topbar-title">Workspace</div>
          <div className="topbar-status">Ready</div>
        </header>
        <section className="workspace" id="home">
          <h1 className="page-title">Rezics</h1>
          <p className="summary">
            A consolidated web surface for reading, editing, discovery, and
            operations.
          </p>
          <div className="panel-grid">
            {panels.map((panel) => (
              <article className="panel" id={panel.id} key={panel.title}>
                <h2>{panel.title}</h2>
                <p>{panel.body}</p>
              </article>
            ))}
          </div>
          <div className="action-row">
            <a className="button" href="/">
              Open workspace
            </a>
            <a className="button secondary" href="#operations">
              Operations
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
