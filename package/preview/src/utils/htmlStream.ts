/**
 * Prepend `<!doctype html>` to a React stream.
 *
 * `renderToReadableStream()` returns a Web ReadableStream<Uint8Array>,
 * which is perfect for Bun/Elysia.
 */
export function withDoctype(stream: ReadableStream<Uint8Array>) {
  const encoder = new TextEncoder();
  const reader = stream.getReader();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode("<!doctype html>"));

      const pump = async (): Promise<void> => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) controller.enqueue(value);
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      };

      void pump();
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });
}
