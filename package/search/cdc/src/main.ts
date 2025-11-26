import postgres from 'postgres';

const sql = postgres({
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: '123456',
  database: 'library',
  replication: 'database', // 必须！
});

async function main() {
  console.log('Starting CDC...');

  // 订阅 slot
  const replication = sql.subscribe(
    'library_cdc_slot',
    {
      decoder: 'pgoutput',
      temporary: false,
    },
    (lsn, log) => {
      // 解析 pgoutput 的 JSON
      const msg = log.json();

      console.log('----- CDC EVENT -----');
      console.log(JSON.stringify(msg, null, 2));

      // 你可以在这里：
      // - 推送到 MeiliSearch
      // - 写到 Kafka / Redis Stream
      // - 发送到 WebSocket
      // - 写入本地缓存
    },
  );

  // 保持心跳
  replication.on('error', console.error);
}

main();
