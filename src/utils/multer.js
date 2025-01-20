const multer = require('multer');

const upload = (path) => {
  const storage = multer.diskStorage({
    destination(req, file, cb) {
      cb(null, `public/uploads/${path}`);
    },
    filename(req, file, cb) {
      cb(null, `${Math.floor(Math.random() * 99999999)}-${file.originalname}`);
    },
  });
  const fileFilter = (req, file, cb) => {
    if (
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/jpg' ||
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      cb(null, true);
    } else {
      cb(
        {
          message:
            'Unsupported file format (only .png, .jpg and .jpeg format allowed)',
        },
        false
      );
    }
  };

  return multer({
    storage,
    limits: {
      fileSize: 1000000000,
    },
    fileFilter,
  });
};

const multiple = (path) => {
  const storage = multer.diskStorage({
    destination(req, file, cb) {
      cb(null, `public/uploads/${path}`);
    },
    filename(req, file, cb) {
      cb(null, `${Math.floor(Math.random() * 99999999)}-${file.originalname}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    cb(null, true);
  };

  return multer({
    storage,
    limits: {
      fileSize: 1000000000,
    },
    fileFilter,
  }).array('files');
};

module.exports = {
  upload,
  multiple,
};
