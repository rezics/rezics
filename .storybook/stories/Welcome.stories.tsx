import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Welcome/Overview",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const refs: Array<{ port: number; title: string; pkg: string; what: string }> =
  [
    {
      port: 6006,
      title: "Host",
      pkg: "(this)",
      what: "Aggregates the five package storybooks via refs.",
    },
    {
      port: 6007,
      title: "UI · Foundation",
      pkg: "@rezics/ui",
      what: "Tokens, MUI theme, primitives, shadcn glue.",
    },
    {
      port: 6008,
      title: "Editor · CodeMirror",
      pkg: "@rezics/editor",
      what: "Markdown / JSON editors with toolbar.",
    },
    {
      port: 6009,
      title: "Folio · Reader",
      pkg: "@rezics/folio",
      what: "Book reader, paginated + scroll modes.",
    },
    {
      port: 6010,
      title: "Admin",
      pkg: "@rezics/admin",
      what: "Operations app — dense tables, outlined inputs.",
    },
    {
      port: 6011,
      title: "App",
      pkg: "@rezics/app",
      what: "Main app — generous browsing, content-led.",
    },
  ];

export const Welcome: Story = {
  render: () => (
    <div
      style={{
        maxWidth: 720,
        fontFamily: "system-ui, sans-serif",
        lineHeight: 1.55,
        padding: 16,
      }}
    >
      <h1 style={{ fontWeight: 500 }}>rezics design system</h1>
      <p>
        Each publishable surface owns its own Storybook so the package can ship
        standalone. This host simply aggregates them via <code>refs</code>.
      </p>
      <p>
        Boot the package storybooks in their own terminals first, then run{" "}
        <code>bun run storybook</code> at the repo root.
      </p>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 14,
          marginTop: 24,
        }}
      >
        <thead>
          <tr>
            <th align="left" style={{ padding: "8px 0" }}>
              Port
            </th>
            <th align="left">Title</th>
            <th align="left">Package</th>
            <th align="left">Scope</th>
          </tr>
        </thead>
        <tbody>
          {refs.map((r) => (
            <tr
              key={r.port}
              style={{
                borderTop: "1px solid var(--rezics-color-border-whisper)",
              }}
            >
              <td style={{ padding: "8px 0" }}>{r.port}</td>
              <td>{r.title}</td>
              <td>
                <code>{r.pkg}</code>
              </td>
              <td>{r.what}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p
        style={{
          marginTop: 24,
          color: "var(--rezics-color-text-tertiary)",
          fontSize: 13,
        }}
      >
        Note: Chrome blocks ports 6000, 6566, 6665–6669, 6697 with{" "}
        <code>ERR_UNSAFE_PORT</code>. The assignments above are all safe.
      </p>
    </div>
  ),
};
