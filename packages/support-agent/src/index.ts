import { handleTicket } from "./agent";

async function main() {
  const ticketText = process.argv.slice(2).join(" ") || "Hi, can I get a refund for order 4521? It arrived damaged.";

  console.log(`\n=== Ticket ===\n${ticketText}\n`);
  const result = await handleTicket(ticketText);

  console.log("=== Tool calls ===");
  for (const call of result.toolCalls) {
    console.log(`\n> ${call.tool}(${JSON.stringify(call.input)})`);
    console.log(JSON.stringify(call.result, null, 2));
  }

  console.log("\n=== Final response to customer ===");
  console.log(result.finalResponse);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});