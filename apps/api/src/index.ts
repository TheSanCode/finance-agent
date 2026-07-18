import { createApp } from "./app.js";

const PORT = Number.parseInt(process.env.PORT ?? "8080", 10);

const app = createApp();

app.listen(PORT, () => {
  console.log(`finance-agent-api listening on port ${PORT}`);
});
