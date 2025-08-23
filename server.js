require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.CHANNEL_USERNAME;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

app.post("/api/checkMember", async (req, res) => {
  const { userId } = req.body;

  try {
    const response = await axios.get(`${TELEGRAM_API}/getChatMember`, {
      params: {
        chat_id: CHAT_ID,
        user_id: userId,
      },
    });

    const { status } = response.data.result;
    const isMember = ["creator", "administrator", "member"].includes(status);

    res.json({
      userId,
      groupId: CHAT_ID,
      isMember,
      status,
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({
      error: error.response?.data || error.message,
    });
  }
});

app.post("/api/addUser", async (req, res) => {
  const { name, email, address, dob } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  const checkQuery = `SELECT * FROM customers WHERE cus_name = $1`;
  const checkResult = await pool.query(checkQuery, [name]);

  if (checkResult.rows.length > 0) {
    return res.status(400).json({ message: "User already exists" });
  }

  try {
    const insertQuery = `
      INSERT INTO customers (cus_name, email, address, dob)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [name, email, address || null, dob || null];
    const result = await pool.query(insertQuery, values);

    res.json({ resMessage: "User Added", user: result.rows[0] });
  } catch (error) {
    console.error("Insert error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/updateUser", async (req, res) => {
  // const { mobile } = req.params;
  const { mobile, name, email, address, dob } = req.body;

  console.log(mobile, "mobile>>>>>>>>>>>>>>>>>>>>>>");

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  try {
    const checkUser = await pool.query(
      "SELECT * FROM customers WHERE mobile = $1",
      [mobile]
    );

    if (checkUser.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const checkDuplicate = await pool.query(
      "SELECT * FROM customers WHERE cus_name = $1 AND cus_name != $2",
      [name, mobile]
    );

    if (checkDuplicate.rows.length > 0) {
      return res
        .status(400)
        .json({ message: "Another user with this name already exists" });
    }

    const updateQuery = `
      UPDATE customers
      SET cus_name = $1, email = $2, address = $3, dob = $4
      WHERE mobile = $5
      RETURNING *
    `;
    const result = await pool.query(updateQuery, [
      name,
      email,
      address,
      dob,
      mobile,
    ]);

    res.json({
      message: "User updated successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM customers");
    res.json(result.rows);
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/sendMessage", async (req, res) => {
  try {
    const { chat_id, text } = req.body;

    if (!chat_id || !text) {
      return res.status(400).json({ error: "chat_id and text are required" });
    }

    const response = await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id,
      text,
    });

    res.json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json(error.response?.data || { error: error.message });
  }
});

const PORT = process.env.PORT || 8555;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
