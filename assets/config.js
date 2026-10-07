/* Website settings. Keys here are meant to be public: what they can do is limited on the server side. */
window.SP = {
  // Accounts, reviews and download tracking (Supabase). Fill both in after following tools/site/ACCOUNTS_SETUP.md.
  // Only the "anon public" key goes here, NEVER the service_role key.
  // While empty, ratings are emailed to you through the contact form service instead.
  supabaseUrl: "https://rkgsgigluuosikfjieqq.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZ3NnaWdsdXVvc2lrZmppZXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMzU1MDEsImV4cCI6MjEwNjkxMTUwMX0.HXKl5ESzExM4mBxQo2e2HZSrbfAh7Xn5xMIQeUJBG50",
  // Contact form (Web3Forms) access key, also used for ratings until the database is set up.
  web3formsKey: "996b2e7c-7231-485d-a146-484ed9db8223",
  // Show the average rating in the header badge once there are at least this many ratings.
  minRatingsToShow: 3,
};
