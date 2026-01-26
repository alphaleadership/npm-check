import "dotenv/config";
import Piscina from "piscina";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startProducer,shutdown } from "./producer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);




function nowIso(): string {
  return new Date().toISOString();
}

async function main() {
  console.log(`[${nowIso()}] Starting application...`);

  const piscina = new Piscina({
    filename: path.resolve(__dirname, "piscina-worker.ts"),
  });

  console.log(`[${nowIso()}] Worker pool started.`);

  // Start the producer
  await startProducer(piscina);
}

main().catch((e) => {
  const errorMessage = e instanceof Error && e.stack ? e.stack : String(e);
  console.error(`[${nowIso()}] fatal: ${errorMessage}\n`);
  shutdown();
 
});
process.on('SIGINT', () => {
  console.log('Received SIGINT. Shutting down gracefully...');
  shutdown();
} );
process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Shutting down gracefully...');
  shutdown();
} );