require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

// Telegram setup
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.CHANNEL_USERNAME;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

/**
 * ✅ Make sure your database has indexing:
 *
 * ALTER TABLE customers ADD COLUMN id SERIAL PRIMARY KEY;
 * CREATE UNIQUE INDEX idx_customers_email ON customers(email);
 * CREATE UNIQUE INDEX idx_customers_mobile ON customers(mobile);
 */

// ---------------------- Check Telegram Membership ----------------------
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

// ---------------------- Add User ----------------------
app.post("/api/addUser", async (req, res) => {
  const { name, email, address, dob, mobile } = req.body;

  if (!name || !email || !mobile) {
    return res
      .status(400)
      .json({ error: "Name, email and mobile are required" });
  }

  try {
    // check duplicate by email or mobile
    const checkQuery = `SELECT * FROM customers WHERE email = $1 OR mobile = $2`;
    const checkResult = await pool.query(checkQuery, [email, mobile]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const insertQuery = `
      INSERT INTO customers (cus_name, email, mobile, address, dob)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [name, email, mobile, address || null, dob || null];
    const result = await pool.query(insertQuery, values);

    res.json({ resMessage: "User Added", user: result.rows[0] });
  } catch (error) {
    console.error("Insert error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------- Update User ----------------------
app.put("/api/updateUser", async (req, res) => {
  const { mobile, name, email, address, dob } = req.body;

  if (!name || !email || !mobile) {
    return res
      .status(400)
      .json({ error: "Name, email and mobile are required" });
  }

  try {
    const checkUser = await pool.query(
      "SELECT * FROM customers WHERE mobile = $1",
      [mobile]
    );

    if (checkUser.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userId = checkUser.rows[0].id;

    // ✅ duplicate check by name (excluding same user id)
    const checkDuplicate = await pool.query(
      "SELECT * FROM customers WHERE cus_name = $1 AND id != $2",
      [name, userId]
    );

    if (checkDuplicate.rows.length > 0) {
      return res
        .status(400)
        .json({ message: "Another user with this name already exists" });
    }

    const updateQuery = `
      UPDATE customers
      SET cus_name = $1, email = $2, address = $3, dob = $4
      WHERE id = $5
      RETURNING *;
    `;
    const result = await pool.query(updateQuery, [
      name,
      email,
      address,
      dob,
      userId,
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

// ---------------------- Get All Users ----------------------
app.get("/api/users", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    const countResult = await pool.query("SELECT COUNT(*) FROM customers");
    const totalRecords = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      "SELECT * FROM customers ORDER BY cus_name ASC LIMIT $1 OFFSET $2",
      [limit, offset]
    );

    const totalPages = Math.ceil(totalRecords / limit);

    res.json({
      totalRecords,
      totalPages,
      currentPage: page,
      pageSize: limit,
      data: result.rows,
      message: "User Found Successfully",
    });
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------- Send Telegram Message ----------------------
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

// ---------------------- Start Server ----------------------
const PORT = process.env.PORT || 8555;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
