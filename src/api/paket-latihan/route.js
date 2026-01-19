const express = require("express");

const router = express.Router();

const {
  get,
  find,
  getPenjualan,
  insert,
  update,
  remove,
  finishPayment,
} = require("./controller");
const { uploadFields } = require("../../utils/multer");

function uploadFieldsMiddleware(path) {
  return (req, res, next) => {
    const upload = uploadFields(path);
    upload(req, res, (err) => {
      if (err) {
        // kalau error multer, kirim response error
        return res.status(400).json({ message: err.message || "Upload error" });
      }
      next();
    });
  };
}
router.get("/get", get);
router.get("/penjualan", getPenjualan);
router.get("/find/:id", find);
router.post("/insert", uploadFieldsMiddleware("banner-latihan"), insert);
router.patch("/update/:id", uploadFieldsMiddleware("banner-latihan"), update);
router.delete("/remove/:id", remove);

router.post("/penjualan/finish-payment", finishPayment);
module.exports = router;
