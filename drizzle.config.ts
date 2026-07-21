import { defineConfig } from "drizzle-kit";
import { getConnectionString } from "./src/shared/db/client";

export default defineConfig({
  schema: ["./src/shared/db/schemas.ts", "./src/bcs/*/infrastructure/schema.ts"],
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: getConnectionString("MIGRATION_DATABASE_URL"),
  },
});
