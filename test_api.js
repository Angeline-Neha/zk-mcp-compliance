async function test() {
  try {
    const res = await fetch("http://localhost:4006/task/structured", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: "cust-pass-1",
        ticketText: "Hi, my order 1001 arrived damaged, please refund it."
      })
    });
    console.log(res.status);
    console.log(await res.text());
  } catch (err) {
    console.error("Fetch failed", err);
  }
}
test();
