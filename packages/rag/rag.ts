import { QdrantClient } from "@qdrant/js-client-rest";
import { OllamaEmbeddings } from "@langchain/ollama";
import {join} from "node:path"
import pLimit from "p-limit";
import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { MarkdownTextSplitter } from "@langchain/textsplitters";
const __dirname = new URL('.', import.meta.url).pathname;

const qdrant = new QdrantClient({ url: "http://localhost:6333" });
const COLLECTION_NAME = "dnd_campaign_notes";

const embeddings = new OllamaEmbeddings({
  model: "nomic-embed-text",
  baseUrl: "http://localhost:11434",
});

// AYARLAR
const CONCURRENCY_LIMIT = 8; // Aynı anda kaç metnin embedding'i üretilecek (Sistem yüküne göre artırıp azaltabilirsiniz)
const BATCH_SIZE = 100;       // Qdrant'a tek seferde gönderilecek maksimum point sayısı

async function getAllCampaigns() {
  // Implementation for fetching all campaigns
  const rootDir = "campaigns";
  const campaigns = readdirSync(join(__dirname, "../..", rootDir), { withFileTypes: true })
    .map((dirent) => dirent.name);
    console.log(`Toplam ${campaigns.length} kampanya bulundu:`, campaigns);
  return campaigns;
}
async function main() {
  console.time("Toplam Süre");
  const campaigns = await getAllCampaigns();
  if (campaigns.length === 0) {
    console.log("Kampanya bulunamadı. Lütfen 'campaigns' klasörünü kontrol edin.");
    return;
  }
  const markdownText = await readFile(join(__dirname, "../../campaigns", campaigns[0]), "utf-8");
  const splitter = new MarkdownTextSplitter({
    chunkSize: 768,
    chunkOverlap: 256,
  });
const docs = [{ pageContent: markdownText, metadata: { source: campaigns[0] } }];
const chunks = await splitter.splitDocuments(docs);
  console.log(`${chunks.length} adet metin parçası optimize ediliyor...`);

  // Qdrant Collection Hazırlığı
  const collections = await qdrant.getCollections();
  if (!collections.collections.some(c => c.name === COLLECTION_NAME)) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: { size: 768, distance: "Cosine" },
    });
  }

  // Eşzamanlılık limitleyici oluşturuyoruz
  const limit = pLimit(CONCURRENCY_LIMIT);
  let processedCount = 0;
  let batchPoints: any[] = [];

  // Her bir chunk için embedding oluşturma görevini havuza tanımla
  const tasks = chunks.map((chunk, index) => {
    return limit(async () => {
      try {
        // Asenkron embedding üretimi lokal GPU/CPU üzerinde paralel tetiklenir
        const vector = await embeddings.embedQuery(chunk.pageContent);
        
        processedCount++;
        if (processedCount % 50 === 0 || processedCount === chunks.length) {
          console.log(`Embedding üretildi: ${processedCount}/${chunks.length}`);
        }

        return {
          id: index + 1,
          vector: vector,
          payload: {
            text: chunk.pageContent,
            metadata: chunk.metadata,
          },
        };
      } catch (err) {
        console.error(`Chunk ${index} işlenirken hata oluştu:`, err);
        return null;
      }
    });
  });

  // Tüm embedding isteklerini paralel olarak başlat ve tamamlanmasını bekle
  console.log("Paralel embedding üretimi başlatıldı...");
  const allPoints = (await Promise.all(tasks)).filter(p => p !== null);

  // Qdrant'a toplu (Batch) yükleme aşaması
  console.log("Qdrant'a batch yüklemeleri yapılıyor...");
  for (let i = 0; i < allPoints.length; i += BATCH_SIZE) {
    const batch = allPoints.slice(i, i + BATCH_SIZE);
    await qdrant.upsert(COLLECTION_NAME, {
      wait: true,
      points: batch,
    });
    console.log(`Qdrant Veri Gönderimi: ${Math.min(i + BATCH_SIZE, allPoints.length)}/${allPoints.length} tamamlandı.`);
  }

  console.timeEnd("Toplam Süre");
  console.log("Tüm kampanya başarıyla Qdrant'a uçuruldu! 🚀");
}

main().catch(console.error);