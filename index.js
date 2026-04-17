const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ThreadAutoArchiveDuration
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const LEAGUE_CHANNEL_ID = "1487896681239548126";
const LEAGUE_PING_ROLE_ID = "1460048729464770693";
const LEAGUE_HOST_ROLE_ID = "1460146847912952090";
const EVENT_CHANNEL_ID = "1479659610418843791";
const GENERAL_CHANNEL_ID = "1493746394651951286";
const HEAD_OF_EVENT_ROLE_ID = "1482428444070379611";
const GIVEAWAY_PING_ROLE_ID = "1460048231424852180";
const PROMOTION_ALLOWED_USER_IDS = ["1180944141291634728", "1459790270370676798"];
const HICOM_ROLE_ID = "1474820927173689344";
const DIRECTOR_ROLE_ID = "1478898490691031211";
const CO_OWNER_ROLE_ID = "1482508756746113216";
const OWNER_ROLE_ID = "1475287458009583636";
const FOUNDER_ROLE_ID = "1488059625944387654";
const BLOODLINE_ROLE_ID = "1493083021752930315";
const PLUS_ROLE_ID = "1478902879917179070";
const DATABASE_PATH = path.join(__dirname, "database.json");

const matchFormats = {
  "2v2": 4,
  "3v3": 6,
  "4v4": 8
};

const matchTypeLabels = {
  swift_game: "Swift Game",
  war_game: "War Game"
};

const perkLabels = {
  perks: "Perks",
  no_perks: "No Perks"
};

const regionLabels = {
  europe: "Europe",
  asia: "Asia",
  north_america: "North America",
  south_america: "South America",
  ocean: "Ocean"
};

const eventTypeLabels = {
  guess_the_number: "Guess the Number"
};

function createEmptyDatabase() {
  return {
    nextLeagueNumber: 1,
    nextEventNumber: 1,
    nextPromotionNumber: 1,
    leagues: {},
    events: {},
    promotions: {}
  };
}

function loadDatabase() {
  if (!fs.existsSync(DATABASE_PATH)) {
    const emptyDatabase = createEmptyDatabase();
    saveDatabase(emptyDatabase);
    return emptyDatabase;
  }

  try {
    const storedDatabase = JSON.parse(fs.readFileSync(DATABASE_PATH, "utf8"));
    return {
      nextLeagueNumber: Number(storedDatabase.nextLeagueNumber) || 1,
      nextEventNumber: Number(storedDatabase.nextEventNumber) || 1,
      nextPromotionNumber: Number(storedDatabase.nextPromotionNumber) || 1,
      leagues: storedDatabase.leagues && typeof storedDatabase.leagues === "object" ? storedDatabase.leagues : {},
      events: storedDatabase.events && typeof storedDatabase.events === "object" ? storedDatabase.events : {},
      promotions: storedDatabase.promotions && typeof storedDatabase.promotions === "object" ? storedDatabase.promotions : {}
    };
  } catch (error) {
    console.error("database.json could not be read. Fix the JSON before starting the bot.", error);
    process.exit(1);
  }
}

function saveDatabase(database) {
  fs.writeFileSync(DATABASE_PATH, JSON.stringify(database, null, 2));
}

const database = loadDatabase();

function createLeagueId() {
  const leagueId = `LG-${String(database.nextLeagueNumber).padStart(4, "0")}`;
  database.nextLeagueNumber += 1;
  return leagueId;
}

function createEventId() {
  const eventId = `EV-${String(database.nextEventNumber).padStart(4, "0")}`;
  database.nextEventNumber += 1;
  return eventId;
}

function createPromotionId() {
  const promotionId = `PR-${String(database.nextPromotionNumber).padStart(4, "0")}`;
  database.nextPromotionNumber += 1;
  return promotionId;
}

function hasRole(member, roleId) {
  return Boolean(member?.roles?.cache?.has(roleId));
}

function hasLeagueHostRole(member) {
  return hasRole(member, LEAGUE_HOST_ROLE_ID);
}

function hasHeadOfEventRole(member) {
  return hasRole(member, HEAD_OF_EVENT_ROLE_ID);
}

function hasHicomRole(member) {
  return hasRole(member, HICOM_ROLE_ID);
}

function hasDirectorRole(member) {
  return hasRole(member, DIRECTOR_ROLE_ID);
}

function hasCoOwnerRole(member) {
  return hasRole(member, CO_OWNER_ROLE_ID);
}

function hasOwnerRole(member) {
  return hasRole(member, OWNER_ROLE_ID);
}

function hasFounderRole(member) {
  return hasRole(member, FOUNDER_ROLE_ID);
}

function hasBloodlineRole(member) {
  return hasRole(member, BLOODLINE_ROLE_ID);
}

function hasPlusRole(member) {
  return hasRole(member, PLUS_ROLE_ID);
}

function canKickUser(member) {
  return hasHicomRole(member);
}

function canBanUser(member) {
  return hasDirectorRole(member) || hasCoOwnerRole(member) || hasOwnerRole(member) || hasFounderRole(member) || hasBloodlineRole(member) || hasPlusRole(member);
}

function canUsePromotionCommand(userId) {
  return PROMOTION_ALLOWED_USER_IDS.includes(userId);
}

function buildLeagueEmbed(league) {
  const maxPlayers = matchFormats[league.matchFormat];
  const spotsLeft = Math.max(maxPlayers - league.players.length, 0);
  const playerList = league.players.length
    ? league.players.map((playerId, index) => `${index + 1}. <@${playerId}>`).join("\n")
    : "No players yet";

  return new EmbedBuilder()
    .setColor(0x1f6feb)
    .setTitle("League Queue")
    .setDescription(`Use \`/league join league_id:${league.id}\` to join this league.`)
    .addFields(
      { name: "League ID", value: `\`${league.id}\``, inline: true },
      { name: "Match Format", value: league.matchFormat, inline: true },
      { name: "Match Type", value: matchTypeLabels[league.matchType], inline: true },
      { name: "Match Perks", value: perkLabels[league.matchPerks], inline: true },
      { name: "Region", value: regionLabels[league.region], inline: true },
      { name: "Host", value: `<@${league.hostId}>`, inline: true },
      { name: "Spots Left", value: `${spotsLeft}`, inline: true },
      { name: "Players", value: `${league.players.length}/${maxPlayers}`, inline: true },
      { name: "Cancel Command", value: `\`/league cancel league_id:${league.id}\``, inline: false },
      { name: "Current Players", value: playerList, inline: false }
    )
    .setFooter({ text: league.status === "full" ? "League is full." : "Waiting for players." })
    .setTimestamp(new Date(league.createdAt));
}

function buildCancelledEmbed(league) {
  return new EmbedBuilder()
    .setColor(0x8b949e)
    .setTitle("League Cancelled")
    .setDescription(`League \`${league.id}\` has been cancelled.`)
    .addFields(
      { name: "Match Format", value: league.matchFormat, inline: true },
      { name: "Match Type", value: matchTypeLabels[league.matchType], inline: true },
      { name: "Host", value: `<@${league.hostId}>`, inline: true }
    )
    .setTimestamp(new Date());
}

function buildLeagueStartedEmbed(league) {
  return new EmbedBuilder()
    .setColor(0x2ea043)
    .setTitle("League Ready")
    .setDescription("This league is now full. Use this private thread to organize the match.")
    .addFields(
      { name: "League ID", value: `\`${league.id}\``, inline: true },
      { name: "Match Format", value: league.matchFormat, inline: true },
      { name: "Match Type", value: matchTypeLabels[league.matchType], inline: true },
      { name: "Match Perks", value: perkLabels[league.matchPerks], inline: true },
      { name: "Region", value: regionLabels[league.region], inline: true },
      { name: "Players", value: league.players.map((playerId) => `<@${playerId}>`).join("\n"), inline: false }
    )
    .setTimestamp(new Date());
}

function buildEventSetupEmbed(event) {
  return new EmbedBuilder()
    .setColor(0x8957e5)
    .setTitle("Event Control Panel")
    .setDescription("Use the buttons below to start, cancel, or end this event.")
    .addFields(
      { name: "Event ID", value: `\`${event.id}\``, inline: true },
      { name: "Event Type", value: eventTypeLabels[event.type], inline: true },
      { name: "Status", value: event.status, inline: true },
      { name: "Host", value: `<@${event.hostId}>`, inline: true },
      { name: "Funder", value: event.funder, inline: true },
      { name: "Prize", value: event.prize, inline: true },
      { name: "Range", value: `${event.minimum}-${event.maximum}`, inline: true }
    )
    .setFooter({ text: "Only the event host or Head of Event can use these buttons." })
    .setTimestamp(new Date(event.createdAt));
}

function buildEventAnnouncementEmbed(event) {
  return new EmbedBuilder()
    .setColor(0xf2cc60)
    .setTitle("Guess the Number Event")
    .setDescription("How Does the Event Work?\nIn This Event, you'll try to guess a randomly selected number within the given range.\nThe first person to guess the correct number wins the prize!")
    .addFields(
      { name: "Event ID", value: `\`${event.id}\``, inline: true },
      { name: "Host", value: `<@${event.hostId}>`, inline: true },
      { name: "Funder", value: event.funder, inline: true },
      { name: "Prize", value: event.prize, inline: true },
      { name: "Range", value: `${event.minimum}-${event.maximum}`, inline: true },
      { name: "Participate In", value: `<#${GENERAL_CHANNEL_ID}>`, inline: true }
    )
    .setTimestamp(new Date());
}

function buildEventEndedEmbed(event) {
  const winnerText = event.winnerId ? `<@${event.winnerId}>` : "No winner recorded";
  return new EmbedBuilder()
    .setColor(0x2ea043)
    .setTitle("Event Ended")
    .setDescription(`Event \`${event.id}\` has ended.`)
    .addFields(
      { name: "Event Type", value: eventTypeLabels[event.type], inline: true },
      { name: "Host", value: `<@${event.hostId}>`, inline: true },
      { name: "Winner", value: winnerText, inline: true },
      { name: "Number", value: `${event.number}`, inline: true }
    )
    .setTimestamp(new Date());
}

function buildEventHistoryEmbed(event) {
  const winnerText = event.winnerId ? `<@${event.winnerId}>` : "No winner recorded";
  const guessedAt = event.wonAt ? `<t:${Math.floor(new Date(event.wonAt).getTime() / 1000)}:F>` : "Not guessed";
  const endedAt = event.endedAt ? `<t:${Math.floor(new Date(event.endedAt).getTime() / 1000)}:F>` : "Not ended";

  return new EmbedBuilder()
    .setColor(0x1f6feb)
    .setTitle("Event History")
    .setDescription(`Saved record for event \`${event.id}\`.`)
    .addFields(
      { name: "Event Type", value: eventTypeLabels[event.type] || event.type, inline: true },
      { name: "Status", value: event.status, inline: true },
      { name: "Host", value: `<@${event.hostId}>`, inline: true },
      { name: "Funder", value: event.funder || "Not set", inline: true },
      { name: "Prize", value: event.prize || "Not set", inline: true },
      { name: "Range", value: `${event.minimum}-${event.maximum}`, inline: true },
      { name: "Winner", value: winnerText, inline: true },
      { name: "Winning Number", value: `${event.number}`, inline: true },
      { name: "Guessed At", value: guessedAt, inline: false },
      { name: "Ended At", value: endedAt, inline: false }
    )
    .setTimestamp(new Date(event.createdAt));
}

function formatDuration(ms) {
  if (ms <= 0) return "Now";
  const totalMinutes = Math.ceil(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes || !parts.length) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  return parts.join(", ");
}

function formatDiscordTimestamp(date) {
  return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}

function parsePromotionDate(dateText) {
  const match = String(dateText).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const yearInput = Number(match[3]);
  const year = yearInput < 100 ? 2000 + yearInput : yearInput;
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
}

function parsePromotionTime(timeText) {
  if (!timeText) return null;
  const cleanTime = String(timeText).trim().toLowerCase();
  const match = cleanTime.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3];
  if (minute < 0 || minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
  } else if (hour < 0 || hour > 23) {
    return null;
  }
  return { hour, minute };
}

function isSameDate(firstDate, secondDate) {
  return firstDate.getFullYear() === secondDate.getFullYear()
    && firstDate.getMonth() === secondDate.getMonth()
    && firstDate.getDate() === secondDate.getDate();
}

function buildPromotionStart(dateText, timeText, daysLeft) {
  const now = new Date();
  let startDate;

  if (Number.isInteger(daysLeft) && daysLeft >= 0) {
    startDate = new Date(now.getTime() + daysLeft * 24 * 60 * 60 * 1000);
  } else {
    startDate = parsePromotionDate(dateText);
    if (!startDate) {
      return { error: "Enter the date as day/month/year, like 22/3/26." };
    }
  }

  const parsedDate = parsePromotionDate(dateText);
  if (parsedDate && (!Number.isInteger(daysLeft) || daysLeft < 0)) {
    startDate = parsedDate;
  }

  const parsedTime = parsePromotionTime(timeText);
  if (timeText && !parsedTime) {
    return { error: "Enter time as 14:30, 14, 2pm, or 2:30pm." };
  }

  if (isSameDate(startDate, now) && !parsedTime) {
    return { error: "If the promotion is today, you need to write the time." };
  }

  if (parsedTime) {
    startDate.setHours(parsedTime.hour, parsedTime.minute, 0, 0);
  } else {
    startDate.setHours(0, 0, 0, 0);
  }

  if (startDate.getTime() <= now.getTime()) {
    return { error: "Promotion time must be in the future." };
  }

  return { startDate };
}

function getPromotionStatus(promotion, now = new Date()) {
  const startDate = new Date(promotion.startAt);
  const endDate = new Date(promotion.endAt);
  if (promotion.remindedAt && now >= endDate) return "completed";
  if (now >= startDate && now < endDate) return "active";
  if (now < startDate) return "scheduled";
  return "completed";
}

function promotionOverlaps(startDate, endDate) {
  return Object.values(database.promotions).find((promotion) => {
    if (promotion.status === "cancelled") return false;
    const existingStart = new Date(promotion.startAt);
    const existingEnd = new Date(promotion.endAt);
    return existingStart < endDate && startDate < existingEnd;
  });
}

function buildPromotionScheduleEmbed(promotion) {
  const startDate = new Date(promotion.startAt);
  const endDate = new Date(promotion.endAt);
  const status = getPromotionStatus(promotion);

  return new EmbedBuilder()
    .setColor(0x8957e5)
    .setTitle("Promotion Scheduled")
    .addFields(
      { name: "Promotion ID", value: `\`${promotion.id}\``, inline: true },
      { name: "Server Name", value: promotion.serverName, inline: true },
      { name: "Status", value: status, inline: true },
      { name: "Starts", value: formatDiscordTimestamp(startDate), inline: false },
      { name: "Ends", value: formatDiscordTimestamp(endDate), inline: false },
      { name: "Duration", value: `${promotion.durationDays} day${promotion.durationDays === 1 ? "" : "s"}`, inline: true },
      { name: "Countdown", value: status === "active" ? `${formatDuration(endDate - new Date())} left` : `${formatDuration(startDate - new Date())} until start`, inline: true },
      { name: "Scheduled By", value: `<@${promotion.createdBy}>`, inline: true }
    )
    .setTimestamp(new Date(promotion.createdAt));
}

function buildPromotionListEmbed() {
  const now = new Date();
  const promotions = Object.values(database.promotions)
    .filter((promotion) => promotion.status !== "cancelled")
    .sort((first, second) => new Date(first.startAt) - new Date(second.startAt));

  const activePromotions = promotions.filter((promotion) => getPromotionStatus(promotion, now) === "active");
  const upcomingPromotions = promotions.filter((promotion) => getPromotionStatus(promotion, now) === "scheduled");
  const nextPromotion = upcomingPromotions[0];

  const embed = new EmbedBuilder()
    .setColor(0x1f6feb)
    .setTitle("Promotion Timings")
    .setDescription(promotions.length ? "All scheduled promotions are listed below." : "No promotions are scheduled right now.")
    .addFields(
      { name: "Going On Right Now", value: activePromotions.length ? activePromotions.map((promotion) => `${promotion.serverName} (\`${promotion.id}\`) ends in ${formatDuration(new Date(promotion.endAt) - now)}`).join("\n") : "None", inline: false },
      { name: "Next Promotion", value: nextPromotion ? `${nextPromotion.serverName} (\`${nextPromotion.id}\`) starts in ${formatDuration(new Date(nextPromotion.startAt) - now)}` : "None", inline: false }
    )
    .setTimestamp(new Date());

  if (promotions.length) {
    const lines = promotions.map((promotion) => {
      const status = getPromotionStatus(promotion, now);
      const startDate = new Date(promotion.startAt);
      const endDate = new Date(promotion.endAt);
      const countdown = status === "active" ? `${formatDuration(endDate - now)} left` : status === "scheduled" ? `${formatDuration(startDate - now)} until start` : "Completed";
      return `\`${promotion.id}\` ${promotion.serverName} — ${status} �� ${countdown}`;
    });
    embed.addFields({ name: "All Promotions", value: lines.slice(0, 20).join("\n"), inline: false });
  }

  return embed;
}

function leagueJoinButton(leagueId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`league_join:${leagueId}`)
      .setLabel("Join League")
      .setStyle(ButtonStyle.Primary)
  );
}

function disabledLeagueJoinButton(leagueId, label = "League Closed") {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`league_join:${leagueId}`)
      .setLabel(label)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );
}

function eventControlButtons(eventId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_start:${eventId}`)
      .setLabel("Start")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`event_cancel:${eventId}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`event_end:${eventId}`)
      .setLabel("End")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled)
  );
}

function parseRange(rangeText) {
  const numbers = String(rangeText).match(/\d+/g)?.map(Number) || [];
  if (numbers.length < 2) return null;

  const minimum = Math.min(numbers[0], numbers[1]);
  const maximum = Math.max(numbers[0], numbers[1]);
  if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum === maximum) return null;

  return { minimum, maximum };
}

function randomNumberBetween(minimum, maximum) {
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

function extractGuesses(messageContent) {
  return String(messageContent).match(/\b\d+\b/g)?.map(Number) || [];
}

function sanitizeBotReply(reply) {
  const blockedWords = ["fuck", "fucking", "shit", "bitch", "bastard", "asshole", "dick", "pussy", "cunt"];
  let safeReply = reply;
  for (const word of blockedWords) {
    safeReply = safeReply.replace(new RegExp(`\\b${word}\\b`, "gi"), "that word");
  }
  return safeReply.slice(0, 1800);
}

function buildMentionReply(content) {
  const cleanContent = content.replace(/<@!?\d+>/g, "").trim();
  if (!cleanContent) return "Hello! What would you like to talk about?";

  const lower = cleanContent.toLowerCase();
  const includesAny = (words) => words.some((word) => lower.includes(word));

  // Check specific phrases FIRST before general ones
  if (includesAny(["how are you", "how r you", "wyd", "what are you doing"])) return "I am doing good, just chilling here and helping out. What about you?";
  if (includesAny(["hello", "hi", "hey", "yo", "sup"])) return "Hello! What would you like to talk about?";
  if (includesAny(["good morning", "gm"])) return "Good morning! Hope your day starts well. What are we talking about?";
  if (includesAny(["good night", "gn"])) return "Good night! Rest well, and I will be here when you are back.";
  if (includesAny(["thanks", "thank you", "ty"])) return "No problem! Happy to help.";
  if (includesAny(["bye", "goodbye", "cya", "see you"])) return "See you! Come back anytime.";
  if (includesAny(["league"])) return "Yeah, leagues are handled here. Hosts can make them, players can join, and the bot keeps it organized.";
  if (includesAny(["event", "guess"])) return "Events are pretty simple: staff starts one, people participate, and I track the important parts.";
  if (includesAny(["promotion", "promo"])) return "Promotion timings are like a schedule board. They show what is active, what is next, and how long is left.";
  if (includesAny(["prize"])) return "The prize depends on what the host sets. If there is an event running, check the event post for the exact prize.";
  if (includesAny(["number"])) return "If this is about Guess the Number, send up to 2 numbers at once in general chat when the event is active.";
  if (includesAny(["sad", "upset", "mad", "angry", "annoyed"])) return "Yeah, that sounds rough. Want to talk about what happened?";
  if (includesAny(["happy", "excited", "nice", "great", "cool"])) return "Nice, that sounds good. Tell me more.";
  if (includesAny(["stupid", "dumb"])) return "That sounds annoying, but we can keep it calm. What happened?";
  if (includesAny(["help", "command"])) return "Sure, I can help. Ask me about leagues, events, promotions, or just tell me what you are trying to do.";
  if (lower.endsWith("?")) return `Good question. About "${cleanContent}", I would say it depends on what you mean exactly. Tell me a bit more and I will try to help.`;

  return `I hear you. About "${cleanContent}", that sounds interesting. Tell me more about it.`;
}

async function updateLeagueMessage(client, league) {
  if (!league.messageId) return;

  const channel = await client.channels.fetch(LEAGUE_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const message = await channel.messages.fetch(league.messageId).catch(() => null);
  if (!message) return;

  const components = league.status === "open"
    ? [leagueJoinButton(league.id)]
    : [disabledLeagueJoinButton(league.id, league.status === "full" ? "League Full" : "League Closed")];

  await message.edit({ embeds: [buildLeagueEmbed(league)], components }).catch(console.error);
}

async function createPrivateLeagueThread(message, league) {
  const threadName = `${league.id} ${league.matchFormat} ${matchTypeLabels[league.matchType]}`;

  const thread = await message.channel.threads.create({
    name: threadName.slice(0, 100),
    autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
    type: ChannelType.PrivateThread,
    reason: `Private thread for league ${league.id}`
  });

  league.threadId = thread.id;
  await thread.members.add(league.hostId).catch(console.error);
  await thread.send({
    content: `<@${league.hostId}>`,
    embeds: [new EmbedBuilder()
      .setColor(0x1f6feb)
      .setTitle("Private League Thread")
      .setDescription(`This private thread is for league \`${league.id}\`. Players who join the league will be added here automatically.`)
      .addFields(
        { name: "Join Command", value: `\`/league join league_id:${league.id}\`` },
        { name: "Cancel Command", value: `\`/league cancel league_id:${league.id}\`` }
      )]
  }).catch(console.error);
}

async function addPlayerToThread(client, league, playerId) {
  if (!league.threadId) return;
  const thread = await client.channels.fetch(league.threadId).catch(() => null);
  if (!thread || !thread.members) return;
  await thread.members.add(playerId).catch(console.error);
}

async function closeLeagueThread(client, league, reason) {
  if (!league.threadId) return;
  const thread = await client.channels.fetch(league.threadId).catch(() => null);
  if (!thread) return;

  await thread.send(reason).catch(() => null);
  await thread.setLocked(true, reason).catch(() => null);
  await thread.setArchived(true, reason).catch(() => null);
}

async function startLeagueIfFull(client, league) {
  const maxPlayers = matchFormats[league.matchFormat];
  if (league.players.length < maxPlayers || league.status === "full") return;

  league.status = "full";
  saveDatabase(database);

  const thread = league.threadId ? await client.channels.fetch(league.threadId).catch(() => null) : null;
  if (thread) {
    await thread.send({
      content: league.players.map((playerId) => `<@${playerId}>`).join(" "),
      embeds: [buildLeagueStartedEmbed(league)]
    }).catch(console.error);
  }

  await updateLeagueMessage(client, league);
}

async function lockGeneralChannel(client) {
  const channel = await client.channels.fetch(GENERAL_CHANNEL_ID).catch(() => null);
  if (!channel || !channel.guild) return false;
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
    SendMessages: false
  }, { reason: "Guess the Number event winner found" });
  return true;
}

async function unlockGeneralChannel(client) {
  const channel = await client.channels.fetch(GENERAL_CHANNEL_ID).catch(() => null);
  if (!channel || !channel.guild) return false;
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
    SendMessages: null
  }, { reason: "Guess the Number event ended" });
  return true;
}

async function updateEventControlMessage(client, event, disabled = false) {
  if (!event.controlChannelId || !event.controlMessageId) return;
  const channel = await client.channels.fetch(event.controlChannelId).catch(() => null);
  if (!channel) return;
  const message = await channel.messages.fetch(event.controlMessageId).catch(() => null);
  if (!message) return;
  await message.edit({ embeds: [buildEventSetupEmbed(event)], components: [eventControlButtons(event.id, disabled)] }).catch(console.error);
}

async function startEvent(interaction, event) {
  if (event.status !== "created") {
    await interaction.reply({ content: "This event cannot be started right now.", ephemeral: true });
    return;
  }

  event.status = "started";
  event.startedAt = new Date().toISOString();
  saveDatabase(database);

  const eventChannel = await interaction.client.channels.fetch(EVENT_CHANNEL_ID).catch(() => null);
  if (!eventChannel) {
    await interaction.reply({ content: "Event channel could not be found.", ephemeral: true });
    return;
  }

  const announcement = await eventChannel.send({
    content: `@here <@&${GIVEAWAY_PING_ROLE_ID}>`,
    embeds: [buildEventAnnouncementEmbed(event)],
    allowedMentions: { parse: ["everyone"], roles: [GIVEAWAY_PING_ROLE_ID] }
  });

  event.announcementMessageId = announcement.id;
  saveDatabase(database);
  await updateEventControlMessage(interaction.client, event);
  await interaction.reply({ content: `Event ${event.id} has started. Guesses are now open in <#${GENERAL_CHANNEL_ID}>.`, ephemeral: true });
}

async function cancelEvent(interaction, event) {
  if (["ended", "cancelled"].includes(event.status)) {
    await interaction.reply({ content: "This event is already closed.", ephemeral: true });
    return;
  }

  event.status = "cancelled";
  event.cancelledBy = interaction.user.id;
  event.cancelledAt = new Date().toISOString();
  saveDatabase(database);

  await unlockGeneralChannel(interaction.client).catch(console.error);
  await updateEventControlMessage(interaction.client, event, true);
  await interaction.reply({ content: `Event ${event.id} has been cancelled.`, ephemeral: true });
}

async function endEvent(interaction, event) {
  if (["ended", "cancelled"].includes(event.status)) {
    await interaction.reply({ content: "This event is already closed.", ephemeral: true });
    return;
  }

  event.status = "ended";
  event.endedBy = interaction.user.id;
  event.endedAt = new Date().toISOString();
  saveDatabase(database);

  await unlockGeneralChannel(interaction.client).catch(console.error);
  await updateEventControlMessage(interaction.client, event, true);

  const eventChannel = await interaction.client.channels.fetch(EVENT_CHANNEL_ID).catch(() => null);
  if (eventChannel) {
    await eventChannel.send({ embeds: [buildEventEndedEmbed(event)] }).catch(console.error);
  }

  await interaction.reply({ content: `Event ${event.id} has ended and general chat has been unlocked.`, ephemeral: true });
}

async function handleHostLeague(interaction) {
  if (interaction.channelId !== LEAGUE_CHANNEL_ID) {
    await interaction.reply({ content: `Leagues can only be hosted in <#${LEAGUE_CHANNEL_ID}>.`, ephemeral: true });
    return;
  }

  if (!hasLeagueHostRole(interaction.member)) {
    await interaction.reply({ content: "Only league hosts can host leagues.", ephemeral: true });
    return;
  }

  const matchFormat = interaction.options.getString("match_format", true);
  const matchType = interaction.options.getString("match_type", true);
  const matchPerks = interaction.options.getString("match_perks", true);
  const region = interaction.options.getString("region", true);
  const leagueId = createLeagueId();

  const league = {
    id: leagueId,
    hostId: interaction.user.id,
    channelId: LEAGUE_CHANNEL_ID,
    messageId: null,
    threadId: null,
    matchFormat,
    matchType,
    matchPerks,
    region,
    players: [interaction.user.id],
    status: "open",
    createdAt: new Date().toISOString()
  };

  database.leagues[leagueId] = league;
  saveDatabase(database);

  await interaction.reply({ content: "League created.", ephemeral: true });

  const leagueMessage = await interaction.channel.send({
    content: `<@&${LEAGUE_PING_ROLE_ID}>`,
    embeds: [buildLeagueEmbed(league)],
    components: [leagueJoinButton(league.id)],
    allowedMentions: { roles: [LEAGUE_PING_ROLE_ID] }
  });

  league.messageId = leagueMessage.id;
  saveDatabase(database);

  await createPrivateLeagueThread(leagueMessage, league).catch(async (error) => {
    console.error("Failed to create private league thread:", error);
    await interaction.followUp({
      content: "League posted, but the private thread could not be created. Check the bot's private thread permissions.",
      ephemeral: true
    }).catch(() => null);
  });

  saveDatabase(database);
}

async function handleJoinLeague(interaction, leagueIdOverride = null) {
  const leagueId = leagueIdOverride || interaction.options.getString("league_id", true).trim().toUpperCase();
  const league = database.leagues[leagueId];

  if (!league || league.status === "cancelled") {
    await interaction.reply({ content: "No active league was found with that ID.", ephemeral: true });
    return;
  }

  if (league.status !== "open") {
    await interaction.reply({ content: "This league is not open for new players.", ephemeral: true });
    return;
  }

  if (league.players.includes(interaction.user.id)) {
    await interaction.reply({ content: "You are already in this league.", ephemeral: true });
    return;
  }

  const maxPlayers = matchFormats[league.matchFormat];
  if (league.players.length >= maxPlayers) {
    league.status = "full";
    saveDatabase(database);
    await updateLeagueMessage(interaction.client, league);
    await interaction.reply({ content: "This league is already full.", ephemeral: true });
    return;
  }

  league.players.push(interaction.user.id);
  saveDatabase(database);

  await addPlayerToThread(interaction.client, league, interaction.user.id);
  await updateLeagueMessage(interaction.client, league);
  await startLeagueIfFull(interaction.client, league);

  await interaction.reply({ content: `You joined league ${league.id}.`, ephemeral: true });
}

async function handleCancelLeague(interaction) {
  if (!hasLeagueHostRole(interaction.member)) {
    await interaction.reply({ content: "Only league hosts can cancel leagues.", ephemeral: true });
    return;
  }

  const leagueId = interaction.options.getString("league_id", true).trim().toUpperCase();
  const league = database.leagues[leagueId];

  if (!league || league.status === "cancelled") {
    await interaction.reply({ content: "No active league was found with that ID.", ephemeral: true });
    return;
  }

  league.status = "cancelled";
  league.cancelledBy = interaction.user.id;
  league.cancelledAt = new Date().toISOString();
  saveDatabase(database);

  const channel = await interaction.client.channels.fetch(LEAGUE_CHANNEL_ID).catch(() => null);
  if (channel && league.messageId) {
    const message = await channel.messages.fetch(league.messageId).catch(() => null);
    if (message) {
      await message.edit({
        content: "",
        embeds: [buildCancelledEmbed(league)],
        components: [disabledLeagueJoinButton(league.id, "League Cancelled")]
      }).catch(console.error);
    }
  }

  await closeLeagueThread(interaction.client, league, `League ${league.id} was cancelled.`);
  await interaction.reply({ content: `League ${league.id} has been cancelled.`, ephemeral: true });
}

async function handleHostEvent(interaction) {
  if (interaction.channelId !== EVENT_CHANNEL_ID) {
    await interaction.reply({ content: `Events can only be hosted in <#${EVENT_CHANNEL_ID}>.`, ephemeral: true });
    return;
  }

  if (!hasHeadOfEventRole(interaction.member)) {
    await interaction.reply({ content: "Only Head of Event members can host events.", ephemeral: true });
    return;
  }

  const eventType = interaction.options.getString("event_type", true);
  const hostUser = interaction.options.getUser("host", true);
  const funder = interaction.options.getString("funder", true).trim();
  const prize = interaction.options.getString("prize", true).trim();
  const rangeText = interaction.options.getString("range", true).trim();
  const parsedRange = parseRange(rangeText);

  if (!parsedRange) {
    await interaction.reply({ content: "Enter a valid range with two different numbers, like 1-1000 or 200-300.", ephemeral: true });
    return;
  }

  const eventId = createEventId();
  const number = randomNumberBetween(parsedRange.minimum, parsedRange.maximum);
  const event = {
    id: eventId,
    type: eventType,
    status: "created",
    hostId: hostUser.id,
    createdBy: interaction.user.id,
    funder,
    prize,
    minimum: parsedRange.minimum,
    maximum: parsedRange.maximum,
    number,
    winnerId: null,
    winningMessageId: null,
    controlChannelId: interaction.channelId,
    controlMessageId: null,
    announcementMessageId: null,
    createdAt: new Date().toISOString()
  };

  database.events[eventId] = event;
  saveDatabase(database);

  const reply = await interaction.reply({
    embeds: [buildEventSetupEmbed(event)],
    components: [eventControlButtons(event.id)],
    fetchReply: true
  });

  event.controlMessageId = reply.id;
  saveDatabase(database);

  await hostUser.send(`Your event ${event.id} has been created. The selected number is ${event.number}. Use this ID with /endevent when you want to fully end it.`).catch(() => null);

  if (hostUser.id !== interaction.user.id) {
    await interaction.user.send(`Event ${event.id} was created for <@${hostUser.id}>. The selected number is ${event.number}.`).catch(() => null);
  }
}

async function handleEndEventCommand(interaction) {
  if (!hasHeadOfEventRole(interaction.member)) {
    await interaction.reply({ content: "Only Head of Event members can end events.", ephemeral: true });
    return;
  }

  const eventId = interaction.options.getString("event_id", true).trim().toUpperCase();
  const event = database.events[eventId];

  if (!event) {
    await interaction.reply({ content: "No event was found with that ID.", ephemeral: true });
    return;
  }

  await endEvent(interaction, event);
}

async function handleEventHistoryCommand(interaction) {
  if (!hasHeadOfEventRole(interaction.member)) {
    await interaction.reply({ content: "Only Head of Event members can check event history.", ephemeral: true });
    return;
  }

  const eventId = interaction.options.getString("event_id", true).trim().toUpperCase();
  const event = database.events[eventId];

  if (!event) {
    await interaction.reply({ content: "No event was found with that ID.", ephemeral: true });
    return;
  }

  await interaction.reply({ embeds: [buildEventHistoryEmbed(event)], ephemeral: true });
}

async function handlePromotionSchedule(interaction) {
  if (!canUsePromotionCommand(interaction.user.id)) {
    await interaction.reply({ content: "Only approved promotion managers can use this command.", ephemeral: true });
    return;
  }

  const serverName = interaction.options.getString("server_name", true).trim();
  const dateText = interaction.options.getString("date", true).trim();
  const timeText = interaction.options.getString("time", false)?.trim() || null;
  const daysLeft = interaction.options.getInteger("days_left", false);
  const durationDays = interaction.options.getInteger("duration_days", true);

  if (durationDays < 1) {
    await interaction.reply({ content: "Duration must be at least 1 day.", ephemeral: true });
    return;
  }

  const startResult = buildPromotionStart(dateText, timeText, daysLeft);
  if (startResult.error) {
    await interaction.reply({ content: startResult.error, ephemeral: true });
    return;
  }

  const startDate = startResult.startDate;
  const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const overlappingPromotion = promotionOverlaps(startDate, endDate);

  if (overlappingPromotion) {
    await interaction.reply({ content: "A promotion is already happening on this exact time, please write a new time!", ephemeral: true });
    return;
  }

  const promotionId = createPromotionId();
  const promotion = {
    id: promotionId,
    serverName,
    startAt: startDate.toISOString(),
    endAt: endDate.toISOString(),
    durationDays,
    createdBy: interaction.user.id,
    createdAt: new Date().toISOString(),
    remindedAt: null,
    status: "scheduled"
  };

  database.promotions[promotionId] = promotion;
  saveDatabase(database);

  await interaction.reply({ embeds: [buildPromotionScheduleEmbed(promotion)], ephemeral: true });
}

async function handlePromotionList(interaction) {
  if (!canUsePromotionCommand(interaction.user.id)) {
    await interaction.reply({ content: "Only approved promotion managers can use this command.", ephemeral: true });
    return;
  }

  await interaction.reply({ embeds: [buildPromotionListEmbed()], ephemeral: true });
}

async function handlePromotionTimings(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "schedule") {
    await handlePromotionSchedule(interaction);
    return;
  }

  if (subcommand === "list") {
    await handlePromotionList(interaction);
  }
}

async function handleChannelLock(interaction, shouldLock) {
  if (!hasHicomRole(interaction.member)) {
    await interaction.reply({ content: "Only hicom members can lock or unlock channels.", ephemeral: true });
    return;
  }

  const targetChannel = interaction.options.getChannel("channel", false) || interaction.channel;
  if (!targetChannel || !targetChannel.guild || !targetChannel.permissionOverwrites) {
    await interaction.reply({ content: "That channel cannot be locked or unlocked.", ephemeral: true });
    return;
  }

  await targetChannel.permissionOverwrites.edit(targetChannel.guild.roles.everyone, {
    SendMessages: shouldLock ? false : null
  }, { reason: `${shouldLock ? "Locked" : "Unlocked"} by ${interaction.user.tag}` });

  await interaction.reply({
    content: shouldLock ? `<#${targetChannel.id}> has been locked.` : `<#${targetChannel.id}> has been unlocked.`,
    allowedMentions: { parse: [] }
  });
}

async function handleEventButton(interaction, action, eventId) {
  if (!hasHeadOfEventRole(interaction.member)) {
    await interaction.reply({ content: "Only Head of Event members can use event controls.", ephemeral: true });
    return;
  }

  const event = database.events[eventId];
  if (!event) {
    await interaction.reply({ content: "No event was found with that ID.", ephemeral: true });
    return;
  }

  if (action === "start") {
    await startEvent(interaction, event);
    return;
  }

  if (action === "cancel") {
    await cancelEvent(interaction, event);
    return;
  }

  if (action === "end") {
    await endEvent(interaction, event);
  }
}

function getActiveGuessEvent() {
  return Object.values(database.events).find((event) => event.type === "guess_the_number" && event.status === "started");
}

async function handleGuessMessage(message) {
  if (message.channelId !== GENERAL_CHANNEL_ID || message.author.bot) return;

  const event = getActiveGuessEvent();
  if (!event || event.winnerId) return;

  const guesses = extractGuesses(message.content);
  if (!guesses.length) return;

  if (guesses.length > 2) {
    await message.reply("You cannot say more than 2 numbers at once.").catch(() => null);
    return;
  }

  if (!guesses.includes(event.number)) return;

  event.winnerId = message.author.id;
  event.winningMessageId = message.id;
  event.status = "winner_found";
  event.wonAt = new Date().toISOString();
  saveDatabase(database);

  await lockGeneralChannel(message.client).catch(console.error);

  const host = await message.client.users.fetch(event.hostId).catch(() => null);
  if (host) {
    await host.send(`<@${message.author.id}> has won the event! The number ${event.number} was guessed! Event ID: ${event.id}`).catch(() => null);
  }

  await message.author.send(`You won the event! The number ${event.number} was guessed. The host has been notified.`).catch(() => null);
  await message.reply("Correct guess recorded. General chat has been locked until the host ends the event.").catch(() => null);
}

async function handleMentionMessage(message) {
  if (message.author.bot || !message.mentions.users.has(message.client.user.id)) return;

  const cleanContent = message.content.replace(/<@!?\d+>/g, "").trim().toLowerCase();
  const wantsUnlock = /\b(unlock|open)\b/.test(cleanContent);
  const wantsLock = !wantsUnlock && /\b(lock|close)\b/.test(cleanContent);

  if (wantsLock || wantsUnlock) {
    if (!hasHicomRole(message.member)) {
      await message.reply("Only hicom members can ask me to lock or unlock channels.").catch(console.error);
      return;
    }

    const targetChannel = message.mentions.channels.first() || message.channel;
    if (!targetChannel || !targetChannel.guild || !targetChannel.permissionOverwrites) {
      await message.reply("I cannot lock or unlock that channel.").catch(console.error);
      return;
    }

    await targetChannel.permissionOverwrites.edit(targetChannel.guild.roles.everyone, {
      SendMessages: wantsLock ? false : null
    }, { reason: `${wantsLock ? "Locked" : "Unlocked"} by ${message.author.tag} through bot mention` });

    await message.reply(wantsLock ? `<#${targetChannel.id}> has been locked.` : `<#${targetChannel.id}> has been unlocked.`).catch(console.error);
    return;
  }

  const reply = sanitizeBotReply(buildMentionReply(message.content));
  await message.reply(reply).catch(console.error);
  return;
}

async function handleKickCommand(message, targetUser) {
  if (!canKickUser(message.member)) {
    await message.reply("You don't have permission to kick users.").catch(() => null);
    return;
  }

  if (!targetUser) {
    await message.reply("Please mention a user to kick.").catch(() => null);
    return;
  }

  const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
  if (!targetMember) {
    await message.reply("I cannot find that user in this server.").catch(() => null);
    return;
  }

  try {
    await targetMember.kick(`Kicked by ${message.author.tag}`);
    await message.reply(`<@${targetUser.id}> has been kicked from the server.`).catch(() => null);
  } catch (error) {
    console.error("Kick error:", error);
    await message.reply("I couldn't kick that user. They may have higher permissions than me.").catch(() => null);
  }
}

async function handleBanCommand(message, targetUser, isHardban = false) {
  if (!canBanUser(message.member)) {
    await message.reply("You don't have permission to ban users.").catch(() => null);
    return;
  }

  if (!targetUser) {
    await message.reply("Please mention a user to ban.").catch(() => null);
    return;
  }

  try {
    const deleteMessageDays = isHardban ? 7 : 0;
    await message.guild.bans.create(targetUser.id, {
      reason: `${isHardban ? "Hardban" : "Ban"} by ${message.author.tag}`,
      deleteMessageSeconds: deleteMessageDays * 24 * 60 * 60
    });
    await message.reply(`<@${targetUser.id}> has been ${isHardban ? "hardban" : "ban"}ned from the server.`).catch(() => null);
  } catch (error) {
    console.error("Ban error:", error);
    await message.reply("I couldn't ban that user.").catch(() => null);
  }
}

async function checkPromotionReminders(client) {
  const now = new Date();
  let changed = false;

  for (const promotion of Object.values(database.promotions)) {
    if (promotion.status === "cancelled" || promotion.remindedAt) continue;
    const startDate = new Date(promotion.startAt);
    if (now < startDate) continue;

    promotion.status = "active";
    promotion.remindedAt = now.toISOString();
    changed = true;

    const scheduler = await client.users.fetch(promotion.createdBy).catch(() => null);
    if (scheduler) {
      await scheduler.send({
        content: `It is time for the promotion of ${promotion.serverName}. Please start the promotion now!`,
        embeds: [buildPromotionScheduleEmbed(promotion)]
      }).catch(() => null);
    }
  }

  if (changed) saveDatabase(database);
}

const leagueCommand = new SlashCommandBuilder()
  .setName("league")
  .setDescription("Host, join, or cancel a league.")
  .addSubcommand((subcommand) => subcommand
    .setName("host")
    .setDescription("Host a new league.")
    .addStringOption((option) => option
      .setName("match_format")
      .setDescription("Choose the match format.")
      .setRequired(true)
      .addChoices(
        { name: "2v2", value: "2v2" },
        { name: "3v3", value: "3v3" },
        { name: "4v4", value: "4v4" }
      ))
    .addStringOption((option) => option
      .setName("match_type")
      .setDescription("Choose the match type.")
      .setRequired(true)
      .addChoices(
        { name: "Swift Game", value: "swift_game" },
        { name: "War Game", value: "war_game" }
      ))
    .addStringOption((option) => option
      .setName("match_perks")
      .setDescription("Choose whether perks are enabled.")
      .setRequired(true)
      .addChoices(
        { name: "Perks", value: "perks" },
        { name: "No Perks", value: "no_perks" }
      ))
    .addStringOption((option) => option
      .setName("region")
      .setDescription("Choose the league region.")
      .setRequired(true)
      .addChoices(
        { name: "Europe", value: "europe" },
        { name: "Asia", value: "asia" },
        { name: "North America", value: "north_america" },
        { name: "South America", value: "south_america" },
        { name: "Ocean", value: "ocean" }
      )))
  .addSubcommand((subcommand) => subcommand
    .setName("join")
    .setDescription("Join an active league.")
    .addStringOption((option) => option
      .setName("league_id")
      .setDescription("Enter the league ID.")
      .setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName("cancel")
    .setDescription("Cancel an active league.")
    .addStringOption((option) => option
      .setName("league_id")
      .setDescription("Enter the league ID.")
      .setRequired(true)))
  .setDMPermission(false);

const hostEventCommand = new SlashCommandBuilder()
  .setName("hostevent")
  .setDescription("Create an event control panel.")
  .addStringOption((option) => option
    .setName("event_type")
    .setDescription("Choose the event type.")
    .setRequired(true)
    .addChoices({ name: "Guess the Number", value: "guess_the_number" }))
  .addUserOption((option) => option
    .setName("host")
    .setDescription("Choose the event host.")
    .setRequired(true))
  .addStringOption((option) => option
    .setName("funder")
    .setDescription("Enter the event funder.")
    .setRequired(true))
  .addStringOption((option) => option
    .setName("prize")
    .setDescription("Enter the event prize.")
    .setRequired(true))
  .addStringOption((option) => option
    .setName("range")
    .setDescription("Enter the number range, like 1-1000 or 200-300.")
    .setRequired(true))
  .setDMPermission(false);

const endEventCommand = new SlashCommandBuilder()
  .setName("endevent")
  .setDescription("End an active event and unlock general chat.")
  .addStringOption((option) => option
    .setName("event_id")
    .setDescription("Enter the event ID.")
    .setRequired(true))
  .setDMPermission(false);

const eventHistoryCommand = new SlashCommandBuilder()
  .setName("eventhistory")
  .setDescription("Check a saved event winner and details by event ID.")
  .addStringOption((option) => option
    .setName("event_id")
    .setDescription("Enter the event ID.")
    .setRequired(true))
  .setDMPermission(false);

const promotionTimingsCommand = new SlashCommandBuilder()
  .setName("promotiontimings")
  .setDescription("Promotion timings and schedules.")
  .addSubcommand((subcommand) => subcommand
    .setName("schedule")
    .setDescription("Select the promotion timings.")
    .addStringOption((option) => option
      .setName("server_name")
      .setDescription("Enter the promoted server name.")
      .setRequired(true))
    .addStringOption((option) => option
      .setName("date")
      .setDescription("Enter the promotion date, like 22/3/26.")
      .setRequired(true))
    .addIntegerOption((option) => option
      .setName("duration_days")
      .setDescription("Enter how many days the promotion will last.")
      .setRequired(true)
      .setMinValue(1))
    .addStringOption((option) => option
      .setName("time")
      .setDescription("Enter the time if needed, like 14:30, 14, 2pm, or 2:30pm.")
      .setRequired(false))
    .addIntegerOption((option) => option
      .setName("days_left")
      .setDescription("Optional: amount of days left until the promotion starts.")
      .setRequired(false)
      .setMinValue(0)))
  .addSubcommand((subcommand) => subcommand
    .setName("list")
    .setDescription("Show all promotion timings."))
  .setDMPermission(false);

const lockCommand = new SlashCommandBuilder()
  .setName("lock")
  .setDescription("Lock a channel so members cannot send messages.")
  .addChannelOption((option) => option
    .setName("channel")
    .setDescription("Choose a channel. Leave empty to lock this channel.")
    .setRequired(false)
    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
  .setDMPermission(false);

const unlockCommand = new SlashCommandBuilder()
  .setName("unlock")
  .setDescription("Unlock a channel so members can send messages again.")
  .addChannelOption((option) => option
    .setName("channel")
    .setDescription("Choose a channel. Leave empty to unlock this channel.")
    .setRequired(false)
    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
  .setDMPermission(false);

async function registerCommands(client) {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  const applicationId = CLIENT_ID || client.user.id;
  const commands = [leagueCommand.toJSON(), hostEventCommand.toJSON(), endEventCommand.toJSON(), eventHistoryCommand.toJSON(), promotionTimingsCommand.toJSON(), lockCommand.toJSON(), unlockCommand.toJSON()];

  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(applicationId, GUILD_ID), { body: commands });
    console.log(`Registered guild commands for ${GUILD_ID}.`);
  } else {
    await rest.put(Routes.applicationCommands(applicationId), { body: commands });
    console.log("Registered global commands.");
  }
}

if (!TOKEN) {
  console.error("Missing DISCORD_TOKEN environment variable. Add it before starting the bot.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}.`);
  await registerCommands(client).catch((error) => {
    console.error("Failed to register slash commands:", error);
  });
  await checkPromotionReminders(client).catch(console.error);
  setInterval(() => {
    checkPromotionReminders(client).catch(console.error);
  }, 60000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton()) {
      if (interaction.customId.startsWith("league_join:")) {
        const leagueId = interaction.customId.split(":")[1];
        await handleJoinLeague(interaction, leagueId);
        return;
      }

      if (interaction.customId.startsWith("event_")) {
        const [eventAction, eventId] = interaction.customId.split(":");
        await handleEventButton(interaction, eventAction.replace("event_", ""), eventId);
        return;
      }
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "league") {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "host") {
        await handleHostLeague(interaction);
        return;
      }

      if (subcommand === "join") {
        await handleJoinLeague(interaction);
        return;
      }

      if (subcommand === "cancel") {
        await handleCancelLeague(interaction);
      }
      return;
    }

    if (interaction.commandName === "hostevent") {
      await handleHostEvent(interaction);
      return;
    }

    if (interaction.commandName === "endevent") {
      await handleEndEventCommand(interaction);
      return;
    }

    if (interaction.commandName === "eventhistory") {
      await handleEventHistoryCommand(interaction);
      return;
    }

    if (interaction.commandName === "promotiontimings") {
      await handlePromotionTimings(interaction);
      return;
    }

    if (interaction.commandName === "lock") {
      await handleChannelLock(interaction, true);
      return;
    }

    if (interaction.commandName === "unlock") {
      await handleChannelLock(interaction, false);
    }
  } catch (error) {
    console.error("Interaction error:", error);
    const message = "Something went wrong while handling this command.";

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: message, ephemeral: true }).catch(() => null);
    } else {
      await interaction.reply({ content: message, ephemeral: true }).catch(() => null);
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  try {
    // Ignore bot messages
    if (message.author.bot) return;

    // Handle prefix commands (,kick, ,ban, ,hb)
    if (message.content.startsWith(",kick ")) {
      const mentionedUser = message.mentions.users.first();
      await handleKickCommand(message, mentionedUser);
      return;
    }

    if (message.content.startsWith(",ban ")) {
      const mentionedUser = message.mentions.users.first();
      await handleBanCommand(message, mentionedUser, false);
      return;
    }

    if (message.content.startsWith(",hb ")) {
      const mentionedUser = message.mentions.users.first();
      await handleBanCommand(message, mentionedUser, true);
      return;
    }

    // Check if message mentions the bot
    const mentionsBot = message.mentions.users.has(message.client.user.id);

    // If it mentions the bot, only handle mention messages
    if (mentionsBot) {
      await handleMentionMessage(message);
      return;
    }

    // Otherwise handle guess messages
    await handleGuessMessage(message);
  } catch (error) {
    console.error("Message handling error:", error);
  }
});
process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

client.login(TOKEN);
