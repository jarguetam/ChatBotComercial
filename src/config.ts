import { MysqlAdapter } from "@builderbot/database-mysql";
import dotenv from "dotenv";

dotenv.config();

export const config = {
  host: process.env.MYSQL_HOST || "localhost",
  port: parseInt(process.env.MYSQL_PORT || "3306"),
  user: process.env.MYSQL_USER || "root",
  database: process.env.MYSQL_DATABASE || "bot",
  password: process.env.MYSQL_PASSWORD || "",
  reconnect: true,
  connectTimeout: 10000, // 10 segundos
  acquireTimeout: 10000, // 10 segundos
  connectionLimit: 10, // Limitar número de conexiones
  waitForConnections: true, 
}; 