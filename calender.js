const express = require("express");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const dotenv = require("dotenv");
const expressSession = require("express-session");
const { google } = require("googleapis"); // Add this line
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
    },
    (accessToken, refreshToken, profile, done) => {
      // Create a Google Calendar API client using user credentials
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_API_CLIENT_ID,
        process.env.GOOGLE_API_CLIENT_SECRET,
        process.env.GOOGLE_API_CALLBACK_URL
      );

      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      // Create a Google Calendar API instance
      const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      // Retrieve the user's calendar events
      calendar.events.list(
        {
          calendarId: "primary", // Use 'primary' to access the user's primary calendar
          timeMin: new Date().toISOString(),
          maxResults: 10, // You can adjust the number of events to retrieve
          singleEvents: true,
          orderBy: "startTime",
        },
        (err, response) => {
          if (err) {
            console.error("Error fetching calendar events:", err);
            return done(err);
          }
          const events = response.data.items;
          console.log("Calendar Events:", events);
          return done(null, profile);
        }
      );
    }
  )
);

// Serialize user into the session
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user from the session
passport.deserializeUser((user, done) => {
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

// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
