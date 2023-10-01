const express = require("express");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const dotenv = require("dotenv");
const expressSession = require("express-session");
const { google } = require("googleapis");

dotenv.config();

const app = express();

// Configure express-session middleware
app.use(
  expressSession({
    secret: process.env.SESSION_SECRET_KEY,
    resave: true,
    saveUninitialized: true,
  })
);

// Configure passport with the Google OAuth strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_API_CLIENT_ID,
      clientSecret: process.env.GOOGLE_API_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_API_CALLBACK_URL,
      scope: ["profile", "email", "https://www.googleapis.com/auth/calendar"], // Add the Calendar scope
    },
    (accessToken, refreshToken, profile, done) => {
      const user = { accessToken, refreshToken, profile };
      console.log(user);
      done(null, user);
    }
  )
);

// Serialize user into the session
passport.serializeUser((user, done) => {
  // Serialize the user object with the access and refresh tokens
  done(null, {
    id: user.id,
    accessToken: user.accessToken,
    refreshToken: user.refreshToken,
  });
});

// Deserialize user from the session
passport.deserializeUser((user, done) => {
  // Deserialize the user object and pass it to the callback
  done(null, user);
});

// Initialize Passport and session management
app.use(passport.initialize());
app.use(passport.session());

// Define routes
app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email", "https://www.googleapis.com/auth/calendar"],
  })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    // Successful authentication, redirect to a success page or send a response.
    res.redirect("/success");
  }
);

app.get("/success", (req, res) => {
  res.send("Authentication successful!");
});

// Define a new endpoint to get calendar events
app.get("/calendar/events", (req, res) => {
  // Check if the user is authenticated
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // Get the authenticated user's credentials from the session
  const { accessToken, refreshToken } = req.user;

  // Create a Google Calendar API client using user credentials
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_API_CLIENT_ID,
    process.env.GOOGLE_API_CLIENT_SECRET,
    process.env.GOOGLE_API_CALLBACK_URL
  );

  // Set the credentials in the OAuth2 client
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  // Create a Google Calendar API instance
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  // Retrieve the user's calendar events
  calendar.events.list(
    {
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: "startTime",
    },
    (err, response) => {
      if (err) {
        console.error("Error fetching calendar events:", err);
        return res
          .status(500)
          .json({ error: "Error fetching calendar events" });
      }
      const events = response.data.items;
      res.status(200).json(events);
    }
  );
});

// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
