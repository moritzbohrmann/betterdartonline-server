const express = require("express");
const bodyParser = require("body-parser");

const crypto = require("crypto");

const app = express();
const cors = require("cors");

const db = require("../db/sql");
const jwt = require("jsonwebtoken");

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.post("/account/register", async ({ body }, res) => {
   let account = await getAccount(AccountInfoType.EMAIL, body.email);

   if (account) {
      res.json({ error: "Email already in use." });
      return;
   }

   account = { ...body, uuid: crypto.randomUUID() };

   if (!addAccount(account)) {
      res.json({ error: "Could not insert into database." });
      return;
   }

   res.json({
      registered: true,
   });
});

app.post("/account/login", async ({ body }, res) => {
   let account = await getAccount(AccountInfoType.EMAIL, body.email);

   if (!(await account) && body.type === "Google") {
      await addAccount(body);

      account = await getAccount(AccountInfoType.EMAIL, body.email);
   }

   let payload = { error: null, token: null };

   if (!account) {
      res.json({ ...payload, error: "Account not found." });
      return;
   }

   if (body.type === "Native" && body.password !== account.Password) {
      res.json({ ...payload, error: "Wrong password." });
      return;
   }

   res.json({
      ...payload,
      token: jwt.sign({ uuid: account.Uuid, username: account.Username, picture: account.Picture }, AUTH_KEY, { expiresIn: "2h" }),
   });
});

app.get("/account/logout/:token", (req, res) => {
   const decodedToken = jwt.decode(req.params.token);
   const payload = { error: null };

   res.json(payload);
});

app.get("/account/expire/:token", async (req, res) => {
   const token = req.params.token;
   let decodedToken;

   try {
      decodedToken = jwt.verify(token, AUTH_KEY);
      res.json({ isExpired: false });
   } catch ({ message }) {
      if (message === "jwt expired") {
         return res.json({ isExpired: true });
      }
   }
});

app.get("/account/info/:token", async (req, res) => {
   const token = req.params.token;

   let decodedToken;
   let payload = { error: null, account: null };

   try {
      decodedToken = jwt.verify(token, AUTH_KEY);

      const account = await getAccount(AccountInfoType.USERNAME, decodedToken.username);

      if (!account) {
         res.json({ ...payload, error: "Your account does not seem to exist." });
         return;
      }

      res.json({ ...payload, account: { uuid: account.Uuid, username: account.Username, email: account.Email, picture: account.Picture } });
   } catch ({ message }) {
      if (message === "jwt expired") {
         return res.json({ ...payload, error: "Session expired. Sign in again." });
      }
   }
});

app.get("/account/username/:id", async (req, res) => {
   const { id } = req.params;

   let payload = { error: null, username: null };

   try {
      const account = await getAccount(AccountInfoType.UUID, id);

      if (!account) {
         res.json({ ...payload, error: "This account does not seem to exist." });
         return;
      }

      res.json({ ...payload, username: account.Username });
   } catch (err) {
      res.json({ error: " Something went wrong." });
   }
});

app.listen(3003, () => {
   console.log("Listening on port 3003...");
});

const AUTH_KEY = "gupxxN6mHhEkQVh2VgRDlFj3ORMSR7";

const AccountInfoType = {
   USERNAME: "Username",
   EMAIL: "Email",
   UUID: "Uuid",
};

const getAccount = async (accountInfoType, accountInfo) => {
   const fetchAccount = async () => {
      return await db.execute(`SELECT * FROM accounts WHERE ${accountInfoType} = '${accountInfo}'`);
   };

   const account = await fetchAccount();

   return await account[0][0];
};

const addAccount = async (account) => {
   return await db.query(
      `INSERT INTO accounts (Uuid, Username, Email, Password, Picture) VALUES ('${account.uuid ? account.uuid : crypto.randomUUID()}', '${
         account.username
      }', '${account.email}', '${account.password ? account.password : ""}', '${account.picture}')`
   );
};
