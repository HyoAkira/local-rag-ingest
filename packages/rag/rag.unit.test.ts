import { readdirSync } from "node:fs";
import { join } from "node:path";
const __dirname = new URL('.', import.meta.url).pathname;
async function getAllCampaigns() {
  // Implementation for fetching all campaigns
  const rootDir = "campaigns";
  const campaigns = readdirSync(join(__dirname, "../..", rootDir), { withFileTypes: true })
    .map((dirent) => dirent.name);
    console.log(`Toplam ${campaigns.length} kampanya bulundu:`, campaigns);
  return campaigns;
}

getAllCampaigns().then(campaigns => {
  console.log("Kampanyalar:", campaigns);
}).catch(err => {
  console.error("Kampanyalar alınırken hata oluştu:", err);
});