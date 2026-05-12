// Vercel serverless entry point.
// Vercel does not call app.listen() — it imports the Express app as a handler.
import { createApp } from "../src/app";

const { app } = createApp();

export default app;
