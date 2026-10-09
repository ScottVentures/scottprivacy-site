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
// Where the site's root folder is (the Kiswahili and French pages live one folder down).
window.SP.root = (document.currentScript && document.currentScript.src || "").replace(/assets\/config\.js.*$/, "");

// Words the site's scripts write on the Kiswahili and French pages (page text itself is translated at build time).
window.SP.T = {
  sw: {"Sign in": "Ingia", "My account": "Akaunti yangu", "Admin dashboard": "Dashibodi ya msimamizi", "Sign out": "Toka",
    "Super admin": "Msimamizi mkuu", "Admin": "Msimamizi", "Help": "Msaada", "Your question": "Swali lako",
    "Ask a question, e.g. \"app not installed\"": "Uliza swali, k.m. \"app not installed\"",
    "Hi! I can answer common questions about ScottPrivacy straight away. What do you need help with?": "Habari! Naweza kujibu maswali ya kawaida kuhusu ScottPrivacy papo hapo (kwa Kiingereza). Unahitaji msaada gani?",
    "Version": "Toleo", "Please check your message, then press Send again.": "Tafadhali kagua ujumbe wako, kisha bonyeza Tuma tena.", "Please check your rating, then press the button again.": "Tafadhali kagua ukadiriaji wako, kisha bonyeza kitufe tena.",
    "Sending…": "Inatuma…", "Send message": "Tuma ujumbe", "Submit rating": "Tuma ukadiriaji", "Update my rating": "Sasisha ukadiriaji wangu",
    "Thanks! Your message has been sent. We'll reply to ": "Asante! Ujumbe wako umetumwa. Tutajibu kwa ",
    "Sorry, your message couldn't be sent. Check your internet connection and try again.": "Samahani, ujumbe wako haukutumwa. Angalia intaneti yako kisha ujaribu tena.",
    "Based on {n} ratings": "Kutokana na ukadiriaji {n}", "Based on 1 rating": "Kutokana na ukadiriaji 1", "No ratings yet. Be the first!": "Bado hakuna ukadiriaji. Kuwa wa kwanza!",
    "{n} ratings": "ukadiriaji {n}", "1 rating": "ukadiriaji 1", "Be the first to rate": "Kuwa wa kwanza kukadiria",
    "No written reviews yet.": "Bado hakuna maoni yaliyoandikwa.", "Tried ScottPrivacy? Your review helps other people stay safe.": "Umejaribu ScottPrivacy? Maoni yako yanawasaidia wengine kuwa salama.",
    "Write the first review": "Andika maoni ya kwanza", "Verified user": "Mtumiaji aliyethibitishwa", "Written by a registered user": "Yameandikwa na mtumiaji aliyesajiliwa",
    "Tap a star to choose your rating.": "Gusa nyota kuchagua ukadiriaji wako.",
    "Thank you! Your rating counts now; your review appears once it's checked.": "Asante! Ukadiriaji wako unahesabiwa sasa; maoni yako yataonekana baada ya kukaguliwa.",
    "Thank you! Your rating has been saved.": "Asante! Ukadiriaji wako umehifadhiwa.",
    "Sorry, that didn't go through. Check your connection and try again.": "Samahani, haikufaulu. Angalia muunganisho wako kisha ujaribu tena.",
    "You rated ScottPrivacy {n} stars.": "Umeikadiria ScottPrivacy nyota {n}.", "Your review is published.": "Maoni yako yamechapishwa.",
    "Your review is waiting for a quick check.": "Maoni yako yanasubiri ukaguzi mfupi.", "You can change it any time.": "Unaweza kuibadilisha wakati wowote."},
  fr: {"Sign in": "Se connecter", "My account": "Mon compte", "Admin dashboard": "Tableau de bord admin", "Sign out": "Se déconnecter",
    "Super admin": "Super admin", "Admin": "Admin", "Help": "Aide", "Your question": "Votre question",
    "Ask a question, e.g. \"app not installed\"": "Posez une question, ex. \"app not installed\"",
    "Hi! I can answer common questions about ScottPrivacy straight away. What do you need help with?": "Bonjour ! Je réponds tout de suite aux questions fréquentes sur ScottPrivacy (en anglais). De quoi avez-vous besoin ?",
    "Version": "Version", "Please check your message, then press Send again.": "Vérifiez votre message, puis appuyez de nouveau sur Envoyer.", "Please check your rating, then press the button again.": "Vérifiez votre note, puis appuyez de nouveau sur le bouton.",
    "Sending…": "Envoi…", "Send message": "Envoyer le message", "Submit rating": "Envoyer la note", "Update my rating": "Modifier ma note",
    "Thanks! Your message has been sent. We'll reply to ": "Merci ! Votre message a été envoyé. Nous répondrons à ",
    "Sorry, your message couldn't be sent. Check your internet connection and try again.": "Désolé, votre message n'a pas pu être envoyé. Vérifiez votre connexion et réessayez.",
    "Based on {n} ratings": "Sur la base de {n} notes", "Based on 1 rating": "Sur la base d'une note", "No ratings yet. Be the first!": "Pas encore de note. Soyez le premier !",
    "{n} ratings": "{n} notes", "1 rating": "1 note", "Be the first to rate": "Soyez le premier à noter",
    "No written reviews yet.": "Pas encore d'avis écrit.", "Tried ScottPrivacy? Your review helps other people stay safe.": "Vous avez essayé ScottPrivacy ? Votre avis aide les autres à rester en sécurité.",
    "Write the first review": "Écrire le premier avis", "Verified user": "Utilisateur vérifié", "Written by a registered user": "Écrit par un utilisateur inscrit",
    "Tap a star to choose your rating.": "Touchez une étoile pour choisir votre note.",
    "Thank you! Your rating counts now; your review appears once it's checked.": "Merci ! Votre note compte déjà ; votre avis apparaîtra après vérification.",
    "Thank you! Your rating has been saved.": "Merci ! Votre note a été enregistrée.",
    "Sorry, that didn't go through. Check your connection and try again.": "Désolé, cela n'a pas fonctionné. Vérifiez votre connexion et réessayez.",
    "You rated ScottPrivacy {n} stars.": "Vous avez donné {n} étoiles à ScottPrivacy.", "Your review is published.": "Votre avis est publié.",
    "Your review is waiting for a quick check.": "Votre avis attend une rapide vérification.", "You can change it any time.": "Vous pouvez la modifier à tout moment."},
};
window.SP.t = function (en, n) {
  var lang = document.documentElement.lang, tab = window.SP.T[lang] || {};
  var s = tab[en] || en;
  return n == null ? s : s.replace("{n}", n);
};
