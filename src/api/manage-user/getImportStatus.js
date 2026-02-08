const importExcelQueue = require("../../queues/importExcelQueue");

const getImportStatus = async (req, res) => {
  const { jobId } = req.params;

  const job = await importExcelQueue.getJob(jobId);
  if (!job) return res.status(404).json({ msg: "Job tidak ditemukan" });

  const state = await job.getState();
  const result = job.returnvalue;

  return res.json({ jobId, state, result });
};

module.exports = getImportStatus;
