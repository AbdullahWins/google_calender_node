const express = require("express");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const dotenv = require("dotenv");
const expressSession = require("express-session");
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
      // This callback is called when the user is authenticated successfully.
      // You can access the user's details in the 'profile' object.
      console.log(accessToken, refreshToken);
      console.log("User profile:", profile);
      return done(null, profile);
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
  passport.authenticate("google", { scope: ["profile", "email"] })
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
