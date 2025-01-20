const { default: axios } = require('axios');
const crypto = require('crypto');
const Joi = require('joi');
const moment = require('moment');
const database = require('#database');
const { generateUniqueINV, filterToJson, returnPagination } = require('#utils');
const { BadRequestError } = require('#errors');

const privateKey = process.env.TRIPAY_PRIVATE_KEY;
const merchantCode = process.env.TRIPAY_MERCHANT_CODE;

const get = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      sortBy: Joi.string(),
      descending: Joi.boolean(),
      filters: Joi.object(),
    });

    const validate = await schema.validateAsync(req.query);

    const take = validate.take ? { take: validate.take } : {};

    const result = await database.$transaction([
      database.pembelian.findMany({
        ...take,
        skip: validate.skip,
        orderBy: {
          [validate.sortBy]: validate.descending ? 'desc' : 'asc',
        },
        where: {
          userId: req?.user?.id,
          ...filterToJson(validate),
        },
      }),
      database.pembelian.count({
        where: {
          userId: req?.user?.id,
          ...filterToJson(validate),
        },
      }),
    ]);

    return returnPagination(req, res, result);
  } catch (error) {
    next(error);
  }
};

const getFeeMerchant = async (req, res, next) => {
  try {
    const { amount, code } = req.query;

    const result = await axios.get(
      `${process.env.TRIPAY_LINK}/merchant/fee-calculator?amount=${amount}&code=${code}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TRIPAY_API_KEY}`,
        },
      }
    );
    res.json(result.data);
  } catch (error) {
    next(error);
  }
};

const getMerchantList = async (req, res, next) => {
  try {
    const result = await axios.get(
      `${process.env.TRIPAY_LINK}/merchant/payment-channel`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TRIPAY_API_KEY}`,
        },
      }
    );
    res.json(result.data);
  } catch (error) {
    next(error);
  }
};
const createPayment = async (req, res, next) => {
  try {
    const schema = Joi.object({
      paketPembelianId: Joi.number().required(),
      code: Joi.string().required(),
      discountCode: Joi.string().allow(''),
      voucher: Joi.string(),
      requirement: Joi.string().allow(''),
    });

    const validate = await schema.validateAsync(req.body, {
      stripUnknown: true,
    });

    const checkingPaket = await database.paketPembelian.findUnique({
      where: {
        id: validate.paketPembelianId,
      },
    });

    if (!checkingPaket)
      throw new BadRequestError('Paket pembelian tidak ditemukan');

    let { harga } = checkingPaket;
    const discount = {};

    const checkPembelian = await database.pembelian.findMany({
      where: {
        userId: req?.user?.id,
        status: 'PAID',
      },
    });

    const checkActiveAlumniVoucher = await database.voucher.findFirst({
      where: {
        tipe: 'ALUMNI',
        status: 'AKTIF',
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (checkPembelian.length > 0 && checkActiveAlumniVoucher) {
      if (checkActiveAlumniVoucher.tipePotongan === 'PERSEN') {
        harga -= (harga * checkActiveAlumniVoucher.value) / 100;
        discount.voucherAlumniValue =
          (harga * checkActiveAlumniVoucher.value) / 100;
      }

      if (checkActiveAlumniVoucher.tipePotongan === 'HARGA') {
        harga -= checkActiveAlumniVoucher.value;
        discount.voucherAlumniValue = checkActiveAlumniVoucher.value;
      }
    }

    if (validate.discountCode) {
      const checkingDiscount = await database.voucher.findFirst({
        where: {
          kode: validate.discountCode,
          deletedAt: null,
        },
      });

      if (!checkingDiscount)
        throw new BadRequestError('Kode diskon tidak ditemukan');

      const checkSpesificProduct = await database.voucherProduct.findMany({
        where: {
          voucherId: checkingDiscount.id,
        },
      });

      if (checkSpesificProduct.length > 0) {
        const checkProduct = checkSpesificProduct.find(
          (e) => e.paketId === validate.paketPembelianId
        );
        if (!checkProduct)
          throw new BadRequestError(
            'Voucher tidak bisa digunakan untuk produk ini'
          );
      }

      if (checkingDiscount.tipePotongan === 'PERSEN') {
        harga -= (harga * checkingDiscount.value) / 100;
        discount.voucherCode = checkingDiscount.kode;
        discount.voucherValue = (harga * checkingDiscount.value) / 100;
      }

      if (checkingDiscount.tipePotongan === 'HARGA') {
        harga -= checkingDiscount.value;
        discount.voucherCode = checkingDiscount.kode;
        discount.voucherValue = checkingDiscount.value;
      }
    }

    if (harga > 0) {
      const result = await database.pembelian.create({
        data: {
          user: { connect: { id: req.user?.id } }, // Assuming you want to associate the purchase with a user
          paketPembelian: { connect: { id: validate.paketPembelianId } },
          status: 'UNPAID',
          requirement: validate.requirement,
          duration: checkingPaket.durasi,
          expiredAt: checkingPaket.durasi
            ? moment().add(checkingPaket.durasi * 31, 'days')
            : null,
          namaPaket: checkingPaket.nama,
          amount: harga,

          invoice: generateUniqueINV(),
          paymentMethod: validate.code,
          ...discount,
        },
      });

      const signature = crypto
        .createHmac('sha256', privateKey)
        .update(merchantCode + result.invoice + harga)
        .digest('hex');

      const payment = await axios.post(
        `${process.env.TRIPAY_LINK}/transaction/create`,
        {
          method: validate.code,
          merchant_ref: result.invoice,
          signature,
          amount: harga,
          customer_name: req.user?.name || 'Viracun',
          customer_email: req.user?.email || 'Viracun@no-reply.com',
          customer_phone: `0${req.user?.noWA}`,
          return_url: `${process.env.URL_CLIENT}/paket-pembelian/riwayat`,
          order_items: [
            {
              name: `Pembelian paket ${checkingPaket.nama}`,
              price: harga,
              quantity: 1,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.TRIPAY_API_KEY}`,
          },
        }
      );

      await database.notificationUser.create({
        data: {
          user: { connect: { id: req.user?.id } },
          title: 'Menunggu Pembayaran',
          keterangan: `Anda telah membeli paket ${checkingPaket.nama}, segera lakukan pembayaran untuk dapat mengakses paket tersebut`,
          type: 'SYSTEM',
          status: 'PAYMENT_PENDING',
          url: payment.data.data.checkout_url,
        },
      });

      await database.pembelian.update({
        where: {
          id: result.id,
        },
        data: {
          paymentUrl: payment.data.data.checkout_url,
        },
      });

      res.status(200).json({
        data: payment.data.data,
        msg: 'Berhasil membuat pembayaran',
      });
    } else {
      const result = await database.pembelian.create({
        data: {
          user: { connect: { id: req.user?.id } }, // Assuming you want to associate the purchase with a user
          paketPembelian: { connect: { id: validate.paketPembelianId } },
          status: 'PAID',
          requirement: validate.requirement,
          duration: checkingPaket.durasi,
          expiredAt: checkingPaket.durasi
            ? moment()
                .add(checkingPaket.durasi * 31, 'days')
                .toDate()
            : null,
          namaPaket: checkingPaket.nama,
          amount: 0,
          invoice: generateUniqueINV(),
          paymentMethod: validate.code,
          paidAt: new Date(),
          ...discount,
        },
      });
      await database.notificationUser.create({
        data: {
          user: { connect: { id: req.user?.id } },
          title: 'Pembelian Berhasil',
          keterangan: `Anda telah membeli paket ${checkingPaket.nama}, silahkan cek paket anda di halaman riwayat pembelian`,
          url: '/paket-pembelian/riwayat',
          type: 'SYSTEM',
          status: 'PAYMENT_SUCCESS',
        },
      });

      res.status(200).json({
        data: result,
        msg: 'Berhasil membuat pembayaran',
      });
    }
  } catch (error) {
    next(error);
  }
};

const callbackPayment = async (req, res, next) => {
  try {
    const json = req.body;

    const jsonString = JSON.stringify(json);

    const signature = crypto
      .createHmac('sha256', privateKey)
      .update(jsonString)
      .digest('hex');
    const receivedSignature = req.headers['x-callback-signature'];

    if (signature !== receivedSignature) {
      return res.status(400).json({
        message: 'Permintaaan tidak valid',
      });
    }

    const checkPembelian = await database.pembelian.findUnique({
      where: {
        invoice: json.merchant_ref,
        status: 'UNPAID',
      },
    });

    if (!checkPembelian) {
      return res.status(200).json({
        data: checkPembelian,
        msg: 'Berhasil mengubah status pembelian',
      });
    }

    const payload = {};

    if (json.status === 'PAID') {
      payload.status = 'PAID';
      payload.paidAt = new Date();
      await database.notificationUser.create({
        data: {
          user: { connect: { id: checkPembelian.userId } },
          title: 'Pembelian Berhasil',
          keterangan: `Anda telah membeli paket ${checkPembelian.namaPaket}, silahkan cek paket anda di halaman riwayat pembelian`,
          url: '/paket-pembelian/riwayat',
          type: 'SYSTEM',
          status: 'PAYMENT_SUCCESS',
        },
      });
    } else {
      payload.status = json.status;
      payload.paidAt = null;
      await database.notificationUser.create({
        data: {
          user: { connect: { id: checkPembelian.userId } },
          title: 'Pembelian Gagal',
          keterangan: `Pembelian anda untuk paket ${checkPembelian.namaPaket} gagal, silahkan alasannya di halaman riwayat pembelian`,
          url: '/paket-pembelian/riwayat',
          type: 'SYSTEM',
          status: 'PAYMENT_FAILED',
        },
      });
    }

    const result = await database.pembelian.update({
      where: {
        invoice: json.merchant_ref,
      },
      data: {
        ...payload,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengubah status pembelian',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMerchantList,
  getFeeMerchant,
  createPayment,
  callbackPayment,
  get,
};
