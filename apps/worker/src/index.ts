// Cac job BullMQ duoc them tu task R1, R2.
const keepAlive = setInterval(() => undefined, 60_000);

console.log('Worker da san sang.');

function shutdown() {
  clearInterval(keepAlive);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
