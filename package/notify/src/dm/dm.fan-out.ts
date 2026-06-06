type WsConnection = {
  send: (data: string | object) => void;
};

const subscribers = new Map<string, Set<WsConnection>>();

export function subscribe(userId: string, ws: WsConnection) {
  let connections = subscribers.get(userId);
  if (!connections) {
    connections = new Set();
    subscribers.set(userId, connections);
  }
  connections.add(ws);
}

export function unsubscribe(userId: string, ws: WsConnection) {
  const connections = subscribers.get(userId);
  if (!connections) return;
  connections.delete(ws);
  if (connections.size === 0) {
    subscribers.delete(userId);
  }
}

export function publish(userId: string, message: unknown) {
  const connections = subscribers.get(userId);
  if (!connections || connections.size === 0) return;

  const data = JSON.stringify(message);
  for (const conn of connections) {
    try {
      conn.send(data);
    } catch {
      // Dead connection — cleaned up on close
    }
  }
}
