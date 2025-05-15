// import { MysqlAdapter } from "@builderbot/database-mysql";
// import { config } from "../config";

// export const database = new MysqlAdapter(config); 


import { MemoryDB as Database } from '@builderbot/bot'

export const database = new Database()