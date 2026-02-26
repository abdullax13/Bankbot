require("dotenv").config();
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { handle } = require("./src/commands");

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("Missing DISCORD_TOKEN in environment variables.");
  process.exit(1);
}
const prefix = process.env.PREFIX || "!";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag} | Prefix: ${prefix}`);
});

client.on("messageCreate", async (message) => {
  try {
    await handle(message, prefix);
  } catch (err) {
    console.error(err);
    try { await message.reply("صار خطأ غير متوقع. جرّب مرة ثانية."); } catch {}
  }
});

client.login(token);
