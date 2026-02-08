const uploadFile = async (req, res, next) => {
  try {
    res.status(200).json({
      uploaded: 1,
      fileName: req.file.filename,
      url: `${process.env.BASE_URL}/${req.file.path}`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadFile,
};
