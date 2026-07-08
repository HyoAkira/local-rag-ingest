import { readFileSync, writeFileSync } from "node:fs";

/**
 * Alt listede eşleşen aksiyonların tam detaylarını filtreler.
 * @param {Object} mainActionsData - actions.json içeriği
 * @param {Object} sublistData - actions-sublist.json içeriği
 * @returns {Array} Filtrelenmiş aksiyon detayları listesi
 */
function getSublistDetailedActions(mainActionsData, sublistData) {
  const allActions = mainActionsData.action;
  const sublistItems = sublistData.items;

  // 1. Alt listedeki 'h' değerlerini kolayca aramak için bir Set (küme) haline getirelim
  // "activate%20an%20item_dmg" -> "activate an item_dmg" olarak decode edilir.
  const targetKeys = new Set(
    sublistItems.map(item => decodeURIComponent(item.h).toLowerCase())
  );

  // 2. Ana aksiyonlar listesini filtreleyelim
  const matchedActions = allActions.filter(action => {
    // Ana dosyadaki aksiyon adı ve kaynağı ile aranacak anahtarı oluşturuyoruz
    const actionKey = `${action.name.toLowerCase()}_${action.source.toLowerCase()}`;
    
    // Eğer bu anahtar alt listede varsa, bu aksiyonu dahil et
    return targetKeys.has(actionKey);
  });

  return matchedActions;
}
const mainActionsData = JSON.parse(readFileSync("../data/actions.json", "utf-8"));
const sublist = JSON.parse(readFileSync("../data/actions-sublist.json", "utf-8"));
const matchedActions = getSublistDetailedActions(mainActionsData, sublist);
writeFileSync("../data/actions-sublist-detailed.json", JSON.stringify(matchedActions, null, 2), "utf-8");