/**
 * One-shot schema probe. Usage:
 *   WCL_CLIENT_ID=xxx WCL_CLIENT_SECRET=yyy pnpm --filter @wcl/api probe <reportCode>
 * Prints fight list, one raw combatantinfo event, and a gameData item lookup,
 * so the shapes assumed in wcl.ts can be verified against the live API.
 */
import { fetchCombatantInfo, fetchItemMeta, fetchRawReport, fetchToken } from "../../web/src/lib/wcl/wcl";

const code = process.argv[2];
const { WCL_CLIENT_ID, WCL_CLIENT_SECRET } = process.env;
if (!code || !WCL_CLIENT_ID || !WCL_CLIENT_SECRET) {
  console.error("usage: WCL_CLIENT_ID=… WCL_CLIENT_SECRET=… pnpm --filter @wcl/api probe <reportCode>");
  process.exit(1);
}

const token = (await fetchToken(WCL_CLIENT_ID, WCL_CLIENT_SECRET)).accessToken;
const report = await fetchRawReport(code, token);
console.log("zone:", report.zone?.name, "| fights:", report.fights.length);

const bossIds = report.fights.filter((f) => f.encounterID !== 0).map((f) => f.id);
const combatants = await fetchCombatantInfo(code, token, bossIds.slice(0, 1));
console.log(`combatantinfo events for fight ${bossIds[0]}: ${combatants.length}`);
console.dir(combatants[0], { depth: 4 });

const firstItem = combatants[0]?.gear.find((g) => g.id !== 0);
if (firstItem) {
  console.log("item meta:", await fetchItemMeta([firstItem.id], token));
}
