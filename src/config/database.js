require("dotenv").config();

const mongoose = require("mongoose");
mongoose.set("strictQuery", false);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.URL_DB_MONGO);
    console.log("Connected to MongoDB!");
    return conn;
  } catch (err) {
    console.log(err.message);
    throw err;
  }
};

const isDbConnected = () => mongoose.connection.readyState === 1;

module.exports = { connectDB, isDbConnected, mongoose };