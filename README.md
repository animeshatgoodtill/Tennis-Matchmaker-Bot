# 🎾 Widen Arena Vilnius Matchmaker Bot

A simple, privacy-focused Telegram bot that matches tennis players based on skill level and availability.

## Features

- **Simple onboarding**: Intuitive flow with inline buttons
- **Skill-based matching**: 4 levels (Beginner, Medium, Advanced, Pro)
- **Flexible scheduling**: Select available time slots for each day
- **Instant notifications**: Get notified when a match is found
- **Privacy-first**: Minimal data storage, easy deletion with `/remove`
- **GDPR compliant**: Only stores essential data with user consent

## Quick Start

### 1. Create Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow instructions
3. Name it: `Widen Arena Vilnius Matchmaker Bot`
4. Save the bot token

### 2. Setup Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Clone and setup:
```bash
cd tennis-bot
npm install
cp .env.example .env
```

3. Add your bot token to `.env`:
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

### 3. Deploy to Vercel

1. Login to Vercel:
```bash
vercel login
```

2. Deploy:
```bash
vercel --prod
```

3. During first deployment:
   - Select your account
   - Set project name: `tennis-matchmaker-bot`
   - Select directory: `./`

4. Add Postgres database:
```bash
vercel storage create postgres-db --type postgres
```

5. Link storage to project:
```bash
vercel env pull .env.local
```

### 4. Initialize Database

```bash
npm run create-db
```

### 5. Setup Webhook

```bash
VERCEL_URL=https://your-project.vercel.app npm run setup-webhook
```

## Bot Commands

- `/start` - Start registration process
- `/mystatus` - View your profile and availability
- `/remove` - Delete all your data
- `/cancel` - Cancel current operation

## User Flow

1. **Start**: User sends `/start`
2. **Consent**: Agrees to share username for matching
3. **Skill Level**: Selects from 4 options
4. **Availability**: 
   - Goes through each day of the week
   - Taps time slots when available
   - Selected slots show ✅
   - Navigate with Previous/Next buttons
5. **Matching**: Automatic matching with notifications

## Data Storage

Minimal data stored per user:
- Telegram ID (identifier)
- Username (only if consented)
- Skill level
- Availability slots
- Timestamps

## Environment Variables

```env
TELEGRAM_BOT_TOKEN=    # From BotFather
POSTGRES_URL=          # Auto-set by Vercel
VERCEL_URL=           # Your deployment URL
```

## Project Structure

```
tennis-bot/
├── api/
│   └── webhook.js     # Main bot logic & webhook handler
├── scripts/
│   ├── setup-webhook.js  # Configure Telegram webhook
│   └── create-db.js      # Initialize database
├── schema.sql         # Database schema
├── package.json       # Dependencies
├── vercel.json       # Vercel configuration
└── .env.example      # Environment template
```

## Monitoring & Maintenance

### Check Bot Status
```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

### View Logs
```bash
vercel logs
```

### Database Queries (Vercel Dashboard)
```sql
-- Active users
SELECT COUNT(*) FROM players WHERE active = true;

-- Matches by skill level
SELECT skill_level, COUNT(*) 
FROM players 
GROUP BY skill_level;

-- Recent signups
SELECT username, skill_level, created_at 
FROM players 
ORDER BY created_at DESC 
LIMIT 10;
```

## Privacy & GDPR

- Users must consent before data collection
- Only essential data stored
- `/remove` command deletes all user data immediately
- No personal information beyond Telegram username
- Automatic cleanup of inactive profiles (optional, 30 days)

## Troubleshooting

**Bot not responding:**
- Check webhook status: `npm run setup-webhook`
- Verify bot token is correct
- Check Vercel function logs

**Database errors:**
- Ensure Postgres is linked: `vercel env pull`
- Re-run schema: `npm run create-db`

**Matching issues:**
- Verify users have overlapping time slots
- Check both users have same skill level
- Ensure both profiles are active

## Future Improvements

- [ ] Edit existing profile without re-registering
- [ ] Match notifications preferences (immediate vs daily digest)
- [ ] Skill level range matching (e.g., medium can match with advanced)
- [ ] Court location preferences
- [ ] Match history and ratings
- [ ] Group matching for doubles

## Support

For issues or questions about deployment, check:
- Vercel Docs: https://vercel.com/docs
- Telegram Bot API: https://core.telegram.org/bots/api
- Project Issues: [Create an issue]

## License

MIT
