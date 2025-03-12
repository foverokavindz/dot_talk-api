const app = require('./app');
const dotenv = require('dotenv'); // environment variables configuration
const mongoose = require('mongoose'); // MongoDB object modeling tool
const { Server } = require('socket.io');
//const User = require('./models/user');

dotenv.config({ path: './config.env' }); // configure environment variables

// handle uncaught exceptions to prevent server crashes
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

const http = require('http'); // http server core module

const server = http.createServer(app); // create server instance

// setup socket.io server
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const DB = process.env.DB_URI.replace(
  '<USERNAME>',
  process.env.DB_USERNAME
).replace('<PASSWORD>', process.env.DB_PASSWORD); // database configuration

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    // useCreateIndex: true,
    // useFindAndModify: false,
    useUnifiedTopology: true,
  }) // connect to database
  .then(() => console.log('DB connection successful!'))
  .catch((err) => console.log(err)); // log success

const port = process.env.PORT || 8000; // port configuration

server.listen(port, () => {
  console.log('Server running on port ' + port);
}); // run server on port 3000

// io.on('connection', async (socket) => {
//   console.log('Socket: ' + socket);
//   const user_id = socket.handshake.query['user_id'];
//   console.log('User connected: ' + user_id);

//   if (user_id) {
//     await User.findByIdAndUpdate(user_id, { socket_id: socket.id });
//   }

//   // we can write out soket event listners here

//   socket.on('friend_request', async (data) => {
//     console.log(data.to);

//     // Create New Friend Request

//     // to: user_id
//     const user = await User.findById(data.to).emit('new_friend_request', data);

//     if (user) {
//       io.to(user.socket_id);
//     }
//   });
// });

// handle unhandled promise rejections and uncaught exceptions to prevent server crashes
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
