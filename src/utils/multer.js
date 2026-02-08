const multer = require("multer");

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
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/png" ||
      file.mimetype === "image/jpg" ||
      file.mimetype === "application/pdf" ||
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      cb(null, true);
    } else {
      cb(
        {
          message:
            "Unsupported file format (only .png, .jpg, .jpeg, .pdf allowed)",
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
  }).array("files");
};

// **New**: Upload multiple fields with different names
const uploadFields = (path) => {
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
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/png" ||
      file.mimetype === "image/jpg" ||
      file.mimetype === "application/pdf" ||
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      cb(null, true);
    } else {
      cb(
        {
          message:
            "Unsupported file format (only .png, .jpg, .jpeg, .pdf allowed)",
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
  }).fields([
    { name: "banner", maxCount: 1 },
    { name: "pdf", maxCount: 1 },
  ]);
};

module.exports = {
  upload,
  multiple,
  uploadFields, // export fungsi baru ini
};
