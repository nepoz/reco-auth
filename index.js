const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const querystring = require('querystring');
const randomString = require('randomstring');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const oauth = require('axios-oauth-client');
const Cryptr = require('cryptr');
const mongoose = require('mongoose');
const {
  KEY,
  MONGODB_URI,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  PORT,
} = require('./config');
const AuthInformation = require('./models/AuthInformation');

// Keys for cookie entries
const stateKey = 'spotify_auth_state';
const userIdKey = 'discord_user_id';

// URLs to be used during the authentication and redirect processes
const codeUrl = 'https://accounts.spotify.com/authorize?';
const tokenUrl = 'https://accounts.spotify.com/api/token';
const spotifyProfile = 'https://www.spotify.com/us/account/overview/';
const callbackUrl = 'http://localhost:8080/callback';

const cryptr = new Cryptr(KEY);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static('public'));

mongoose.connect(MONGODB_URI, { useNewUrlParser: true });

/**
 * Makes request to Spotify auth server for authorization CODE
 * SCOPE allows app to read data about user's PLAYER
 */
app.get('/spotify-login', async (req, res) => {
  const userId = req.query.userid || res.json({ error: 'Missing REQUIRED value userid.' }).end();
  res.cookie(userIdKey, userId);

  // State helps ensure that flow is not being tampered with
  const state = randomString.generate(16);
  res.cookie(stateKey, state);

  const requestParams = {
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    scope: 'user-read-playback-state user-read-currently-playing user-modify-playback-state',
    redirect_uri: callbackUrl,
    state,
  };

  const query = codeUrl + querystring.encode(requestParams);
  res.redirect(query);
});

/**
 * Handles token exchange with Spotify auth server
 */
app.get('/callback', async (req, res) => {
  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies[stateKey] : null;

  if (storedState === null || storedState !== state) {
    res.json({
      error: 'State does not match',
    });
  } else {
    res.clearCookie(stateKey);

    // Dispatches request for authentication and refresh tokens
    const sendAuthRequest = oauth.client(axios.create(), {
      url: tokenUrl,
      grant_type: 'authorization_code',
      client_id: SPOTIFY_CLIENT_ID,
      client_secret: SPOTIFY_CLIENT_SECRET,
      code,
      redirect_uri: callbackUrl,
    });

    const auth = await sendAuthRequest();
    const id = req.cookies[userIdKey].toString();
    res.clearCookie(userIdKey);

    // Encypts auth information for database entry
    const authEncrypted = {
      access_token: cryptr.encrypt(auth.access_token),
      refresh_token: cryptr.encrypt(auth.refresh_token),
    };

    // Enter user information into database
    const newEntry = new AuthInformation({
      id,
      auth: authEncrypted,
    });

    newEntry.save();

    res.redirect(spotifyProfile);
  }
});

/**
 * Handles the request to refresh access tokens for user
 */
app.get('/refresh', async (req, res) => {
  const userId = req.query.id || null;

  if (!userId) res.json({ error: 'Missing REQUIRED parameter id' }).end();

  const refreshToken = await AuthInformation
    .findOne({ id: userId })
    .then(entry => entry.toJSON())
    .then(entry => cryptr.decrypt(entry.auth.refresh_token));

  const sendRefreshRequest = oauth.client(axios.create(), {
    url: tokenUrl,
    grant_type: 'refresh_token',
    client_id: SPOTIFY_CLIENT_ID,
    client_secret: SPOTIFY_CLIENT_SECRET,
    refresh_token: refreshToken,
  });

  const newAuth = await sendRefreshRequest();
  
  const newAuthEncrypted = {
    access_token: cryptr.encrypt(newAuth.access_token),
    refresh_token: newAuth.refresh_token ? cryptr.encrypt(newAuth.refresh_token) : cryptr.encrypt(refreshToken),
  };

  await AuthInformation.findOneAndUpdate({ id: userId }, { auth: newAuthEncrypted });
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
