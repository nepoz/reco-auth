require('dotenv').config();

module.exports = {
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
  KEY: process.env.KEY,
  MONGODB_URI: process.env.MONGODB_URI,
};