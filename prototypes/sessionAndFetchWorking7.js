const express = require("express");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const dotenv = require("dotenv");
const expressSession = require("express-session");
const { google } = require("googleapis");
const User = require("./User"); // Replace with your user model
const mongoose = require("mongoose");
const MongoDBStore = require("connect-mongodb-session")(expressSession);
const bcrypt = require("bcrypt"); // Add bcrypt for password hashing

dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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
        const email = profile?.emails[0]?.value;
        // Check if the user already exists in your database
        let user = await User.findOne({ email: email });

        if (user) {
          // Update the existing user with new tokens
          user.googleId = profile.id;
          user.accessToken = accessToken;
          user.refreshToken = refreshToken;
          await user.save();

          // Create a user object to pass to done
          const userObject = {
            id: user._id,
            accessToken,
            refreshToken,
          };

          done(null, userObject);
        } else {
          // User doesn't exist, return an error
          done(new Error("User not found"));
        }
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

// Separate route for linking the Google account
app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email", "https://www.googleapis.com/auth/calendar"],
  })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/failure" }),
  async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.redirect("/login");
      }

      if (!req.user.googleId) {
        // Check if the user is already linked to a Google account
        const existingUser = await User.findOne({ email: req.user.email });

        if (existingUser) {
          return res
            .status(400)
            .json({ message: "User is already linked to a Google account" });
        }

        // Fetch the user from the database
        const user = await User.findById(req.user.id);

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Link the user account to the Google account
        user.googleId = req.user.id; // Assuming you want to link it using their user ID
        await user.save();
      }

      res.redirect("/success");
    } catch (err) {
      console.error("Error during linking:", err);
      res.status(500).json({ error: "Error during linking" });
    }
  }
);

// Standard Username and Password Authentication Routes

// Registration
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the email is already registered
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash the password before saving it
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Create a new user
    const newUser = new User({
      email,
      password: hashedPassword,
    });

    await newUser.save();
    res.status(200).json({ message: "Registration successful" });
  } catch (err) {
    console.error("Error during registration:", err);
    res.status(500).json({ error: "Error during registration" });
  }
});

// Render the login form
app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/views/login.html");
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Verify standard login credentials
    const user = await User.findOne({ email });

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Log the user in (you can use passport here)
    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ message: "Login error" });
      }
      console.log(user);
      return res.redirect("/dashboard"); // Redirect to the dashboard after login
    });
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).json({ error: "Error during login" });
  }
});

// Dashboard route accessible after standard login
app.get("/dashboard", (req, res) => {
  // Check if the user is authenticated
  if (req.isAuthenticated()) {
    res.send("Welcome to the dashboard!");
  } else {
    res.redirect("/login");
  }
});

app.get("/calendar/events/:email", async (req, res) => {
  try {
    // Check if the user is authenticated
    // if (!req.isAuthenticated()) {
    //   return res.status(401).json({ message: "Not authenticated" });
    // }

    // const googleId = req.user.googleId;
    const email = req.params.email;

    // if (!googleId) {
    //   return res.status(400).json({ message: "Google ID not linked" });
    // }

    // Now that you have the user's Google ID, you can use it to fetch calendar events
    // Set up the Google Calendar API client and fetch events using the googleId

    // Create a Google Calendar API client using user credentials
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_API_CLIENT_ID,
      process.env.GOOGLE_API_CLIENT_SECRET,
      process.env.GOOGLE_API_CALLBACK_URL
    );

    // Set the credentials in the OAuth2 client
    // Assuming you have stored the access token and refresh token in the user's record
    const user = await User.findOne({ email: email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    oauth2Client.setCredentials({
      access_token: user.accessToken,
      refresh_token: user.refreshToken,
    });

    // Create a Google Calendar API instance
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // Retrieve the user's calendar events
    const events = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: "startTime",
    });

    res.status(200).json(events.data.items);
  } catch (err) {
    console.error("Error fetching calendar events:", err);
    res.status(500).json({ error: "Error fetching calendar events" });
  }
});

// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
