import { handleTicket } from "./agent";

async function main() {
  const ticketText =
    process.argv.slice(2).join(" ") ||
    "Please delete my account acct-001, I no longer want to use this service.";

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