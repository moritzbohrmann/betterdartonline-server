const config = require("./config.json");
const sql = require("mysql2");

const db = sql.createPool(config).promise();

module.exports = db;
