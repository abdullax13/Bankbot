const path = require("path");
const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { addBalance, getBalance, getUser, setTimestamp, addItem, removeItem, getInventory } = require("./db");
const { clampInt, fmt, randInt, pick } = require("./utils");
const { SHOP } = require("./shop");

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function img(name){
  return new AttachmentBuilder(path.join(__dirname, "..", "assets", `${name}.png`));
}

function baseEmbed(title){
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(0x7c3aed)
    .setFooter({ text: "Bank Bot" });
}

function requireAmount(parts, idx=1, min=10, max=100000){
  const amt = clampInt(parts[idx], min, max);
  return amt;
}

async function replyWithImage(message, title, body, imageKey){
  const att = img(imageKey);
  const e = baseEmbed(title).setDescription(body).setImage(`attachment://${imageKey}.png`);
  await message.reply({ embeds:[e], files:[att] });
}

function hasItem(inventory, item){
  return inventory.some(x => x.item === item && x.qty > 0);
}

async function handle(message, prefix){
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const content = message.content.slice(prefix.length).trim();
  if (!content) return;

  const parts = content.split(/\s+/);
  const cmd = parts[0];

  const userId = message.author.id;
  const bal = () => getBalance(userId);

  // ------- Basic helpers -------
  const notEnough = async (need) => {
    await message.reply(`رصيدك ما يكفي. تحتاج ${fmt(need)}، رصيدك الحالي ${fmt(bal())}.`);
  };

  // ------- Commands -------
  if (cmd === "رصيد") {
    const b = bal();
    return replyWithImage(message, "رصيدك", `رصيدك الحالي: **${fmt(b)}**`, "salary");
  }

  if (cmd === "راتب") {
    const u = getUser(userId);
    const now = Date.now();
    const left = (u.last_salary + DAY_MS) - now;
    if (left > 0){
      const hrs = Math.ceil(left / HOUR_MS);
      return replyWithImage(message, "راتب", `توّك ما تقدر تاخذ راتب. جرّب بعد **${hrs}** ساعة.\nرصيدك: **${fmt(bal())}**`, "salary");
    }
    const amount = randInt(350, 650);
    addBalance(userId, amount);
    setTimestamp(userId, "last_salary", now);
    return replyWithImage(message, "راتب", `استلمت راتبك: **+${fmt(amount)}**\nرصيدك الحين: **${fmt(bal())}**`, "salary");
  }

  if (cmd === "بخشيش") {
    const u = getUser(userId);
    const now = Date.now();
    const left = (u.last_tip + (6*HOUR_MS)) - now;
    if (left > 0){
      const mins = Math.ceil(left / (60*1000));
      return replyWithImage(message, "بخشيش", `بعد ما تقدر تاخذ بخشيش. جرّب بعد **${mins}** دقيقة.\nرصيدك: **${fmt(bal())}**`, "tip");
    }
    const amount = randInt(20, 120);
    addBalance(userId, amount);
    setTimestamp(userId, "last_tip", now);
    return replyWithImage(message, "بخشيش", `وصلّك بخشيش: **+${fmt(amount)}**\nرصيدك: **${fmt(bal())}**`, "tip");
  }

  if (cmd === "حظ") {
    const delta = randInt(-200, 300);
    addBalance(userId, delta);
    const sign = delta >= 0 ? "+" : "";
    return replyWithImage(message, "حظ", `حظّك اليوم: **${sign}${fmt(delta)}**\nرصيدك: **${fmt(bal())}**`, "luck");
  }

  if (cmd === "رهان") {
    const amt = requireAmount(parts, 1);
    if (amt == null) return message.reply("اكتب: `رهان <مبلغ>`");
    if (bal() < amt) return notEnough(amt);

    // 50/50 coinflip
    const win = Math.random() < 0.5;
    const delta = win ? amt : -amt;
    addBalance(userId, delta);
    return replyWithImage(message, "رهان", win
      ? `فزت 🎉 مكسبك: **+${fmt(amt)}**\nرصيدك: **${fmt(bal())}**`
      : `خسرت 😬 خصم: **-${fmt(amt)}**\nرصيدك: **${fmt(bal())}**`
    , "bet");
  }

  if (cmd === "روليت") {
    const amt = requireAmount(parts, 1);
    if (amt == null) return message.reply("اكتب: `روليت <مبلغ>`");
    if (bal() < amt) return notEnough(amt);

    // 1/3 win, payout 2.5x (profit 1.5x)
    const win = Math.random() < 1/3;
    const profit = Math.floor(amt * 1.5);
    addBalance(userId, win ? profit : -amt);

    return replyWithImage(message, "روليت", win
      ? `الكرة وقفت على رقمك ✅\nربحت: **+${fmt(profit)}** (على رهان ${fmt(amt)})\nرصيدك: **${fmt(bal())}**`
      : `طلعت ضدك ❌\nخسرت: **-${fmt(amt)}**\nرصيدك: **${fmt(bal())}**`
    , "roulette");
  }

  if (cmd === "نرد") {
    const amt = requireAmount(parts, 1);
    if (amt == null) return message.reply("اكتب: `نرد <مبلغ>`");
    if (bal() < amt) return notEnough(amt);

    const inv = getInventory(userId);
    const hasGoldDice = hasItem(inv, "نرد_ذهبي");
    const rollYou = randInt(1, 6) + (hasGoldDice ? 1 : 0);
    const rollBot = randInt(1, 6);

    let delta = 0;
    if (rollYou > rollBot) delta = amt;
    else if (rollYou < rollBot) delta = -amt;
    else delta = 0;

    addBalance(userId, delta);
    const res = rollYou > rollBot ? "فزت ✅" : rollYou < rollBot ? "خسرت ❌" : "تعادل 🤝";
    const sign = delta > 0 ? "+" : "";
    return replyWithImage(
      message,
      "نرد",
      `${res}\nنردك: **${rollYou}** | نرد البنك: **${rollBot}**\nالتغيير: **${sign}${fmt(delta)}**\nرصيدك: **${fmt(bal())}**${hasGoldDice ? "\n(نرد ذهبي مفعّل 🎲✨)" : ""}`,
      "dice"
    );
  }

  if (cmd === "قمار") {
    const amt = requireAmount(parts, 1);
    if (amt == null) return message.reply("اكتب: `قمار <مبلغ>`");
    if (bal() < amt) return notEnough(amt);

    // high risk: 40% win double, else lose
    const win = Math.random() < 0.4;
    const delta = win ? amt : -amt;
    addBalance(userId, delta);
    return replyWithImage(message, "قمار", win
      ? `فزت ✅ مكسب: **+${fmt(amt)}**\nرصيدك: **${fmt(bal())}**`
      : `خسرت ❌ خصم: **-${fmt(amt)}**\nرصيدك: **${fmt(bal())}**`
    , "gamble");
  }

  if (cmd === "استثمار") {
    const amt = requireAmount(parts, 1);
    if (amt == null) return message.reply("اكتب: `استثمار <مبلغ>`");
    if (bal() < amt) return notEnough(amt);

    // expected positive but can lose a bit: -20%..+60%
    const pct = randInt(-20, 60);
    const delta = Math.floor(amt * (pct/100));
    addBalance(userId, delta);
    const sign = delta >= 0 ? "+" : "";
    return replyWithImage(message, "استثمار", `استثمرت ${fmt(amt)}\nالعائد: **${pct}%**\nالنتيجة: **${sign}${fmt(delta)}**\nرصيدك: **${fmt(bal())}**`, "invest");
  }

  if (cmd === "تداول") {
    const amt = requireAmount(parts, 1);
    if (amt == null) return message.reply("اكتب: `تداول <مبلغ>`");
    if (bal() < amt) return notEnough(amt);

    const inv = getInventory(userId);
    const hasCard = hasItem(inv, "بطاقة");
    // -25..+25 baseline; card shifts by +5
    let pct = randInt(-25, 25) + (hasCard ? 5 : 0);
    if (pct > 40) pct = 40;
    if (pct < -40) pct = -40;

    const delta = Math.floor(amt * (pct/100));
    addBalance(userId, delta);

    const sign = delta >= 0 ? "+" : "";
    return replyWithImage(
      message,
      "تداول",
      `تداولت في: **بطاقة 333**\nالنتيجة: **${pct}%**\nالربح/الخسارة: **${sign}${fmt(delta)}** (على ${fmt(amt)})\nرصيدك: **${fmt(bal())}**${hasCard ? "\n(بطاقة التداول عندك ✅)" : ""}`,
      "trade"
    );
  }

  if (cmd === "نهب") {
    const target = message.mentions.users.first();
    if (!target || target.bot) return message.reply("اكتب: `نهب @user` (لا تقدر تنهب بوت).");
    if (target.id === userId) return message.reply("ما تقدر تنهب نفسك 😅");

    const inv = getInventory(userId);
    const hasMask = hasItem(inv, "قناع");
    const successChance = hasMask ? 0.55 : 0.45;

    const victimBal = getBalance(target.id);
    if (victimBal < 50) return replyWithImage(message, "نهب", `ما يسوى… رصيد ${target} قليل.`, "rob");

    const success = Math.random() < successChance;
    if (success){
      const take = Math.min(victimBal, randInt(50, 250));
      addBalance(target.id, -take);
      addBalance(userId, take);
      return replyWithImage(message, "نهب", `نجحت ✅\nنهبت من ${target}: **${fmt(take)}**\nرصيدك: **${fmt(bal())}**`, "rob");
    } else {
      const fine = randInt(30, 180);
      addBalance(userId, -fine);
      return replyWithImage(message, "نهب", `فشلت ❌\nانمسكت… غرامة: **-${fmt(fine)}**\nرصيدك: **${fmt(bal())}**${hasMask ? "\n(حتى مع القناع مو دايم تنجح)" : ""}`, "rob");
    }
  }

  if (cmd === "لعبه") {
    const secret = randInt(1, 5);
    const choices = ["1","2","3","4","5"];
    await replyWithImage(message, "لعبه", `اختر رقم من 1 إلى 5 بكتابة: \`${prefix}لعبه <رقم>\``, "game");
    return;
  }
  if (cmd === "لعبه" && parts.length >= 2) {
    // unreachable due to above early return; keep simple
  }

  if (cmd === "لون") {
    const colors = ["أحمر","أخضر","أزرق"];
    const chosen = pick(colors);
    const win = Math.random() < 1/3;
    const delta = win ? 150 : -80;
    addBalance(userId, delta);
    return replyWithImage(message, "لون", `اللون طلع: **${chosen}**\n${win ? "مطابق ✅" : "مو مطابق ❌"}\nالتغيير: **${delta>=0?"+":""}${fmt(delta)}**\nرصيدك: **${fmt(bal())}**`, "color");
  }

  if (cmd === "فواكه") {
    const amt = requireAmount(parts, 1);
    if (amt == null) return message.reply("اكتب: `فواكه <مبلغ>`");
    if (bal() < amt) return notEnough(amt);

    const fruits = ["🍒","🍋","🍇","🍉","🍎"];
    const a = pick(fruits), b = pick(fruits), c = pick(fruits);
    let mult = 0;
    if (a===b && b===c) mult = 3;
    else if (a===b || b===c || a===c) mult = 1;
    else mult = -1;

    const delta = mult > 0 ? Math.floor(amt * mult) : -amt;
    addBalance(userId, delta);
    return replyWithImage(message, "فواكه", `${a} | ${b} | ${c}\n${mult===3?"جاكبوت 🎉 (x3)":mult===1?"فوز بسيط ✅ (x1)":"خسارة ❌"}\nالتغيير: **${delta>=0?"+":""}${fmt(delta)}**\nرصيدك: **${fmt(bal())}**`, "fruits");
  }

  if (cmd === "تسريع") {
    const amt = requireAmount(parts, 1);
    if (amt == null) return message.reply("اكتب: `تسريع <مبلغ>`");
    if (bal() < amt) return notEnough(amt);

    // push-your-luck: 70% small win, 30% lose
    const r = Math.random();
    let delta;
    if (r < 0.7){
      const pct = randInt(10, 35);
      delta = Math.floor(amt * (pct/100));
      addBalance(userId, delta);
      return replyWithImage(message, "تسريع", `طلعت لك سرعة ✅\nربح: **${pct}%** = **+${fmt(delta)}**\nرصيدك: **${fmt(bal())}**`, "speed");
    } else {
      delta = -amt;
      addBalance(userId, delta);
      return replyWithImage(message, "تسريع", `انفجرت السرعة ❌\nخسرت: **-${fmt(amt)}**\nرصيدك: **${fmt(bal())}**`, "speed");
    }
  }

  if (cmd === "شراء") {
    const item = parts[1];
    if (!item) {
      const lines = Object.entries(SHOP).map(([k,v]) => `• **${k}** — سعر: ${fmt(v.price)} | بيع: ${fmt(v.sell)}\n  ${v.desc}`);
      return replyWithImage(message, "المتجر", lines.join("\n"), "buy");
    }
    const entry = SHOP[item];
    if (!entry) return message.reply("هذا مو موجود بالمتجر. اكتب `شراء` بروحه عشان تشوف القائمة.");
    if (bal() < entry.price) return notEnough(entry.price);

    addBalance(userId, -entry.price);
    addItem(userId, item, 1);
    return replyWithImage(message, "شراء", `اشتريت **${item}** بـ **${fmt(entry.price)}**\nرصيدك: **${fmt(bal())}**`, "buy");
  }

  if (cmd === "بيع") {
    const item = parts[1];
    if (!item) {
      const inv = getInventory(userId);
      if (inv.length === 0) return replyWithImage(message, "بيع", "ما عندك شي تبيعه.", "sell");
      const lines = inv.map(x => `• **${x.item}** x${x.qty}`);
      return replyWithImage(message, "أغراضك", lines.join("\n"), "sell");
    }
    const entry = SHOP[item];
    if (!entry) return message.reply("هذا مو قابل للبيع بهالنظام.");
    const ok = removeItem(userId, item, 1);
    if (!ok) return message.reply("ما عندك هالغرض.");
    addBalance(userId, entry.sell);
    return replyWithImage(message, "بيع", `بعت **${item}** وحصلت **${fmt(entry.sell)}**\nرصيدك: **${fmt(bal())}**`, "sell");
  }

  // help / unknown
  if (cmd === "مساعدة" || cmd === "help") {
    const list = [
      "راتب", "بخشيش", "حظ", "روليت <مبلغ>", "نهب @user", "رهان <مبلغ>",
      "استثمار <مبلغ>", "تداول <مبلغ>", "قمار <مبلغ>", "نرد <مبلغ>",
      "لون", "فواكه <مبلغ>", "تسريع <مبلغ>", "شراء [غرض]", "بيع [غرض]", "رصيد"
    ].map(x => `• \`${prefix}${x}\``).join("\n");
    return replyWithImage(message, "مساعدة", list, "salary");
  }

  // If user typed roulette without amount etc:
  const quickMap = new Map([
    ["روليت","roulette"],["تداول","trade"],["استثمار","invest"],["قمار","gamble"],["نرد","dice"],["فواكه","fruits"],["تسريع","speed"],
    ["شراء","buy"],["بيع","sell"],["راتب","salary"],["بخشيش","tip"],["حظ","luck"],["نهب","rob"],["رهان","bet"],["لعبه","game"],["لون","color"],
  ]);
  if (quickMap.has(cmd)){
    return replyWithImage(message, cmd, `اكتب: \`${prefix}${cmd} ...\` (إذا يحتاج مبلغ/منشن)\nاكتب \`${prefix}مساعدة\` للقائمة.`, quickMap.get(cmd));
  }

  return;
}

module.exports = { handle };
