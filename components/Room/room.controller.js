const _ = require('lodash');
const moment = require('moment');
const momentTimezone = require('moment-timezone');
// const controller = require('./booking.controller');
const Room = require('./room.model');
const Booking = require('../Booking/booking.model');
const Branch = require('../Branch/branch.model');

let roomCache = [];

const checkAvailable = async (req, res, next) => {
  try {
    let {
      roomId,
      from,
      to,
      selectField = 'note bookingId roomId contactName contactEmail contactPhone contactChannel totalCustomer identifyCardNumber from to total status createdAt paymentAt'
    } = req.body;
    const roomFilter = {};
    if (roomId) {
      roomFilter.id = roomId;
    }
    const rooms = await Room.find(roomFilter);

    // compare from to
    from = moment(from);
    to = moment(to);

    if (from.isAfter(to)) {
      throw new Error('Invalid time (1)');
    }

    // calculate numer of days
    const numberOfDays = to.diff(from, 'days');
    // split into array of days
    const days = _.range(numberOfDays + 1).map((i) =>
      momentTimezone
        .tz(from.clone().add(i, 'days'), 'Asia/Ho_Chi_Minh')
        .startOf('day')
        .toDate()
    );
    let scaningFrom = momentTimezone(from)
      .tz('Asia/Ho_Chi_Minh')
      .startOf('day')
      .toDate();
    let scaningTo = momentTimezone(to)
      .tz('Asia/Ho_Chi_Minh')
      .endOf('day')
      .toDate();

    const scaningQuery = {
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
    if (roomId) {
      scaningQuery.roomId = roomId;
    }

    const bookingList = await Booking.find(scaningQuery, selectField);

    const branches = await Branch.find();

    // for of rooms
    let availableRooms = [];

    for (const room of rooms) {
      const { bookingTimeSlots } = room;
      const dateAvailable = [];
      let bookingByDay = [];
      for (const day of days) {
        bookingByDay = _.filter(bookingList, { roomId: room.id });
        const bookingTimeSlotsAvailable = [];
        for (const bookingSlot of bookingTimeSlots) {
          const { name, startTime, endTime } = bookingSlot;
          // startTime and endTime is in UTC+7
          const startTimeHour = _.toNumber(_.split(startTime, ':')[0]);
          const startTimeMinute = _.toNumber(_.split(startTime, ':')[1]);
          const endTimeHour = _.toNumber(_.split(endTime, ':')[0]);
          const endTimeMinute = _.toNumber(_.split(endTime, ':')[1]);
          // create date UTC
          const from = momentTimezone(day)
            .tz('Asia/Ho_Chi_Minh')
            .set({
              hour: startTimeHour,
              minute: startTimeMinute,
              second: 0,
              millisecond: 0
            })
            .toDate();
          let to = momentTimezone(day)
            .tz('Asia/Ho_Chi_Minh')
            .set({
              hour: endTimeHour,
              minute: endTimeMinute,
              second: 0,
              millisecond: 0
            })
            .toDate();
          if (name === 'overNight') {
            to = momentTimezone(day)
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
              Booking.updateOne(
                { bookingId: exist.bookingId },
                { status: 'CANCELLED' }
              ).exec();
            }
            return false;
          });
          let isAvailable = _.isNil(existsBooking);

          // Nếu from >= 01/07/2024 thì isAvailable = false
          // const blockDate = moment('2024-07-01').tz('Asia/Ho_Chi_Minh').startOf('day').toDate();
          // if (from >= blockDate) {
          //   isAvailable = false;
          // }

          bookingTimeSlotsAvailable.push({
            name,
            startTime,
            endTime,
            from,
            to,
            isAvailable,
            booking: existsBooking
          });
        }
        dateAvailable.push({
          date: day,
          bookingTimeSlots: bookingTimeSlotsAvailable
        });
      }
      const branch = _.find(branches, { id: room.branchId });
      availableRooms.push({
        roomId: room.id,
        branchName: branch?.name || 'Chưa xác định',
        branchId: room.branchId || 9999999,
        dateAvailable,
        statistic: {
          totalBooking: bookingByDay.length,
          revenue: _.sumBy(bookingByDay, 'total')
        }
      });
    }

    availableRooms = _.sortBy(availableRooms, ['branchId'], ['asc']);

    const groupByBranch = _.groupBy(availableRooms, 'branchName');
    const transformedData = [];
    _.forOwn(groupByBranch, (value, key) => {
      transformedData.push(...value);
    });

    res.status(200).json({
      code: 1000,
      message: 'Check available rooms successfully',
      data: transformedData
    });
  } catch (error) {
    console.log(error.message);
    res.status(400).json({ code: 1001, message: error.message });
  }
};
const createRoom = async (req, res, next) => {
  try {
    let {
      id,
      name,
      description = '',
      services = '',
      address = '',
      addressLink = '',
      googleDriveLink = '',
      selfCheckInLink = '',
      images = [],
      bookingTimeSlots = [],
      priceList = [],
      isDeleted = false,
      wifi = '',
      projector = '',
      rule = '',
      customPrice = {},
      branchId
    } = req.body;

    const latestRoom = await Room.findOne().sort({ id: -1 });

    let roomId = _.toNumber(latestRoom.id);

    roomId += 1;

    const slug = _.kebabCase(name);

    const roomData = {
      slug,
      name,
      services,
      description,
      address,
      addressLink,
      googleDriveLink,
      selfCheckInLink,
      images,
      bookingTimeSlots,
      priceList,
      wifi,
      projector,
      rule,
      customPrice,
      branchId
    };

    let room;

    if (id) {
      if (isDeleted) {
        await Room.deleteOne({ id });
      } else {
        room = await Room.findOneAndUpdate({ id }, roomData, { new: true });
      }
    } else {
      room = await Room.create({
        ...roomData,
        id: _.toString(roomId)
      });
    }

    roomCache = [];

    res.status(200).json({
      code: 1000,
      message: 'Create room successfully',
      data: room
    });
  } catch (error) {
    console.log(error.message);
    res.status(400).json({ code: 1001, message: error.message });
  }
};

const searchRoom = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.body;
    const skip = (page - 1) * limit;

    if (roomCache.length > 0) {
      const total = roomCache.length;
      const rooms = roomCache.slice(skip, skip + limit);
      res.status(200).json({
        code: 1000,
        message: 'Search rooms successfully',
        data: {
          rooms,
          total
        },
        useCache: true
      });
      return;
    }

    const branches = await Branch.find();
    let rooms = await Room.find().skip(skip).limit(limit).lean();
    _.forEach(rooms, (room, i) => {
      const branch = _.find(branches, { id: room.branchId });
      rooms[i].branchName = branch?.name || 'Chưa xác định';
      rooms[i].branchId = room.branchId || 9999999;
      rooms[i].branchColor = branch?.color || '#000000';
    });

    rooms = _.sortBy(rooms, ['branchId'], ['asc']);

    const total = await Room.countDocuments();
    roomCache = rooms;
    res.status(200).json({
      code: 1000,
      message: 'Search rooms successfully',
      data: {
        rooms,
        total
      }
    });
  } catch (error) {
    console.log(error.message);
    res.status(400).json({ code: 1001, message: error.message });
  }
};

const setRoomCache = (rooms) => {
  roomCache = rooms;
};

module.exports = {
  checkAvailable,
  searchRoom,
  createRoom,
  setRoomCache
};
