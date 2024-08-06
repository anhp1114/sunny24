const mongoose = require('mongoose')

const cloudDb = 'mongodb+srv://admin:admin@cluster0.c8rhc.mongodb.net/booking?retryWrites=true&w=majority';
const localDb = 'mongodb://localhost:27017/booking';

const connection = mongoose.connect(
    process.env.MONGO_URL,
//   {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//     useCreateIndex: true,
//     useFindAndModify: false
//   }
)

connection
  .then(db => {
    console.log('Database is connected')
  })
  .catch(err => {
    console.log('Error in connection')
  })

module.exports = connection
