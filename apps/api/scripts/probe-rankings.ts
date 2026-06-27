/**
 * Dump the raw report `rankings` JSON so we can see which per-character field
 * holds the DPS/HPS metric value (total vs amount vs …).
 * Usage:
 *   WCL_CLIENT_ID=xxx WCL_CLIENT_SECRET=yyy pnpm --filter @wcl/api exec tsx scripts/probe-rankings.ts <reportCode>
 */
import { fetchRankings, fetchToken } from "../src/wcl";

const code = process.argv[2];
const { WCL_CLIENT_ID, WCL_CLIENT_SECRET } = process.env;
if (!code || !WCL_CLIENT_ID || !WCL_CLIENT_SECRET) {
  console.error("usage: WCL_CLIENT_ID=… WCL_CLIENT_SECRET=… pnpm --filter @wcl/api exec tsx scripts/probe-rankings.ts <reportCode>");
  process.exit(1);
}

const token = (await fetchToken(WCL_CLIENT_ID, WCL_CLIENT_SECRET)).accessToken;
const entries = await fetchRankings(code, token);
console.log("ranked bosses:", entries.length);

const first = entries[0];
if (!first) {
  console.log("no rankings data");
} else {
  console.log("encounter:", first.encounter?.name, "fightID:", first.fightID);
  const dps = first.roles?.dps?.characters?.[0];
  const hps = first.roles?.healers?.characters?.[0];
  console.log("\n--- one DPS character (all keys) ---");
  console.dir(dps, { depth: 4 });
  console.log("dps keys:", dps ? Object.keys(dps) : "none");
  console.log("\n--- one HEALER character (all keys) ---");
  console.dir(hps, { depth: 4 });
}
