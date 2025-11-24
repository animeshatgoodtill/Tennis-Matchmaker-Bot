import TelegramBot from 'node-telegram-bot-api';
import { sql } from '@vercel/postgres';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// Skill levels
const SKILL_LEVELS = ['beginner', 'medium', 'advanced', 'pro'];

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
  }
}

async function startCommand(chatId, userId, username) {
  // Initialize user state in database
  await setSession(userId, {
    step: 'consent',
    username: username,
    availability: []
  });

  const message = `🎾 Welcome to Widen Arena Vilnius Matchmaker Bot!

I'll help you find tennis partners at your skill level.

To get started, I need your permission to share your Telegram username with matched players.

Your data will be minimal and can be deleted anytime with /remove command.`;

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

async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;

  // Get state from database
  const userState = await getSession(userId);

  // Answer callback to remove loading state
  await bot.answerCallbackQuery(callbackQuery.id);

  if (data === 'consent_yes') {
    userState.step = 'skill_level';
    userState.consent = true;
    await setSession(userId, userState);
    await askSkillLevel(chatId);

  } else if (data === 'consent_no') {
    await bot.sendMessage(chatId, 'No problem! If you change your mind, just send /start again.');
    await deleteSession(userId);

  } else if (data.startsWith('skill_')) {
    const skill = data.replace('skill_', '');
    userState.skill = skill;
    userState.step = 'availability';
    userState.currentDay = 0;
    await setSession(userId, userState);
    await askAvailability(chatId, userId, 0);

  } else if (data.startsWith('day_')) {
    // Handle day/time selection
    const [_, dayIndex, ...timeParts] = data.split('_');
    const timeSlot = timeParts.join('_');
    const day = Object.keys(TIME_SLOTS)[dayIndex];

    // Toggle slot selection
    const slotKey = `${day}_${timeSlot}`;
    if (!userState.availability) userState.availability = [];

    const slotIndex = userState.availability.indexOf(slotKey);
    if (slotIndex > -1) {
      userState.availability.splice(slotIndex, 1);
    } else {
      userState.availability.push(slotKey);
    }

    await setSession(userId, userState);

    // Update message with current selections
    await updateAvailabilityMessage(callbackQuery.message, userId, parseInt(dayIndex));

  } else if (data === 'next_day') {
    const nextDay = (userState.currentDay || 0) + 1;
    if (nextDay < Object.keys(TIME_SLOTS).length) {
      userState.currentDay = nextDay;
      await setSession(userId, userState);
      await askAvailability(chatId, userId, nextDay);
    } else {
      // Finished - save to database
      await saveUserProfile(chatId, userId, userState);
    }

  } else if (data === 'prev_day') {
    const prevDay = (userState.currentDay || 0) - 1;
    if (prevDay >= 0) {
      userState.currentDay = prevDay;
      await setSession(userId, userState);
      await askAvailability(chatId, userId, prevDay);
    }

  } else if (data === 'finish_availability') {
    await saveUserProfile(chatId, userId, userState);
  }
}

async function askSkillLevel(chatId) {
  const message = `🎯 What's your playing level?

Choose the one that best describes your current skill:`;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🟢 Beginner', callback_data: 'skill_beginner' }],
        [{ text: '🟡 Medium', callback_data: 'skill_medium' }],
        [{ text: '🟠 Advanced', callback_data: 'skill_advanced' }],
        [{ text: '🔴 Pro', callback_data: 'skill_pro' }]
      ]
    }
  };

  await bot.sendMessage(chatId, message, options);
}

async function askAvailability(chatId, userId, dayIndex) {
  const days = Object.keys(TIME_SLOTS);
  const day = days[dayIndex];
  const userState = await getSession(userId);

  const message = `📅 Select your available time slots for *${day}*:

Tap on time slots when you're available to play. Selected slots will have a ✅ mark.`;

  const keyboard = [];

  // Create time slot buttons
  TIME_SLOTS[day].forEach(slot => {
    const slotKey = `${day}_${slot}`;
    const isSelected = userState.availability && userState.availability.includes(slotKey);
    const buttonText = isSelected ? `✅ ${slot}` : slot;

    keyboard.push([{
      text: buttonText,
      callback_data: `day_${dayIndex}_${slot}`
    }]);
  });

  // Navigation buttons
  const navButtons = [];
  if (dayIndex > 0) {
    navButtons.push({ text: '⬅️ Previous', callback_data: 'prev_day' });
  }
  if (dayIndex < days.length - 1) {
    navButtons.push({ text: 'Next ➡️', callback_data: 'next_day' });
  } else {
    navButtons.push({ text: '✅ Finish', callback_data: 'finish_availability' });
  }
  keyboard.push(navButtons);

  const options = {
    reply_markup: {
      inline_keyboard: keyboard
    },
    parse_mode: 'Markdown'
  };

  await bot.sendMessage(chatId, message, options);
}

async function updateAvailabilityMessage(message, userId, dayIndex) {
  const days = Object.keys(TIME_SLOTS);
  const day = days[dayIndex];
  const userState = await getSession(userId);

  const keyboard = [];

  // Create time slot buttons with updated selection state
  TIME_SLOTS[day].forEach(slot => {
    const slotKey = `${day}_${slot}`;
    const isSelected = userState.availability && userState.availability.includes(slotKey);
    const buttonText = isSelected ? `✅ ${slot}` : slot;

    keyboard.push([{
      text: buttonText,
      callback_data: `day_${dayIndex}_${slot}`
    }]);
  });

  // Navigation buttons
  const navButtons = [];
  if (dayIndex > 0) {
    navButtons.push({ text: '⬅️ Previous', callback_data: 'prev_day' });
  }
  if (dayIndex < days.length - 1) {
    navButtons.push({ text: 'Next ➡️', callback_data: 'next_day' });
  } else {
    navButtons.push({ text: '✅ Finish', callback_data: 'finish_availability' });
  }
  keyboard.push(navButtons);

  const options = {
    chat_id: message.chat.id,
    message_id: message.message_id,
    reply_markup: {
      inline_keyboard: keyboard
    }
  };

  await bot.editMessageReplyMarkup(options.reply_markup, options);
}

async function saveUserProfile(chatId, userId, userState) {
  try {
    console.log('Saving profile for user:', userId);
    console.log('User state:', JSON.stringify(userState));

    // Save to database
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

    // Find matches
    const matches = await findMatches(userId, userState.skill, userState.availability);

    if (matches.length > 0) {
      await notifyMatches(chatId, userId, userState.username, matches);
    } else {
      await bot.sendMessage(chatId, `✅ Profile saved!

I'll notify you when a player with matching skill level and availability joins.

Use /mystatus to check your profile
Use /remove to delete your data`);
    }

    // Clear session after successful save
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

async function notifyMatches(chatId, userId, username, matches) {
  // Notify the current user
  let matchMessage = `🎾 Great news! Found ${matches.length} player(s) matching your level and schedule:\n\n`;

  for (const match of matches) {
    const slotsFormatted = match.common_slots.map(slot => {
      const [day, time] = slot.split('_');
      return `${day} ${time}`;
    }).join(', ');

    matchMessage += `👤 @${match.username}\n📅 Available: ${slotsFormatted}\n\n`;

    // Notify the matched player
    try {
      const notifyMessage = `🎾 New match found!\n\n👤 @${username} matches your skill level and is available:\n📅 ${slotsFormatted}\n\nReach out to coordinate your game!`;
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
    const availabilityFormatted = availability.map(slot => {
      const [day, time] = slot.split('_');
      return `${day} ${time}`;
    }).join('\n');

    const statusMessage = `📊 Your Profile:

🎯 Skill Level: ${profile.skill_level}
📅 Availability:
${availabilityFormatted}

Status: ${profile.active ? '✅ Active' : '⏸️ Inactive'}`;

    await bot.sendMessage(chatId, statusMessage);
  } catch (error) {
    console.error('Error getting status:', error);
    await bot.sendMessage(chatId, 'Error retrieving your profile.');
  }
}

async function removeCommand(chatId, userId) {
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
