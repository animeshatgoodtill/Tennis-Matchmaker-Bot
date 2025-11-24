-- Simple schema with minimal data for GDPR compliance
CREATE TABLE IF NOT EXISTS players (
    telegram_id BIGINT PRIMARY KEY,
    username VARCHAR(255), -- Telegram username (user consented to share)
    skill_level VARCHAR(20) NOT NULL CHECK (skill_level IN ('beginner', 'medium', 'advanced', 'pro')),
    availability JSONB NOT NULL, -- Array of day_time strings
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for quick matching queries
CREATE INDEX idx_skill_active ON players(skill_level, active);
CREATE INDEX idx_updated ON players(updated_at);

-- Optional: Auto-cleanup inactive profiles after 30 days
-- This can be run as a cron job
CREATE OR REPLACE FUNCTION cleanup_inactive_players()
RETURNS void AS $$
BEGIN
    DELETE FROM players 
    WHERE updated_at < NOW() - INTERVAL '30 days' 
    AND active = true;
END;
$$ LANGUAGE plpgsql;
