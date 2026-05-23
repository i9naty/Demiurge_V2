-- ============================================================
-- Demiurge Database Schema
-- Версия: 1.0.0
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================
-- ПОЛЬЗОВАТЕЛИ И АУТЕНТИФИКАЦИЯ
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(32) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url TEXT DEFAULT '/avatars/default.png',
  display_name VARCHAR(64),
  bio TEXT DEFAULT '',
  role VARCHAR(16) DEFAULT 'player' CHECK (role IN ('player', 'master', 'admin')),
  subscription_tier VARCHAR(16) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'plus', 'premium', 'legend')),
  subscription_expires_at TIMESTAMPTZ,
  google_id VARCHAR(255) UNIQUE,
  discord_id VARCHAR(255) UNIQUE,
  is_guest BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(512) UNIQUE NOT NULL,
  refresh_token VARCHAR(512),
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- КОМНАТЫ VTT / МИРЫ
-- ============================================================

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(128) NOT NULL,
  description TEXT DEFAULT '',
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode VARCHAR(16) DEFAULT 'vtt' CHECK (mode IN ('vtt', 'world')),
  is_public BOOLEAN DEFAULT false,
  invite_code VARCHAR(16) UNIQUE,
  max_players INT DEFAULT 8,
  game_type VARCHAR(64) DEFAULT 'D&D 5e',
  password_hash VARCHAR(255),
  expires_at TIMESTAMPTZ,
  map_data JSONB DEFAULT '{}',
  fog_of_war JSONB DEFAULT '[]',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_participants (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(16) DEFAULT 'player' CHECK (role IN ('owner', 'master', 'player', 'spectator')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- ============================================================
-- ТОКЕНЫ VTT
-- ============================================================

CREATE TABLE IF NOT EXISTS tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  image_url TEXT,
  x FLOAT DEFAULT 0,
  y FLOAT DEFAULT 0,
  width FLOAT DEFAULT 64,
  height FLOAT DEFAULT 64,
  rotation FLOAT DEFAULT 0,
  is_hidden BOOLEAN DEFAULT false,
  layer INT DEFAULT 0,
  stats JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ЧАТ
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type VARCHAR(16) DEFAULT 'chat' CHECK (type IN ('chat', 'roll', 'system', 'whisper')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ЛИЧНЫЕ СООБЩЕНИЯ
-- ============================================================

CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- МИР (РЕЖИМ 3)
-- ============================================================

CREATE TABLE IF NOT EXISTS world_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID UNIQUE NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  seed INT NOT NULL,
  width INT DEFAULT 50,
  height INT DEFAULT 50,
  biome_data JSONB DEFAULT '{}',
  tile_data JSONB DEFAULT '{}',
  ai_god_personality VARCHAR(32) DEFAULT 'neutral',
  ai_god_mood FLOAT DEFAULT 0.5,
  tick_count INT DEFAULT 0,
  economy_data JSONB DEFAULT '{}',
  event_queue JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS world_tiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  x INT NOT NULL,
  y INT NOT NULL,
  terrain VARCHAR(32) DEFAULT 'grass',
  elevation FLOAT DEFAULT 0,
  resource_type VARCHAR(32),
  resource_amount INT DEFAULT 0,
  building_id UUID,
  is_explored BOOLEAN DEFAULT false,
  modified_by UUID REFERENCES users(id),
  modified_at TIMESTAMPTZ,
  UNIQUE(room_id, x, y)
);

-- ============================================================
-- СТРОИТЕЛЬСТВО
-- ============================================================

CREATE TABLE IF NOT EXISTS buildings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  tile_x INT NOT NULL,
  tile_y INT NOT NULL,
  building_type VARCHAR(32) NOT NULL,
  name VARCHAR(128),
  owner_id UUID REFERENCES users(id),
  health INT DEFAULT 100,
  max_health INT DEFAULT 100,
  level INT DEFAULT 1,
  built_at TIMESTAMPTZ DEFAULT NOW(),
  decay_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  UNIQUE(room_id, tile_x, tile_y)
);

-- ============================================================
-- NPC
-- ============================================================

CREATE TABLE IF NOT EXISTS npcs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  personality VARCHAR(32) DEFAULT 'neutral',
  faction_id UUID,
  x FLOAT NOT NULL,
  y FLOAT NOT NULL,
  health INT DEFAULT 20,
  max_health INT DEFAULT 20,
  schedule JSONB DEFAULT '{}',
  memory_embedding vector(1536),
  memory_text TEXT,
  is_unique BOOLEAN DEFAULT false,
  is_alive BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ФРАКЦИИ
-- ============================================================

CREATE TABLE IF NOT EXISTS factions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  reputation INT DEFAULT 50,
  color VARCHAR(7) DEFAULT '#3b82f6',
  wealth INT DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, name)
);

-- ============================================================
-- ИНВЕНТАРИ И РЕСУРСЫ
-- ============================================================

CREATE TABLE IF NOT EXISTS player_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  item_type VARCHAR(32) NOT NULL,
  quantity INT DEFAULT 1,
  slot INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, room_id, slot)
);

-- ============================================================
-- ТОРГОВЛЯ
-- ============================================================

CREATE TABLE IF NOT EXISTS trade_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id),
  buyer_id UUID REFERENCES users(id),
  item_type VARCHAR(32) NOT NULL,
  quantity INT DEFAULT 1,
  price INT NOT NULL,
  status VARCHAR(16) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- КВЕСТЫ
-- ============================================================

CREATE TABLE IF NOT EXISTS quests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  objective_type VARCHAR(32),
  objective_target JSONB DEFAULT '{}',
  objective_count INT DEFAULT 1,
  reward JSONB DEFAULT '{}',
  assigned_to UUID REFERENCES users(id),
  status VARCHAR(16) DEFAULT 'available' CHECK (status IN ('available', 'active', 'completed', 'failed')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- СОЦИАЛЬНАЯ СЕТЬ
-- ============================================================

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  room_id UUID REFERENCES rooms(id),
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- МОНЕТИЗАЦИЯ
-- ============================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier VARCHAR(16) NOT NULL,
  amount INT NOT NULL,
  status VARCHAR(16) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  payment_id VARCHAR(255),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(128) NOT NULL,
  type VARCHAR(32) NOT NULL CHECK (type IN ('character', 'building', 'ui_theme', 'dice')),
  price INT NOT NULL,
  rarity VARCHAR(16) DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_skins (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skin_id UUID NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, skin_id)
);

-- ============================================================
-- ПАМЯТЬ МИРА (ВЕКТОРНАЯ)
-- ============================================================

CREATE TABLE IF NOT EXISTS world_memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  event_type VARCHAR(32) NOT NULL,
  description TEXT NOT NULL,
  embedding vector(1536),
  importance FLOAT DEFAULT 0.5,
  affected_entities JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ДОСТИЖЕНИЯ
-- ============================================================

CREATE TABLE IF NOT EXISTS achievements (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  icon VARCHAR(8) DEFAULT '🏆',
  category VARCHAR(32) DEFAULT 'general',
  condition_type VARCHAR(32) NOT NULL,
  condition_value INT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id VARCHAR(64) NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id)
);

-- ============================================================
-- ПОДПИСКИ НА АВТОРОВ
-- ============================================================

CREATE TABLE IF NOT EXISTS user_follows (
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

-- ============================================================
-- ПЛАНИРОВАНИЕ D&D СЕССИЙ
-- ============================================================

CREATE TABLE IF NOT EXISTS sessions_planned (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  master_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  max_players INT DEFAULT 4,
  system VARCHAR(64) DEFAULT 'D&D 5e',
  status VARCHAR(16) DEFAULT 'open' CHECK (status IN ('open', 'full', 'cancelled', 'completed')),
  discord_server_id UUID REFERENCES discord_servers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions_planned(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  status VARCHAR(16) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

CREATE TABLE IF NOT EXISTS session_chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions_planned(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- СЦЕНЫ VTT
-- ============================================================

CREATE TABLE IF NOT EXISTS scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  map_url TEXT,
  grid_type VARCHAR(16) DEFAULT 'square' CHECK (grid_type IN ('square', 'hex', 'iso')),
  grid_size INT DEFAULT 70,
  grid_visible BOOLEAN DEFAULT true,
  grid_offset_x FLOAT DEFAULT 0,
  grid_offset_y FLOAT DEFAULT 0,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DISCORD-СЕРВЕРА
-- ============================================================

CREATE TABLE IF NOT EXISTS discord_servers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(128) NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_code VARCHAR(16) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS discord_server_members (
  server_id UUID NOT NULL REFERENCES discord_servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (server_id, user_id)
);

CREATE TABLE IF NOT EXISTS discord_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID NOT NULL REFERENCES discord_servers(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  type VARCHAR(16) DEFAULT 'text' CHECK (type IN ('text', 'voice')),
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS discord_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES discord_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- СТАТИСТИКА ИГРОКА
-- ============================================================

CREATE TABLE IF NOT EXISTS player_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  login_count INT DEFAULT 0,
  post_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  room_count INT DEFAULT 0,
  story_count INT DEFAULT 0,
  games_started INT DEFAULT 0,
  dms_sent INT DEFAULT 0,
  follows_count INT DEFAULT 0,
  lobbies_created INT DEFAULT 0,
  whispers_sent INT DEFAULT 0,
  total_play_minutes INT DEFAULT 0,
  sessions_as_master INT DEFAULT 0,
  sessions_as_player INT DEFAULT 0,
  total_rolls INT DEFAULT 0,
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- РЕЖИМ 2: ЖИВАЯ ИСТОРИЯ (ИИ-МАСТЕР)
-- ============================================================

CREATE TABLE IF NOT EXISTS story_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  genre VARCHAR(32) NOT NULL DEFAULT 'fantasy',
  setting VARCHAR(64) NOT NULL DEFAULT 'forest',
  difficulty VARCHAR(16) NOT NULL DEFAULT 'normal' CHECK (difficulty IN ('easy', 'normal', 'hard')),
  player_count INT DEFAULT 1,
  act INT DEFAULT 1 CHECK (act BETWEEN 1 AND 4),
  status VARCHAR(16) DEFAULT 'lobby' CHECK (status IN ('lobby', 'active', 'paused', 'completed')),
  invite_code VARCHAR(16) UNIQUE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS story_players (
  session_id UUID NOT NULL REFERENCES story_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_name VARCHAR(64) DEFAULT 'Герой',
  hp INT DEFAULT 20,
  max_hp INT DEFAULT 20,
  ac INT DEFAULT 10,
  inventory JSONB DEFAULT '[]',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS story_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID UNIQUE NOT NULL REFERENCES story_sessions(id) ON DELETE CASCADE,
  map_data JSONB DEFAULT '{"tiles":[],"width":20,"height":20}',
  tokens JSONB DEFAULT '[]',
  action_history JSONB DEFAULT '[]',
  narrative TEXT DEFAULT '',
  ai_notes TEXT DEFAULT '',
  last_action_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS story_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES story_sessions(id) ON DELETE CASCADE,
  event_type VARCHAR(32) NOT NULL,
  description TEXT NOT NULL,
  importance INT DEFAULT 1 CHECK (importance BETWEEN 1 AND 10),
  related_npc VARCHAR(128),
  related_player UUID REFERENCES users(id),
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- РЕЖИМ 2v2: ИГРОВЫЕ СЕССИИ (ЛОББИ + ИГРА)
-- ============================================================

CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lobby_code VARCHAR(16) UNIQUE NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}',
  world_state JSONB DEFAULT '{}',
  story_state JSONB DEFAULT '{}',
  status VARCHAR(16) DEFAULT 'lobby' CHECK (status IN ('lobby', 'loading', 'active', 'paused', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lobby_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_data JSONB DEFAULT '{}',
  role VARCHAR(16) DEFAULT 'player' CHECK (role IN ('owner', 'player', 'observer')),
  is_online BOOLEAN DEFAULT true,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

CREATE TABLE IF NOT EXISTS saved_games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES game_sessions(id) ON DELETE SET NULL,
  save_name VARCHAR(255) DEFAULT 'Сохранение',
  world_state JSONB DEFAULT '{}',
  story_state JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DISCORD: РОЛИ И РЕАКЦИИ
-- ============================================================

CREATE TABLE IF NOT EXISTS discord_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID NOT NULL REFERENCES discord_servers(id) ON DELETE CASCADE,
  name VARCHAR(64) NOT NULL,
  color VARCHAR(7) DEFAULT '#99aab5',
  permissions BIGINT DEFAULT 0,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS discord_member_roles (
  server_id UUID NOT NULL REFERENCES discord_servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES discord_roles(id) ON DELETE CASCADE,
  PRIMARY KEY (server_id, user_id, role_id)
);

CREATE TABLE IF NOT EXISTS discord_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES discord_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- ============================================================
-- ИНДЕКСЫ
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_rooms_owner ON rooms(owner_id);
CREATE INDEX IF NOT EXISTS idx_tokens_room ON tokens(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_world_tiles_room ON world_tiles(room_id, x, y);
CREATE INDEX IF NOT EXISTS idx_npcs_room ON npcs(room_id);
CREATE INDEX IF NOT EXISTS idx_buildings_room ON buildings(room_id);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_room ON world_memories(room_id);
CREATE INDEX IF NOT EXISTS idx_world_memories_embedding ON world_memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_story_sessions_owner ON story_sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_story_sessions_invite ON story_sessions(invite_code);
CREATE INDEX IF NOT EXISTS idx_story_state_session ON story_state(session_id);
CREATE INDEX IF NOT EXISTS idx_story_memory_session ON story_memory(session_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_code ON game_sessions(lobby_code);
CREATE INDEX IF NOT EXISTS idx_game_sessions_owner ON game_sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_lobby_participants_session ON lobby_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_lobby_participants_user ON lobby_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_games_user ON saved_games(user_id);
CREATE INDEX IF NOT EXISTS idx_discord_roles_server ON discord_roles(server_id);
CREATE INDEX IF NOT EXISTS idx_discord_reactions_msg ON discord_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_receiver ON direct_messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_read ON direct_messages(receiver_id, is_read);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user ON room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_session_applications_session ON session_applications(session_id);
CREATE INDEX IF NOT EXISTS idx_session_chats_session ON session_chats(session_id);
CREATE INDEX IF NOT EXISTS idx_discord_channels_server ON discord_channels(server_id);
CREATE INDEX IF NOT EXISTS idx_discord_messages_channel ON discord_messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_scenes_room ON scenes(room_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_player_inventory_user_room ON player_inventory(user_id, room_id);
CREATE INDEX IF NOT EXISTS idx_quests_room_status ON quests(room_id, status);
CREATE INDEX IF NOT EXISTS idx_trade_offers_room_status ON trade_offers(room_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_id, created_at);

-- ============================================================
-- COMPENDIUM (монстры, заклинания, предметы)
-- ============================================================
CREATE TABLE IF NOT EXISTS compendium_monsters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  cr VARCHAR(8) NOT NULL DEFAULT '0',
  type VARCHAR(64) NOT NULL DEFAULT 'humanoid',
  size VARCHAR(32) NOT NULL DEFAULT 'medium',
  alignment VARCHAR(32) DEFAULT 'neutral',
  ac INT NOT NULL DEFAULT 10,
  hp INT NOT NULL DEFAULT 10,
  speed VARCHAR(64) DEFAULT '30 ft.',
  stats JSONB DEFAULT '{}',
  actions TEXT,
  traits TEXT,
  source VARCHAR(64) DEFAULT 'SRD',
  image_url VARCHAR(512),
  tags TEXT[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS compendium_spells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  level INT NOT NULL DEFAULT 0,
  school VARCHAR(32) NOT NULL DEFAULT 'evocation',
  casting_time VARCHAR(64) DEFAULT '1 action',
  range VARCHAR(64) DEFAULT '60 ft.',
  components VARCHAR(32) DEFAULT 'V,S',
  duration VARCHAR(64) DEFAULT 'Instantaneous',
  description TEXT NOT NULL DEFAULT '',
  higher_level TEXT,
  classes TEXT[] DEFAULT '{}',
  source VARCHAR(64) DEFAULT 'SRD'
);

CREATE TABLE IF NOT EXISTS compendium_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  type VARCHAR(32) NOT NULL DEFAULT 'adventuring_gear',
  rarity VARCHAR(32) DEFAULT 'common',
  cost VARCHAR(32) DEFAULT '0 gp',
  weight FLOAT DEFAULT 0,
  description TEXT DEFAULT '',
  properties JSONB DEFAULT '{}',
  source VARCHAR(64) DEFAULT 'SRD',
  image_url VARCHAR(512)
);

CREATE INDEX IF NOT EXISTS idx_compendium_monsters_cr ON compendium_monsters(cr);
CREATE INDEX IF NOT EXISTS idx_compendium_monsters_type ON compendium_monsters(type);
CREATE INDEX IF NOT EXISTS idx_compendium_spells_level ON compendium_spells(level);
CREATE INDEX IF NOT EXISTS idx_compendium_spells_school ON compendium_spells(school);
CREATE INDEX IF NOT EXISTS idx_compendium_items_type ON compendium_items(type);

-- Character sheets
CREATE TABLE IF NOT EXISTS character_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  race VARCHAR(32) DEFAULT 'human',
  class VARCHAR(32) DEFAULT 'fighter',
  level INT DEFAULT 1,
  stats JSONB DEFAULT '{}',
  spells JSONB DEFAULT '[]',
  inventory JSONB DEFAULT '[]',
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_character_sheets_user ON character_sheets(user_id);
CREATE INDEX IF NOT EXISTS idx_character_sheets_room ON character_sheets(room_id);
