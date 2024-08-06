const moment = require('moment');
const momentTimezone = require('moment-timezone');
const _ = require('lodash');
const md5 = require('md5');
const PayME = require('../../paymeLib');
const Mail = require('../../utils/sendMail');
const asyncForEach = require('await-async-foreach');

const fs = require('fs');
const path = require('path');

const Room = require('../Room/room.model');
const Booking = require('./booking.model');

const toDate = (date) => {
  let parts = _.split(date, '-');
  let ngay = parseInt(parts[0], 10);
  let thang = parseInt(parts[1], 10) - 1; // Trừ 1 vì tháng trong JavaScript bắt đầu từ 0
  let nam = parseInt(parts[2], 10);

  // Tạo đối tượng Date từ các phần tử đã tách
  let ngayDate = new Date(nam, thang, ngay);
  return ngayDate;
};

const processInput = (bookingList) => {
  _.forEach(bookingList, (booking, i) => {
      if (booking.slots.length === 4) {
          booking.slots = {
            index: 'day',
            from: booking.slots[0].from,
            to: booking.slots[booking.slots.length - 1].to,
          };
          return;
      }
      const timeNeed = 4 - booking.slots.length;
      const nextBooking = bookingList[i + 1];
      if (nextBooking && nextBooking.slots.length >= timeNeed) {
          booking.slots = {
            index: 'day',
            from: booking.slots[0].from,
            to: nextBooking.slots[timeNeed - 1].to,
            name: 'day'
          }
          nextBooking.slots = nextBooking.slots.slice(timeNeed);
          return;
      }
      // booking.slots = {
      //   index: booking.slots,
      //   from: booking[0].from,
      //   to: booking[booking.slots.length - 1].to,
      //   name: 'day'
      // }
  })
  return bookingList;
}

const calDiffDate = (date1, date2) => {
  // Ngày đầu tiên
  date1 = moment(date1).startOf('day');

  // Ngày thứ hai
  date2 = moment(date2).endOf('day');

  const numberOfDays = date2.diff(date1, 'days');

  return numberOfDays;
};

const createV2 = async (req, res, next) => {
  try {
    console.log(`[INFO] booking V2 => payload: ${JSON.stringify(req.body)}`);
    let {
      roomId,
      contactName,
      contactEmail,
      contactPhone,
      contactChannel,
      totalCustomer,
      bookingList = [],
      isCalAmountOnly = false,
      identifyCardNumber = [],
      note
    } = req.body;

    const room = await Room.findOne({ id: roomId });
    if (!room) {
      throw new Error('Room not found');
    }

    const bookingTimeSlots = room.bookingTimeSlots;
    const customPrice = room.customPrice;

    let isValid = true;
    const bookingData = [];

    const totalCell = _.sumBy(bookingList, (booking) => booking.slots.length);

    await asyncForEach(bookingList, async ({ date, slots }, dateIndex) => {
      date = toDate(date);

      let { from: customPriceFrom, to: customPriceTo } = _.get(
        customPrice,
        'date',
        {}
      );

      let priceList = room.priceList;

      if (
        moment(date).isSameOrAfter(moment(customPriceFrom)) &&
        moment(date).isSameOrBefore(moment(customPriceTo))
      ) {
        const customPriceList = _.get(customPrice, 'priceList', {});
        priceList = customPriceList;
      }

      const startOfDate = momentTimezone(date)
        .tz('Asia/Ho_Chi_Minh')
        .startOf('day')
        .toDate();
      const endOfDate = momentTimezone(date)
        .tz('Asia/Ho_Chi_Minh')
        .endOf('day')
        .toDate();

      const scaningFrom = startOfDate;
      const scaningTo = endOfDate;

      const bookingTimeSlotsToCheck = _.filter(
        bookingTimeSlots,
        (bookingTimeSlot, index) => _.includes(slots, index)
      );

      const scaningQuery = {
        roomId,
        $or: [
          {
            from: {
              $gte: scaningFrom,
              $lte: scaningTo
            }
          },
          {
            to: {
              $gte: scaningFrom,
              $lte: scaningTo
            }
          },
          {
            from: {
              $lte: scaningFrom
            },
            to: {
              $gte: scaningTo
            }
          }
        ],
        status: { $ne: 'CANCELLED' }
      };

      let bookingByDay = [];

      if (!isCalAmountOnly) {
        bookingByDay = await Booking.find(scaningQuery);
      }

      _.forEach(bookingTimeSlotsToCheck, (bookingSlot, slotIndex) => {
        let { name, startTime, endTime } = bookingSlot;
        // startTime and endTime is in UTC+7
        const startTimeHour = _.toNumber(_.split(startTime, ':')[0]);
        const startTimeMinute = _.toNumber(_.split(startTime, ':')[1]);
        const endTimeHour = _.toNumber(_.split(endTime, ':')[0]);
        const endTimeMinute = _.toNumber(_.split(endTime, ':')[1]);
        // create date UTC
        const from = momentTimezone(date)
          .tz('Asia/Ho_Chi_Minh')
          .set({
            hour: startTimeHour,
            minute: startTimeMinute,
            second: 0,
            millisecond: 0
          })
          .toDate();
        let to = momentTimezone(date)
          .tz('Asia/Ho_Chi_Minh')
          .set({
            hour: endTimeHour,
            minute: endTimeMinute,
            second: 0,
            millisecond: 0
          })
          .toDate();
        if (name === 'overNight') {
          to = momentTimezone(date)
            .tz('Asia/Ho_Chi_Minh')
            .add(1, 'days')
            .set({
              hour: endTimeHour,
              minute: endTimeMinute,
              second: 0,
              millisecond: 0
            })
            .toDate();
        }

        const existsBooking = _.find(bookingByDay, (booking) => {
          let exist;
          const bookingFrom = moment(booking.from);
          const bookingTo = moment(booking.to);
          if (
            bookingFrom.isSameOrBefore(from) &&
            bookingTo.isSameOrAfter(from)
          ) {
            exist = booking;
          }
          if (bookingFrom.isSameOrBefore(to) && bookingTo.isSameOrAfter(to)) {
            exist = booking;
          }
          if (bookingFrom.isAfter(from) && bookingTo.isBefore(to)) {
            exist = booking;
          }
          if (exist) {
            isValid = false;
            const now = moment().toDate();
            // check booking diff 5 minutes from now
            const isDiff5Minutes = moment(exist.createdAt)
              .add(5, 'minutes')
              .isAfter(now);

            if (
              (exist.status === 'PENDING' && isDiff5Minutes) ||
              exist.status === 'PAID'
            ) {
              return true;
            }
            // Booking.deleteOne({ bookingId: exist.bookingId }).exec();
            Booking.updateOne({ bookingId: exist.bookingId }, { status: 'CANCELLED' }).exec();
          }
          return false;
        });

        bookingList[dateIndex].slots[slotIndex] = {
          index: slotIndex,
          from,
          to,
          name
        };

        // if (!existsBooking) {
        //   if (slots.length === 4) {
        //     name = 'day';
        //     bookingData.push({
        //       from,
        //       to,
        //       name,
        //       price: priceList[name]
        //     });
        //     return;
        //   }
        //   bookingData.push({
        //     from,
        //     to,
        //     name,
        //     price: priceList[name]
        //   });
        // }
      });
    });

    if (!isValid) {
      throw new Error('Thông tin slot booking không hợp lệ');
    }

    // gom booking theo ngày, cứ 4 khung giờ thì gom lại thành 1 ngày
    bookingList = processInput(bookingList);
    console.log('\n - createV2 - bookingList:', JSON.stringify(bookingList));

    // const comboLeConlai = bookingList[bookingList.length - 1]; // combo lẻ là array cuối cùng của bookingList
    const comboNgay = _.filter(bookingList, (booking) => booking.slots?.index === 'day')

    const comboLeConlai = _.filter(bookingList, (booking) => booking.slots?.index !== 'day')
    const totalComboLeConlai = _.sumBy(comboLeConlai, (booking) => booking.slots.length);
    console.log('\n - createV2 - totalComboLeConlai:', totalComboLeConlai);
    // Khi khách chọn số khung > 4 
    // Khi combo lẻ còn lại === 3 thì gom 3 combo đó lại thành 1 ngày
    if (totalComboLeConlai === 3) {
      _.forEach(comboLeConlai, (bookingByDay, dateIndex) => {
        _.forEach(bookingByDay.slots, (slot, slotIndex) => {
          if (dateIndex === 0 && slotIndex === 0) {
            comboLeConlai[dateIndex].slots[slotIndex].name = 'day';
          } else {
            comboLeConlai[dateIndex].slots[slotIndex].name = 'free';
          }
        });
      });
      bookingList = [
        ..._.slice(bookingList, 0, comboNgay.length), // giữ lại các combo ngày
        ...comboLeConlai // replace giá các combo lẻ còn lại
      ]
    }
    console.log('\n - createV2 - FINAL bookingList:', JSON.stringify(bookingList));
    
    let isApplyDiscount = false;

    // Chỉ 2 combo liền nhau thì mới áp dụng giảm giá 50k
    if (totalCell === 2) isApplyDiscount = true;


    _.forEach(bookingList, ({ date, slots }) => {
      date = toDate(date);

      let { from: customPriceFrom, to: customPriceTo } = _.get(
        customPrice,
        'date',
        {}
      );

      let priceList = room.priceList;

      if (
        moment(date).isSameOrAfter(moment(customPriceFrom)) &&
        moment(date).isSameOrBefore(moment(customPriceTo))
      ) {
        const customPriceList = _.get(customPrice, 'priceList', {});
        priceList = customPriceList;
      }
      let item;
      if (_.get(slots, 'index') === 'day') {
        item = {
          from: slots.from,
          to: slots.to,
          name: 'day',
          price: priceList['day']
        }
        bookingData.push(item);
      } else {
        _.forEach(slots, (slot) => {
          item = {
            from: slot.from,
            to: slot.to,
            name: slot.name,
            price: _.get(priceList, slot.name, 0)
          }
          bookingData.push(item);
        });
      }
    })

    console.log(
      `\n[INFO] booking V2 => bookingData: ${JSON.stringify(bookingData)}`
    );


    const coverBookingFrom = bookingData[0].from;
    const coverBookingTo = bookingData[bookingData.length - 1].to;

    // calculate price

    let price = 0;

    let compoCount = bookingData.length;

    const extraCustomerPrice = 50000;

    const extraCustomer = totalCustomer - 2;
    const extraCustomerTotal =
      extraCustomer > 0 ? extraCustomer * extraCustomerPrice : 0;

    _.forEach(bookingData, (booking) => {
      price = price + booking.price;
    });

    price = price + extraCustomerTotal;

    const discountCompo = room.priceList.compoDiscount;

    let discountPrice = isApplyDiscount ? (discountCompo * (compoCount - 1)) : 0;

    price = price - discountPrice;

    if (isCalAmountOnly) {
      return res.status(200).json({
        code: 1000,
        message: 'Successfully',
        data: {
          total: price
        }
      });
    }

    let bookingId;
    while (!bookingId) {
      const randomId = _.random(100000, 9999999);
      const existsBooking = await Booking.findOne({ bookingId: randomId });
      if (!existsBooking) {
        bookingId = randomId;
      }
    }
    const booking = await Booking.create({
      bookingId,
      roomId,
      contactName,
      contactEmail,
      contactPhone,
      contactChannel,
      totalCustomer,
      note,
      from: coverBookingFrom,
      to: coverBookingTo,
      type: 'custom',
      total: price,
      identifyCardNumber: _.isArray(identifyCardNumber)
        ? identifyCardNumber
        : [],
      ip: req.clientIp
    });

    const payment = await PayME.createPayment({
      partnerTransaction: booking.bookingId,
      amount: booking.total,
      desc: `Thanh toán cho bookingId: #${booking.bookingId}`,
      payMethod: 'VIETQR',
      expiryTime: 5 * 60,
      ipnUrl: `${process.env.DOMAIN}/booking/ipn`
    });

    if (!payment?.data?.transaction) {
      throw new Error('Create payment failed');
    }

    await Booking.updateOne(
      { bookingId: booking.bookingId },
      {
        supplierTransaction: payment?.data?.transaction,
        supplierResponses: [JSON.stringify(payment)]
      }
    );

    res.status(200).json({
      code: 1000,
      message: 'Successfully booked',
      data: {
        bookingId: booking.bookingId,
        amount: booking.total,
        url: payment?.data?.url,
        qrContent: payment?.data?.qrContent,
        bankInfo: payment?.data?.bankInfoList[0],
        checkInAt: coverBookingFrom,
        checkOutAt: coverBookingTo,
        type: 'custom'
      }
    });
  } catch (error) {
    console.log(`[BOOKING] createV2 => ${error.message}`);
    return res.send({
      code: 1001,
      message: error.message
    });
  }
};

const deleteBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.body;

    await Booking.deleteOne({ bookingId });

    return res.send({
      code: 1000,
      message: 'Successfully'
    });
  } catch (error) {
    console.log(`[BOOKING] deleteBooking => ${error.message}`);
    return res.send({
      code: 1001,
      message: error.message
    });
  }
};
const addNote = async (req, res, next) => {
  try {
    const { bookingId, note } = req.body;

    await Booking.updateOne({ bookingId }, { note })

    return res.send({
      code: 1000,
      message: 'Successfully'
    });
  } catch (error) {
    console.log(`[BOOKING] deleteBooking => ${error.message}`);
    return res.send({
      code: 1001,
      message: error.message
    });
  }
};

const reSendMail = async (req, res, next) => {
  try {
    console.log(`[INFO] reSendMail => payload: ${JSON.stringify(req.body)}`);
    const { bookingId } = req.body;

    const booking = await Booking.findOne({ bookingId, status: 'PAID' });
    if (!booking) {
      return res.send({
        code: 1001,
        message: 'Booking not found'
      })
    }

    const room = await Room.findOne({ id: booking.roomId });
      const roomName = _.toUpper(room.name);

      const templateFile = fs.readFileSync(
        path.resolve(__dirname, '../../EmailTemplate/checkinInstruction.html'),
        'utf8'
      );

      let fromString = momentTimezone(booking.from)
        .tz('Asia/Ho_Chi_Minh')
        .format('DD/MM/YYYY HH:mm');
      const toString = momentTimezone(booking.to)
        .tz('Asia/Ho_Chi_Minh')
        .format('DD/MM/YYYY HH:mm');

      let timeString = `${fromString} - ${toString}`;

      const isTheSameDay = moment(booking.from).isSame(booking.to, 'day');

      if (isTheSameDay) {
        fromString = momentTimezone(booking.from)
          .tz('Asia/Ho_Chi_Minh')
          .format('DD/MM/YYYY');
        const fromHour = momentTimezone(booking.from)
          .tz('Asia/Ho_Chi_Minh')
          .format('HH:mm');
        const toHour = momentTimezone(booking.to)
          .tz('Asia/Ho_Chi_Minh')
          .format('HH:mm');
        timeString = `${fromString} (${fromHour} - ${toHour})`;
      }

      const template = _.template(templateFile);
      const templateData = {
        ...booking.toObject(),
        ...room.toObject(),
        roomName,
        timeString
      };
      const html = template(templateData);

      let subject = `Xác nhận đặt phòng ${roomName} ${timeString}`;

      const sendMailResult = await Mail.sendMail({
        to: booking.contactEmail,
        subject,
        html
      });
      console.log(`[RESEND_MAIL] sendMailResult => ${JSON.stringify(sendMailResult)}`);
      return res.send({
        code: 1000,
        message: 'Resend mail thành công'
      })
  } catch (error) {
    console.log(`[BOOKING] reSendMail => ${error.message}`);
  }
};

module.exports = {
  create: async (req, res, next) => {
    console.log(`[INFO] booking => payload: ${JSON.stringify(req.body)}`);
    let booking;
    try {
      let {
        roomId,
        contactName,
        contactEmail,
        contactPhone,
        contactChannel,
        totalCustomer,
        from,
        to,
        isCalAmountOnly = false,
        identifyCardNumber = []
      } = req.body;

      let type;

      const room = await Room.findOne({ id: roomId });
      if (!room) {
        throw new Error('Room not found');
      }

      const bookingTimeSlots = room.bookingTimeSlots;

      const checkInTime = moment(momentTimezone(from).tz('Asia/Ho_Chi_Minh'));
      const checkOutTime = moment(momentTimezone(to).tz('Asia/Ho_Chi_Minh'));

      const diffInMs = checkOutTime.diff(checkInTime);

      if (checkInTime.isAfter(checkOutTime)) {
        throw new Error('Invalid time (0)');
      }

      const checkInHour = checkInTime.hour();
      const checkOutHour = checkOutTime.hour();
      const checkInDate = checkInTime.date();
      const checkOutDate = checkOutTime.date();

      if (isCalAmountOnly === false) {
        // check exist booking with time
        const existsBooking = await Booking.findOne({
          roomId: roomId,
          $or: [
            {
              from: {
                $gte: from,
                $lte: to
              }
            },
            {
              to: {
                $gte: from,
                $lte: to
              }
            },
            {
              from: {
                $lte: from
              },
              to: {
                $gte: to
              }
            }
          ],
          status: { $ne: 'CANCELED' }
        });

        if (existsBooking) {
          const now = moment().toDate();
          // check booking diff 5 minutes from now
          const isDiff5Minutes = moment(existsBooking.createdAt)
            .add(5, 'minutes')
            .isAfter(now);

          if (
            (existsBooking.status === 'PENDING' && isDiff5Minutes) ||
            existsBooking.status === 'PAID'
          ) {
            throw new Error('Room is not available');
          }
          // delete unpaid booking
          await Booking.deleteOne({ bookingId: existsBooking.bookingId });
        }
      }

      const diffHours = checkOutTime.diff(checkInTime, 'hours');
      const diffDays = calDiffDate(checkInTime, checkOutTime);

      if (diffDays === 0) {
        type = 'threeHours';
        if (diffHours === 5) {
          type = 'fiveHours';
        }
      }
      if (diffDays === 1 && diffHours <= 13) {
        type = 'overNight';
      }
      if (diffHours >= 23) {
        type = 'day';
      }
      if (diffDays >= 7) {
        type = 'week';
      }

      const priceList = room.priceList;
      let price = 0;

      let compoCount = 1;

      const extraCustomerPrice = 50000;
      const extraCustomer = totalCustomer - 2;
      const extraCustomerTotal =
        extraCustomer > 0 ? extraCustomer * extraCustomerPrice : 0;

      // book combo qua đêm + combo 3h
      if (diffDays === 1 && diffHours > 13 && diffHours < 23) {
        const comboOverNightTime = 13 * 60 * 60 * 1000;
        const restTime = diffInMs - comboOverNightTime;
        const restTimeInHours = restTime / (60 * 60 * 1000);

        const threeHoursComboCount = _.floor(restTimeInHours / 3);
        const comboCount = compoCount + threeHoursComboCount;

        const overNightPrice = priceList.overNight;
        const threeHoursPrice = priceList.threeHours;

        price = overNightPrice + threeHoursPrice * threeHoursComboCount;

        price = price + extraCustomerTotal;

        price = price - priceList.compoDiscount * (comboCount - 1);
        type = 'comboOverNightThreeHours';
      } else {
        if (_.includes(['threeHours', 'fiveHours'], type)) {
          if (checkInDate !== checkOutDate) {
            throw new Error('Invalid time (1)');
          }

          const threeHoursBookingTimeSlots = _.filter(bookingTimeSlots, {
            name: 'threeHours'
          });
          const roomStartTime = _.toNumber(
            _.split(threeHoursBookingTimeSlots[0].startTime, ':')[0]
          );
          const roomEndTime = _.toNumber(
            _.split(
              threeHoursBookingTimeSlots[threeHoursBookingTimeSlots.length - 1]
                .endTime,
              ':'
            )[0]
          );

          if (checkInHour < roomStartTime || checkOutHour > roomEndTime) {
            throw new Error('Invalid time (4)');
          }
          if (type === 'threeHours') {
            compoCount = _.ceil(diffHours / 3);
            if (checkInHour === roomStartTime && checkOutHour === roomEndTime) {
              compoCount = threeHoursBookingTimeSlots.length;
            }
          }
        }

        if (type === 'overNight') {
          if (checkOutDate - checkInDate !== 1) {
            throw new Error('Invalid time (5)');
          }
          const overNightBookingTimeSlots = _.filter(bookingTimeSlots, {
            name: 'overNight'
          });
          const roomStartTime = _.toNumber(
            _.split(overNightBookingTimeSlots[0].startTime, ':')[0]
          );
          const roomEndTime = _.toNumber(
            _.split(
              overNightBookingTimeSlots[overNightBookingTimeSlots.length - 1]
                .endTime,
              ':'
            )[0]
          );

          if (checkInHour < roomStartTime || checkOutHour > roomEndTime) {
            throw new Error('Invalid time (overnight)');
          }
        }
        if (type === 'day') {
          compoCount = diffDays;
        }
        if (type === 'week') {
          compoCount = _.ceil(diffDays / 7);
        }

        price = priceList[type];

        price = price * compoCount + extraCustomerTotal;

        const discountCompo = priceList.compoDiscount;

        price = price - discountCompo * (compoCount - 1);
      }

      let bookingId;
      while (!bookingId) {
        const randomId = _.random(100000, 9999999);
        const existsBooking = await Booking.findOne({ bookingId: randomId });
        if (!existsBooking) {
          bookingId = randomId;
        }
      }

      if (isCalAmountOnly) {
        return res.status(200).json({
          code: 1000,
          message: 'Successfully',
          data: {
            total: price
          }
        });
      }

      const createData = {
        bookingId: bookingId,
        roomId,
        contactName,
        contactEmail,
        contactPhone,
        contactChannel,
        totalCustomer,
        from: from,
        to: to,
        type: type,
        total: price,
        identifyCardNumber: _.isArray(identifyCardNumber)
          ? identifyCardNumber
          : []
      };

      booking = await Booking.create(createData);

      const payment = await PayME.createPayment({
        partnerTransaction: booking.bookingId,
        amount: booking.total,
        desc: `Thanh toán cho bookingId: #${booking.bookingId}`,
        payMethod: 'VIETQR',
        expiryTime: 5 * 60,
        ipnUrl: `${process.env.DOMAIN}/booking/ipn`
      });

      if (!payment?.data?.transaction) {
        throw new Error('Create payment failed');
      }

      await Booking.updateOne(
        { bookingId: booking.bookingId },
        {
          supplierTransaction: payment?.data?.transaction,
          supplierResponses: [JSON.stringify(payment)]
        }
      );

      res.status(200).json({
        code: 1000,
        message: 'Successfully booked',
        data: {
          bookingId: booking.bookingId,
          amount: booking.total,
          url: payment?.data?.url,
          qrContent: payment?.data?.qrContent,
          bankInfo: payment?.data?.bankInfoList[0],
          checkInAt: from,
          checkOutAt: to,
          type
        }
      });
    } catch (err) {
      console.log(`[ERROR] booking => ${err.message}`);
      if (booking) {
        await Booking.deleteOne({ bookingId: booking.bookingId });
      }
      res.status(400).json({ code: 1001, message: err.message });
    }
  },
  ipn: async (req, res, next) => {
    try {
      console.log(`[INFO] receive IPN => payload: ${JSON.stringify(req.body)}`);
      const { transaction, partnerTransaction, amount, state } = req.body;

      const payMeXapiValidate = req.headers['x-api-validate'];
      const xAPIValidate = md5(
        `${JSON.stringify(req.body)}${process.env.PAYME_SECRET_KEY}`
      );

      if (payMeXapiValidate !== xAPIValidate) {
        throw new Error('Invalid x-api-validate');
      }

      if (_.includes(['REFUNDED', 'CANCELED_SUCCEEDED'], state)) {
        const booking = await Booking.findOne({
          supplierTransaction: transaction
        });
        if (!booking) {
          throw new Error('Booking not found');
        }

        await Booking.updateOne(
          { bookingId: booking.bookingId },
          {
            status: 'CANCELED',
            $push: {
              supplierResponses: JSON.stringify(req.body)
            }
          }
        );
        return res
          .status(200)
          .json({ code: 1000, message: 'Successfully canceled' });
      }

      const booking = await Booking.findOne({ bookingId: partnerTransaction });
      if (!booking) {
        throw new Error('Booking not found');
      }
      if (booking.total !== amount) {
        throw new Error('Amount not match');
      }
      if (booking.status === 'PAID') {
        throw new Error('Booking already paid');
      }
      if (state === 'SUCCEEDED') {
        await Booking.updateOne(
          { bookingId: partnerTransaction },
          {
            status: 'PAID',
            $push: {
              supplierResponses: JSON.stringify(req.body)
            },
            paymentAt: new Date()
          }
        );
      }

      const room = await Room.findOne({ id: booking.roomId });
      const roomName = _.toUpper(room.name);

      const templateFile = fs.readFileSync(
        path.resolve(__dirname, '../../EmailTemplate/checkinInstruction.html'),
        'utf8'
      );

      let fromString = momentTimezone(booking.from)
        .tz('Asia/Ho_Chi_Minh')
        .format('DD/MM/YYYY HH:mm');
      const toString = momentTimezone(booking.to)
        .tz('Asia/Ho_Chi_Minh')
        .format('DD/MM/YYYY HH:mm');

      let timeString = `${fromString} - ${toString}`;

      const isTheSameDay = moment(booking.from).isSame(booking.to, 'day');

      if (isTheSameDay) {
        fromString = momentTimezone(booking.from)
          .tz('Asia/Ho_Chi_Minh')
          .format('DD/MM/YYYY');
        const fromHour = momentTimezone(booking.from)
          .tz('Asia/Ho_Chi_Minh')
          .format('HH:mm');
        const toHour = momentTimezone(booking.to)
          .tz('Asia/Ho_Chi_Minh')
          .format('HH:mm');
        timeString = `${fromString} (${fromHour} - ${toHour})`;
      }

      const template = _.template(templateFile);
      const templateData = {
        ...booking.toObject(),
        ...room.toObject(),
        roomName,
        timeString
      };
      const html = template(templateData);

      let subject = `Xác nhận đặt phòng ${roomName} ${timeString}`;

      const sendMailResult = await Mail.sendMail({
        to: booking.contactEmail,
        subject,
        html
      });
      console.log(`[INFO] sendMailResult => ${JSON.stringify(sendMailResult)}`);

      res.status(200).json({ code: 1000, message: 'Successfully' });
    } catch (err) {
      console.log(`[ERROR] ipn => ${err.message}`);
      res.status(400).json({ code: 1001, message: err.message });
    }
  },
  get: async (req, res, next) => {
    const { bookingId } = req.body;
    const booking = await Booking.findOne(
      { bookingId },
      '-_id -__v -supplierResponses'
    );
    if (!booking) {
      return res.status(400).json({ code: 1001, message: 'Booking not found' });
    }
    res
      .status(200)
      .json({ code: 1000, message: 'Successfully', data: booking });
  },
  createV2,
  deleteBooking,
  reSendMail,
  addNote
};
