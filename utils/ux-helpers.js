// Simplified Availability Selection Helper
// This is an alternative approach for better UX

export function createQuickAvailabilityKeyboard() {
  // Quick selection presets
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🌅 Weekday Mornings (7-11am)', callback_data: 'quick_weekday_morning' }],
        [{ text: '☀️ Weekday Afternoons (12-5pm)', callback_data: 'quick_weekday_afternoon' }],
        [{ text: '🌆 Weekday Evenings (5-9pm)', callback_data: 'quick_weekday_evening' }],
        [{ text: '🏖️ Weekends (Flexible)', callback_data: 'quick_weekend_all' }],
        [{ text: '⚙️ Custom Selection', callback_data: 'custom_availability' }]
      ]
    }
  };
}

export function expandQuickSelection(quickOption) {
  const slots = [];
  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const weekends = ['Saturday', 'Sunday'];
  
  switch(quickOption) {
    case 'quick_weekday_morning':
      weekdays.forEach(day => {
        slots.push(`${day}_7-9am`, `${day}_9-11am`);
      });
      break;
      
    case 'quick_weekday_afternoon':
      weekdays.forEach(day => {
        slots.push(`${day}_11am-1pm`, `${day}_1-3pm`, `${day}_3-5pm`);
      });
      break;
      
    case 'quick_weekday_evening':
      weekdays.forEach(day => {
        slots.push(`${day}_5-7pm`, `${day}_7-9pm`);
      });
      break;
      
    case 'quick_weekend_all':
      weekends.forEach(day => {
        slots.push(
          `${day}_8-10am`,
          `${day}_10am-12pm`,
          `${day}_12-2pm`,
          `${day}_2-4pm`,
          `${day}_4-6pm`,
          `${day}_6-8pm`
        );
      });
      break;
  }
  
  return slots;
}

// Alternative: Compact weekly view
export function createCompactWeekView(selectedSlots = []) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const times = ['Morning', 'Afternoon', 'Evening'];
  
  const keyboard = [];
  
  // Header row
  keyboard.push([{ text: '📅 Quick Week View', callback_data: 'none' }]);
  
  // Time slots grid
  times.forEach(time => {
    const row = [];
    days.forEach(day => {
      const slotKey = `${day}_${time}`;
      const isSelected = selectedSlots.includes(slotKey);
      row.push({
        text: isSelected ? '✅' : '⬜',
        callback_data: `toggle_${slotKey}`
      });
    });
    keyboard.push(row);
  });
  
  // Labels
  keyboard.push(days.map(d => ({ text: d.substring(0, 3), callback_data: 'none' })));
  
  // Action buttons
  keyboard.push([
    { text: '✅ Save', callback_data: 'save_compact' },
    { text: '🔄 Clear All', callback_data: 'clear_all' }
  ]);
  
  return {
    reply_markup: { inline_keyboard: keyboard }
  };
}

// Smart matching with flexibility
export function findFlexibleMatches(userSkill, userSlots, tolerance = 0) {
  // tolerance = 0: exact skill match
  // tolerance = 1: can match one level up or down
  
  const skillLevels = ['beginner', 'medium', 'advanced', 'pro'];
  const userSkillIndex = skillLevels.indexOf(userSkill);
  
  const minSkill = Math.max(0, userSkillIndex - tolerance);
  const maxSkill = Math.min(skillLevels.length - 1, userSkillIndex + tolerance);
  
  const acceptableSkills = skillLevels.slice(minSkill, maxSkill + 1);
  
  return {
    skills: acceptableSkills,
    slots: userSlots
  };
}

// Notification preferences
export function createNotificationSettings() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔔 Instant Notifications', callback_data: 'notify_instant' }],
        [{ text: '📊 Daily Summary (9am)', callback_data: 'notify_daily' }],
        [{ text: '🔕 Only When I Check', callback_data: 'notify_manual' }]
      ]
    }
  };
}
