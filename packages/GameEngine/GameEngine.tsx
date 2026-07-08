import betterSQL from "better-sqlite3";
import { readFileSync, writeFileSync } from "node:fs";
const db= new betterSQL("./game.db");
db.pragma('journal_mode = WAL');

// class GameEngine {

// }