type SseConnection = {
  send: (data: string) => void;
};

const subscribers = new Map<string, Set<SseConnection>>();

export function subscribe(userId: string, connection: SseConnection) {
  let connections = subscribers.get(userId);
  if (!connections) {
    connections = new Set();
    subscribers.set(userId, connections);
  }
  connections.add(connection);
}

export function unsubscribe(userId: string, connection: SseConnection) {
  const connections = subscribers.get(userId);
  if (!connections) return;
  connections.delete(connection);
  if (connections.size === 0) {
    subscribers.delete(userId);
  }
}

export function publish(userId: string, event: unknown) {
  const connections = subscribers.get(userId);
  if (!connections || connections.size === 0) return;

  const data = JSON.stringify(event);
  for (const conn of connections) {
    try {
      conn.send(data);
    } catch {
      // Connection dead — will be cleaned up on disconnect
      // 连接已失效——将在断开连接时清理
    }
  }
}
