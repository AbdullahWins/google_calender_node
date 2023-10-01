const express = require("express");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const dotenv = require("dotenv");
const expressSession = require("express-session");
const { google } = require("googleapis");
const User = require("./User");
const mongoose = require("mongoose");
const MongoDBStore = require("connect-mongodb-session")(expressSession);

dotenv.config();

const app = express();

// Move MongoDB connection inside an async function
async function connectToMongoDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}

connectToMongoDB(); // Call the function to connect to MongoDB

// Configure express-session middleware with MongoDB as the session store
const sessionStore = new MongoDBStore({
  uri: process.env.MONGODB_URI,
  collection: "sessions",
});

app.use(
  expressSession({
    secret: process.env.SESSION_SECRET_KEY,
    resave: true,
    saveUninitialized: true,
    store: sessionStore,
  })
);

// Configure passport with the Google OAuth strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_API_CLIENT_ID,
      clientSecret: process.env.GOOGLE_API_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_API_CALLBACK_URL,
      scope: ["profile", "email", "https://www.googleapis.com/auth/calendar"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if the user already exists in your database
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          // Create a new user if they don't exist
          user = new User({
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
          });
        }

        // Update or set the access token and refresh token
        user.accessToken = accessToken;
        user.refreshToken = refreshToken;

        await user.save();

        // Create a user object to pass to done
        const userObject = {
          id: user._id, // Use the unique identifier for the user (e.g., MongoDB _id)
          accessToken,
          refreshToken,
        };

        done(null, userObject);
      } catch (err) {
        done(err);
      }
    }
  )
);

// Serialize user into the session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
  try {
    // Find the user in the database by their unique identifier (e.g., MongoDB _id)
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
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
