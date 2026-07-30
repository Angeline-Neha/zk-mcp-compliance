import { handleIncomingTask } from "./agent";

async function main() {
  const ticketText =
    process.argv.slice(2).join(" ") || "Hi, can I get a refund for order 4521? It arrived damaged.";

  console.log(`\n=== Incoming task ===\n${ticketText}\n`);
  const result = await handleIncomingTask(ticketText);

  console.log("=== Delegations minted ===");
  console.log(JSON.stringify(result.delegations, null, 2));

  console.log("\n=== support-agent results ===");
  console.log(JSON.stringify(result.supportAgentResults, null, 2));

  console.log("\n=== Orchestrator final response ===");
  console.log(result.finalResponse);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});