import { useFolio } from '../context';

export function ContentRenderer() {
  const { state, content, registry } = useFolio();

  if (!content) return null;

  const plugin = registry.resolveRenderer(content.contentType);

  if (!plugin) {
    return (
      <div className="folio-content-fallback" style={{ padding: '24px' }}>
        <p>No renderer available for content type: {content.contentType}</p>
      </div>
    );
  }

  const { Renderer } = plugin;

  return (
    <div
      className="folio-content"
      style={{
        fontSize: `${state.fontSize}px`,
        lineHeight: state.lineHeight,
        '--folio-font-size': `${state.fontSize}px`,
        '--folio-line-height': `${state.lineHeight}`,
      } as React.CSSProperties}
    >
      <Renderer raw={content.raw} meta={content.meta} />
    </div>
  );
}
