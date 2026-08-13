import { createAuth } from "@/lib/auth";
import { getSql } from "@/lib/db/client";

async function seed() {
  const password = process.env.DEVELOPMENT_SEED_PASSWORD;
  if (!password) throw new Error("Set DEVELOPMENT_SEED_PASSWORD before running the local-only seed.");

  const developmentSeedAuth = createAuth(false);
  for (const user of [{ name: "Cuenta de prueba A", email: "trainer-a@example.test" }, { name: "Cuenta de prueba B", email: "trainer-b@example.test" }]) {
    await developmentSeedAuth.api.signUpEmail({ body: { ...user, password } }).catch((error: { body?: { code?: string } }) => {
      if (error.body?.code !== "USER_ALREADY_EXISTS") throw error;
    });
  }
  await getSql().end();
}

void seed().catch(async (error) => {
  await getSql().end();
  console.error(error);
  process.exitCode = 1;
});
