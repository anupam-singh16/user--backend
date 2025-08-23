// lib/checkMembership.js
const axios = require("axios");

const isUserMember = async (botToken, chatId, userId) => {
  const url = `https://api.telegram.org/bot${botToken}/getChatMember`;
  try {
    const { data } = await axios.get(url, {
      params: { chat_id: chatId, user_id: userId },
    });

    if (!data.ok) return { ok: false, reason: data.description || "Unknown" };

    const status = data.result.status; // "creator" | "administrator" | "member" | "restricted" | "left" | "kicked"
    const isMember = ["creator", "administrator", "member"].includes(status);

    return { ok: true, isMember, status };
  } catch (err) {
    console.log(err, "telegram chat bot>>>>>>>>>>>>>>>>>>>>>>>>>>>");
    const reason =
      err.response?.data?.description ||
      err.response?.data ||
      err.message ||
      "Unknown error";
    return { ok: false, reason };
  }
};

module.exports = { isUserMember };
