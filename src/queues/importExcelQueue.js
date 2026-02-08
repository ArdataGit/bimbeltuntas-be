const { Queue } = require("bullmq");

const importExcelQueue = new Queue("importExcel", {
  connection: {
    host: "127.0.0.1",
    port: 6379
  }
});

module.exports = importExcelQueue;
