import TelegramBot from 'node-telegram-bot-api';
import { sql } from '@vercel/postgres';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// Skill levels
const SKILL_LEVELS = ['beginner', 'medium', 'advanced', 'pro'];

// Days of the week
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Time slots for each day
const TIME_SLOTS = {
  'Monday': ['7-9am', '9-11am', '11am-1pm', '1-3pm', '3-5pm', '5-7pm', '7-9pm'],
  'Tuesday': ['7-9am', '9-11am', '11am-1pm', '1-3pm', '3-5pm', '5-7pm', '7-9pm'],
  'Wednesday': ['7-9am', '9-11am', '11am-1pm', '1-3pm', '3-5pm', '5-7pm', '7-9pm'],
  'Thursday': ['7-9am', '9-11am', '11am-1pm', '1-3pm', '3-5pm', '5-7pm', '7-9pm'],
  'Friday': ['7-9am', '9-11am', '11am-1pm', '1-3pm', '3-5pm', '5-7pm', '7-9pm'],
  'Saturday': ['8-10am', '10am-12pm', '12-2pm', '2-4pm', '4-6pm', '6-8pm'],
  'Sunday': ['8-10am', '10am-12pm', '12-2pm', '2-4pm', '4-6pm', '6-8pm']
};

// Database-backed session management
async function getSession(userId) {
  try {
    const { rows } = await sql`
      SELECT state FROM user_sessions WHERE telegram_id = ${userId}
    `;
    return rows.length > 0 ? rows[0].state : {};
  } catch (error) {
    console.error('Error getting session:', error);
    return {};
  }
}

async function setSession(userId, state) {
  try {
    await sql`
      INSERT INTO user_sessions (telegram_id, state, updated_at)
      VALUES (${userId}, ${JSON.stringify(state)}, NOW())
      ON CONFLICT (telegram_id)
      DO UPDATE SET state = ${JSON.stringify(state)}, updated_at = NOW()
    `;
  } catch (error) {
    console.error('Error setting session:', error);
  }
}

async function deleteSession(userId) {
  try {
    await sql`DELETE FROM user_sessions WHERE telegram_id = ${userId}`;
  } catch (error) {
    console.error('Error deleting session:', error);
  }
}

// Get existing player profile
async function getPlayerProfile(userId) {
  try {
    const { rows } = await sql`
      SELECT username, skill_level, availability, active
      FROM players WHERE telegram_id = ${userId}
    `;
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error getting player profile:', error);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const update = req.body;

  try {
    if (update.message) {
      await handleMessage(update.message);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error handling update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text;

  if (text === '/start') {
    await startCommand(chatId, userId, message.from.username);
  } else if (text === '/cancel') {
    await cancelCommand(chatId, userId);
  } else if (text === '/mystatus') {
    await statusCommand(chatId, userId);
  } else if (text === '/remove') {
    await removeCommand(chatId, userId);
  } else if (text === '/update') {
    await updateCommand(chatId, userId, message.from.username);
  } else if (text === '/help') {
    await helpCommand(chatId);
  }
}

async function helpCommand(chatId) {
  const message = `🎾 *Tennis Matchmaker Bot*

*Commands:*
/start - Create or reset your profile
/mystatus - View your current profile
/update - Change skill level or availability
/remove - Delete all your data
/cancel - Cancel current operation
/help - Show this help message

*How it works:*
1. Set your skill level (beginner to pro)
2. Select days you're available
3. Pick time slots for each day
4. Get matched with players at your level!

When a match is found, both players are notified with each other's contact info.`;

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

async function startCommand(chatId, userId, username) {
  // Initialize user state in database
  await setSession(userId, {
    step: 'consent',
    username: username,
    selectedDays: [],
    availability: []
  });

  let message = `🎾 Welcome to Widen Arena Vilnius Matchmaker Bot!

I'll help you find tennis partners at your skill level.

To get started, I need your permission to share your Telegram username with matched players.

Your data will be minimal and can be deleted anytime with /remove command.`;

  // Warn if no username set
  if (!username) {
    message += `\n\n⚠️ Note: You don't have a Telegram username set. Matched players won't be able to contact you directly. Consider setting one in Telegram Settings.`;
  }

  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Yes, I agree', callback_data: 'consent_yes' },
          { text: '❌ No, thanks', callback_data: 'consent_no' }
        ]
      ]
    }
  };

  await bot.sendMessage(chatId, message, options);
}

// New /update command
async function updateCommand(chatId, userId, username) {
  const profile = await getPlayerProfile(userId);

  if (!profile) {
    await bot.sendMessage(chatId, 'You don\'t have a profile yet. Send /start to create one!');
    return;
  }

  // Preserve existing profile data in session for updates
  await setSession(userId, {
    step: 'update_menu',
    username: username || profile.username,
    skill: profile.skill_level, // Keep existing skill level
    selectedDays: [],
    availability: []
  });

  const message = `⚙️ What would you like to update?`;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎯 Change Skill Level', callback_data: 'update_skill' }],
        [{ text: '📅 Update Availability', callback_data: 'update_days' }],
        [{ text: profile.active ? '⏸️ Pause Matching' : '▶️ Resume Matching',
           callback_data: profile.active ? 'update_pause' : 'update_resume' }],
        [{ text: '❌ Cancel', callback_data: 'update_cancel' }]
      ]
    }
  };

  await bot.sendMessage(chatId, message, options);
}

async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;

  // Get state from database
  const userState = await getSession(userId);

  // Answer callback to remove loading state
  await bot.answerCallbackQuery(callbackQuery.id);

  // === CONSENT ===
  if (data === 'consent_yes') {
    userState.step = 'skill_level';
    userState.consent = true;
    await setSession(userId, userState);
    await askSkillLevel(chatId);

  } else if (data === 'consent_no') {
    await bot.sendMessage(chatId, 'No problem! If you change your mind, just send /start again.');
    await deleteSession(userId);

  // === SKILL LEVEL ===
  } else if (data.startsWith('skill_')) {
    const skill = data.replace('skill_', '');
    userState.skill = skill;
    userState.step = 'select_days';
    await setSession(userId, userState);
    await askDaySelection(chatId, userId);

  // === DAY SELECTION (toggle) ===
  } else if (data.startsWith('toggle_day_')) {
    const dayIndex = parseInt(data.replace('toggle_day_', ''));
    const day = DAYS[dayIndex];

    if (!userState.selectedDays) userState.selectedDays = [];

    const idx = userState.selectedDays.indexOf(day);
    if (idx > -1) {
      userState.selectedDays.splice(idx, 1);
    } else {
      userState.selectedDays.push(day);
    }

    await setSession(userId, userState);
    await updateDaySelectionMessage(callbackQuery.message, userId);

  // === CONFIRM DAYS ===
  } else if (data === 'confirm_days') {
    if (!userState.selectedDays || userState.selectedDays.length === 0) {
      await bot.sendMessage(chatId, '⚠️ Please select at least one day.');
      return;
    }
    userState.step = 'availability';
    userState.currentDayIndex = 0;
    userState.availability = [];
    await setSession(userId, userState);
    await askAvailability(chatId, userId, 0);

  // === TIME SLOT SELECTION ===
  } else if (data.startsWith('slot_')) {
    const parts = data.replace('slot_', '').split('_');
    const dayIndex = parseInt(parts[0]);
    const timeSlot = parts.slice(1).join('_');
    const day = userState.selectedDays[dayIndex];

    const slotKey = `${day}_${timeSlot}`;
    if (!userState.availability) userState.availability = [];

    const slotIndex = userState.availability.indexOf(slotKey);
    if (slotIndex > -1) {
      userState.availability.splice(slotIndex, 1);
    } else {
      userState.availability.push(slotKey);
    }

    await setSession(userId, userState);
    await updateAvailabilityMessage(callbackQuery.message, userId, dayIndex);

  // === NAVIGATION ===
  } else if (data === 'next_day') {
    const nextDay = (userState.currentDayIndex || 0) + 1;
    if (nextDay < userState.selectedDays.length) {
      userState.currentDayIndex = nextDay;
      await setSession(userId, userState);
      await askAvailability(chatId, userId, nextDay);
    } else {
      await saveUserProfile(chatId, userId, userState);
    }

  } else if (data === 'prev_day') {
    const prevDay = (userState.currentDayIndex || 0) - 1;
    if (prevDay >= 0) {
      userState.currentDayIndex = prevDay;
      await setSession(userId, userState);
      await askAvailability(chatId, userId, prevDay);
    }

  } else if (data === 'finish_availability') {
    await saveUserProfile(chatId, userId, userState);

  // === UPDATE MENU HANDLERS ===
  } else if (data === 'update_skill') {
    userState.step = 'update_skill';
    await setSession(userId, userState);
    await askSkillLevel(chatId, true);

  } else if (data === 'update_days') {
    userState.step = 'select_days';
    userState.selectedDays = [];
    userState.availability = [];
    await setSession(userId, userState);
    await askDaySelection(chatId, userId);

  } else if (data === 'update_pause') {
    await sql`UPDATE players SET active = false, updated_at = NOW() WHERE telegram_id = ${userId}`;
    await deleteSession(userId);
    await bot.sendMessage(chatId, '⏸️ Matching paused. You won\'t receive new match notifications.\n\nSend /update to resume anytime.');

  } else if (data === 'update_resume') {
    await sql`UPDATE players SET active = true, updated_at = NOW() WHERE telegram_id = ${userId}`;
    await deleteSession(userId);
    await bot.sendMessage(chatId, '▶️ Matching resumed! You\'ll now receive notifications for new matches.');

  } else if (data === 'update_cancel') {
    await deleteSession(userId);
    await bot.sendMessage(chatId, 'Update cancelled.');

  // === UPDATE SKILL SELECTION ===
  } else if (data.startsWith('newskill_')) {
    const skill = data.replace('newskill_', '');
    await sql`UPDATE players SET skill_level = ${skill}, updated_at = NOW() WHERE telegram_id = ${userId}`;
    await deleteSession(userId);
    await bot.sendMessage(chatId, `✅ Skill level updated to ${skill}!`);

  // === REMOVE CONFIRMATION ===
  } else if (data === 'confirm_remove') {
    await executeRemove(chatId, userId);

  } else if (data === 'cancel_remove') {
    await bot.sendMessage(chatId, 'Removal cancelled. Your data is safe.');
  }
}

async function askSkillLevel(chatId, isUpdate = false) {
  const message = `🎯 What's your playing level?

Choose the one that best describes your current skill:`;

  const callbackPrefix = isUpdate ? 'newskill_' : 'skill_';

  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🟢 Beginner', callback_data: `${callbackPrefix}beginner` }],
        [{ text: '🟡 Medium', callback_data: `${callbackPrefix}medium` }],
        [{ text: '🟠 Advanced', callback_data: `${callbackPrefix}advanced` }],
        [{ text: '🔴 Pro', callback_data: `${callbackPrefix}pro` }]
      ]
    }
  };

  await bot.sendMessage(chatId, message, options);
}

async function askDaySelection(chatId, userId) {
  const userState = await getSession(userId);

  const message = `📅 Which days are you typically available to play?

Tap to select/deselect days, then press Continue.`;

  const keyboard = buildDaySelectionKeyboard(userState.selectedDays || []);

  const options = {
    reply_markup: { inline_keyboard: keyboard }
  };

  await bot.sendMessage(chatId, message, options);
}

function buildDaySelectionKeyboard(selectedDays) {
  const keyboard = [];

  // First row: Mon-Thu
  const row1 = [];
  for (let i = 0; i < 4; i++) {
    const day = DAYS[i];
    const shortDay = day.slice(0, 3);
    const isSelected = selectedDays.includes(day);
    row1.push({
      text: isSelected ? `✅ ${shortDay}` : shortDay,
      callback_data: `toggle_day_${i}`
    });
  }
  keyboard.push(row1);

  // Second row: Fri-Sun
  const row2 = [];
  for (let i = 4; i < 7; i++) {
    const day = DAYS[i];
    const shortDay = day.slice(0, 3);
    const isSelected = selectedDays.includes(day);
    row2.push({
      text: isSelected ? `✅ ${shortDay}` : shortDay,
      callback_data: `toggle_day_${i}`
    });
  }
  keyboard.push(row2);

  // Continue button
  keyboard.push([{ text: 'Continue ➡️', callback_data: 'confirm_days' }]);

  return keyboard;
}

async function updateDaySelectionMessage(message, userId) {
  const userState = await getSession(userId);
  const keyboard = buildDaySelectionKeyboard(userState.selectedDays || []);

  const options = {
    chat_id: message.chat.id,
    message_id: message.message_id,
    reply_markup: { inline_keyboard: keyboard }
  };

  await bot.editMessageReplyMarkup(options.reply_markup, options);
}

async function askAvailability(chatId, userId, dayIndex) {
  const userState = await getSession(userId);
  const day = userState.selectedDays[dayIndex];

  const message = `📅 Select time slots for *${day}* (${dayIndex + 1}/${userState.selectedDays.length}):

Tap slots when you're available. Selected slots show ✅`;

  const keyboard = buildAvailabilityKeyboard(userState, dayIndex, day);

  const options = {
    reply_markup: { inline_keyboard: keyboard },
    parse_mode: 'Markdown'
  };

  await bot.sendMessage(chatId, message, options);
}

function buildAvailabilityKeyboard(userState, dayIndex, day) {
  const keyboard = [];
  const slots = TIME_SLOTS[day];

  // Time slot buttons (2 per row for better UX)
  for (let i = 0; i < slots.length; i += 2) {
    const row = [];
    for (let j = i; j < Math.min(i + 2, slots.length); j++) {
      const slot = slots[j];
      const slotKey = `${day}_${slot}`;
      const isSelected = userState.availability && userState.availability.includes(slotKey);
      row.push({
        text: isSelected ? `✅ ${slot}` : slot,
        callback_data: `slot_${dayIndex}_${slot}`
      });
    }
    keyboard.push(row);
  }

  // Navigation buttons
  const navButtons = [];
  if (dayIndex > 0) {
    navButtons.push({ text: '⬅️ Previous', callback_data: 'prev_day' });
  }
  if (dayIndex < userState.selectedDays.length - 1) {
    navButtons.push({ text: 'Next ➡️', callback_data: 'next_day' });
  } else {
    navButtons.push({ text: '✅ Finish', callback_data: 'finish_availability' });
  }
  keyboard.push(navButtons);

  return keyboard;
}

async function updateAvailabilityMessage(message, userId, dayIndex) {
  const userState = await getSession(userId);
  const day = userState.selectedDays[dayIndex];
  const keyboard = buildAvailabilityKeyboard(userState, dayIndex, day);

  const options = {
    chat_id: message.chat.id,
    message_id: message.message_id,
    reply_markup: { inline_keyboard: keyboard }
  };

  await bot.editMessageReplyMarkup(options.reply_markup, options);
}

async function saveUserProfile(chatId, userId, userState) {
  try {
    console.log('Saving profile for user:', userId);
    console.log('User state:', JSON.stringify(userState));

    await sql`
      INSERT INTO players (telegram_id, username, skill_level, availability, active)
      VALUES (${userId}, ${userState.username || null}, ${userState.skill}, ${JSON.stringify(userState.availability || [])}, true)
      ON CONFLICT (telegram_id)
      DO UPDATE SET
        username = ${userState.username || null},
        skill_level = ${userState.skill},
        availability = ${JSON.stringify(userState.availability || [])},
        active = true,
        updated_at = NOW()
    `;

    console.log('Profile saved successfully');

    const matches = await findMatches(userId, userState.skill, userState.availability);

    if (matches.length > 0) {
      await notifyMatches(chatId, userId, userState.username, matches);
    } else {
      await bot.sendMessage(chatId, `✅ Profile saved!

No matches found yet - but don't worry! Players are joining regularly.

💡 Tip: Adding more days or time slots increases your chances of finding a partner.

I'll notify you automatically when someone with matching skill and availability joins.

Commands:
/mystatus - View your profile
/update - Expand your availability
/remove - Delete your data`);
    }

    await deleteSession(userId);
  } catch (error) {
    console.error('Error saving profile:', error.message);
    console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    await bot.sendMessage(chatId, `Sorry, there was an error saving your profile: ${error.message}`);
  }
}

async function findMatches(userId, skillLevel, availability) {
  try {
    const { rows } = await sql`
      SELECT telegram_id, username, availability
      FROM players
      WHERE telegram_id != ${userId}
        AND skill_level = ${skillLevel}
        AND active = true
    `;

    const matches = [];

    for (const player of rows) {
      const playerAvailability = typeof player.availability === 'string'
        ? JSON.parse(player.availability)
        : player.availability;
      const commonSlots = availability.filter(slot => playerAvailability.includes(slot));

      if (commonSlots.length > 0) {
        matches.push({
          telegram_id: player.telegram_id,
          username: player.username,
          common_slots: commonSlots
        });
      }
    }

    return matches;
  } catch (error) {
    console.error('Error finding matches:', error);
    return [];
  }
}

// Helper to format username display
function formatUsername(username, telegramId) {
  if (username) {
    return `@${username}`;
  }
  return `Player ${String(telegramId).slice(-4)}`; // Last 4 digits as anonymous ID
}

async function notifyMatches(chatId, userId, username, matches) {
  let matchMessage = `🎾 Great news! Found ${matches.length} player(s) matching your level and schedule:\n\n`;

  const currentUserDisplay = formatUsername(username, userId);

  for (const match of matches) {
    const slotsFormatted = match.common_slots.map(slot => {
      const [day, time] = slot.split('_');
      return `${day} ${time}`;
    }).join(', ');

    const matchUserDisplay = formatUsername(match.username, match.telegram_id);
    matchMessage += `👤 ${matchUserDisplay}\n📅 Available: ${slotsFormatted}\n\n`;

    try {
      const notifyMessage = `🎾 New match found!\n\n👤 ${currentUserDisplay} matches your skill level and is available:\n📅 ${slotsFormatted}\n\nReach out to coordinate your game!`;
      await bot.sendMessage(match.telegram_id, notifyMessage);
    } catch (error) {
      console.error(`Failed to notify player ${match.telegram_id}:`, error);
    }
  }

  matchMessage += `Reach out to them to coordinate your games!`;
  await bot.sendMessage(chatId, matchMessage);
}

async function statusCommand(chatId, userId) {
  try {
    const { rows } = await sql`
      SELECT skill_level, availability, active
      FROM players
      WHERE telegram_id = ${userId}
    `;

    if (rows.length === 0) {
      await bot.sendMessage(chatId, 'You don\'t have a profile yet. Send /start to create one!');
      return;
    }

    const profile = rows[0];
    const availability = typeof profile.availability === 'string'
      ? JSON.parse(profile.availability)
      : profile.availability;

    // Group by day for better readability
    const byDay = {};
    availability.forEach(slot => {
      const [day, time] = slot.split('_');
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(time);
    });

    const availabilityFormatted = Object.entries(byDay)
      .map(([day, times]) => `${day}: ${times.join(', ')}`)
      .join('\n');

    const statusMessage = `📊 Your Profile:

🎯 Skill Level: ${profile.skill_level}
📅 Availability:
${availabilityFormatted || 'None set'}

Status: ${profile.active ? '✅ Active' : '⏸️ Paused'}

Commands:
/update - Modify your profile
/remove - Delete your data`;

    await bot.sendMessage(chatId, statusMessage);
  } catch (error) {
    console.error('Error getting status:', error);
    await bot.sendMessage(chatId, 'Error retrieving your profile.');
  }
}

async function removeCommand(chatId, userId) {
  const message = `⚠️ *Are you sure?*

This will permanently delete your profile and all your data.`;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🗑️ Yes, delete my data', callback_data: 'confirm_remove' },
          { text: '❌ Cancel', callback_data: 'cancel_remove' }
        ]
      ]
    },
    parse_mode: 'Markdown'
  };

  await bot.sendMessage(chatId, message, options);
}

async function executeRemove(chatId, userId) {
  try {
    await sql`DELETE FROM players WHERE telegram_id = ${userId}`;
    await sql`DELETE FROM user_sessions WHERE telegram_id = ${userId}`;
    await bot.sendMessage(chatId, '✅ Your data has been completely removed from our system.');
  } catch (error) {
    console.error('Error removing user:', error);
    await bot.sendMessage(chatId, 'Error removing your data. Please try again.');
  }
}

async function cancelCommand(chatId, userId) {
  await deleteSession(userId);
  await bot.sendMessage(chatId, 'Operation cancelled. Send /start when you\'re ready to try again.');
}
