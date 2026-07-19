import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "@prisma/client";
import { cache } from "react";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function getLocalPrisma() {
  const client = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}

export const getPrisma = cache(() => {
  if (process.env.NODE_ENV === "production") {
    try {
      const { env } = getCloudflareContext();
      if (env.DB) {
        return new PrismaClient({ adapter: new PrismaD1(env.DB) });
      }
    } catch {
      // Next.js build and non-Workers production runs use the local SQLite client.
    }
  }

  return getLocalPrisma();
});

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrisma();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  }
});
