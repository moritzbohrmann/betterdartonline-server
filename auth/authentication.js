const express = require("express");
const bodyParser = require("body-parser");

const { generateToken } = require("../utils/token");
const crypto = require("crypto");
const whiteList = require("./whitelist.json");

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/test", (req, res) => {
   res.json({ message: "Yeah, it's working!" });
});
app.get("/account/:id", (req, res) => {
   const id = req.params.id;

   const account = whiteList.find((account) => account.id === id);

   if (!account) {
      res.json({ error: "Your account does not seem to exist." });
      return;
   }

   const { username, email, question } = account;

   res.json({ username: username, email: email, question: question });
});

app.post("/account/register", ({ body }, res) => {
   if (whiteList.find((account) => account.username === body.username)) {
      res.json({ error: "Username already in use." });
      return;
   }
   if (whiteList.find((account) => account.email === body.email)) {
      res.json({ error: "Email already in use." });
      return;
   }

   const account = { id: crypto.randomUUID(), token: generateToken(), expires: { date: Date.now } };

   res.json({ authenticated: true, account: account });
});

app.post("/account/login", ({ body }, res) => {
   const existingAccount = whiteList.find((account) => account.username === body.username || account.email === body.email);

   if (!existingAccount) {
      res.json({ authenticated: false, error: "Account not found." });
      return;
   }

   if (body.password !== existingAccount.password) {
      res.json({ authenticated: false, error: "Wrong password." });
      return;
   }

   if (body.question.answer !== existingAccount.questionC.answer) {
      res.json({ authenticated: false, error: "Wrong answer." });
      return;
   }

   const expires = new Date();
   expires.setHours(expires.getHours() + 2);

   const account = { id: existingAccount.id, token: generateToken(), expires: expires };

   res.json({ authenticated: true, account: account });
});

app.listen(3003, () => {
   console.log("Listening on post 3003...");
});
