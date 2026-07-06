import betterSQL from "better-sqlite3";
const db= new betterSQL("./game.db");
db.pragma('journal_mode = WAL');


class GameEngine {

}