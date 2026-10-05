import { createServer } from 'node:http';

let handler;
const server = createServer((request, response) => {
  if (handler) handler(request, response);
  else response.writeHead(503).end();
});
server.listen(0, '127.0.0.1', async () => {
  const address = server.address();
  process.env.ORIGIN = `http://localhost:${address.port}`;
  process.env.NODE_ENV = 'production';
  const module = await import('../../build/handler.js');
  handler = module.handler;
  process.stdout.write(`${JSON.stringify({ origin: process.env.ORIGIN })}\n`);
});
function close() {
  server.closeAllConnections();
  server.close();
}
process.on('SIGTERM', close);
process.on('SIGINT', close);
