import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/dentcarepro";

export default defineConfig({
  schema: ["./drizzle/schema.ts", "./drizzle/schema-ficha-utente.ts", "./drizzle/schema-audit.ts", "./drizzle/schema-ia.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
