const API = "https://api.telegram.org";

export async function sendMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("[telegram] TELEGRAM_BOT_TOKEN missing, skipping message");
    return false;
  }

  const res = await fetch(`${API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: false },
    }),
  });

  if (!res.ok) {
    console.error(`[telegram] send failed (${res.status}):`, await res.text());
    return false;
  }
  return true;
}
