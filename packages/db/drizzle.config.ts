import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.NEON_POSTGRES_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL!,
  },
})
