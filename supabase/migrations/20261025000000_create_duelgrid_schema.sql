-- ============================================================================
-- DUELGRID - Production Database Schema & Authoritative Game RPCs
-- ============================================================================

-- Enable pgcrypto extension for secure token generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. GAMES TABLE
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'finished', 'abandoned')),
    board JSONB NOT NULL DEFAULT '["","","","","","","","",""]'::jsonb,
    current_turn TEXT NOT NULL DEFAULT 'X' CHECK (current_turn IN ('X', 'O')),
    winner TEXT CHECK (winner IN ('X', 'O', 'draw')),
    winning_line JSONB DEFAULT NULL,
    move_count INT NOT NULL DEFAULT 0,
    round_number INT NOT NULL DEFAULT 1,
    player_x_name TEXT NOT NULL,
    player_o_name TEXT DEFAULT NULL,
    rematch_requested_by TEXT DEFAULT NULL CHECK (rematch_requested_by IN ('X', 'O')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

-- Index on room_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_games_room_code ON games(room_code);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);

-- 2. GAME PARTICIPANTS (Private seat authorizations with secret session tokens)
CREATE TABLE IF NOT EXISTS game_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL CHECK (symbol IN ('X', 'O')),
    player_name TEXT NOT NULL,
    session_token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_game_symbol UNIQUE (game_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_participants_lookup ON game_participants(game_id, session_token);

-- 3. GAME ACTIONS (Authoritative move history & audit)
CREATE TABLE IF NOT EXISTS game_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    round_number INT NOT NULL,
    symbol TEXT NOT NULL,
    cell_index INT,
    action_type TEXT NOT NULL CHECK (action_type IN ('move', 'rematch', 'leave')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_actions_game_round ON game_actions(game_id, round_number);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_actions ENABLE ROW LEVEL SECURITY;

-- Games: Allow public reading of game state (board, players, turns, result)
-- This allows Realtime listeners to receive game state safely
DROP POLICY IF EXISTS "Allow public read on games" ON games;
CREATE POLICY "Allow public read on games" ON games
    FOR SELECT USING (true);

-- NEVER allow direct client INSERT/UPDATE/DELETE on games table.
-- All mutations MUST go through SECURITY DEFINER RPC functions!

-- Participants: Strictly PRIVATE - no direct SELECT for anon
-- Prevents leaking secret session tokens to any client
DROP POLICY IF EXISTS "Deny direct public read on participants" ON game_participants;
CREATE POLICY "Deny direct public read on participants" ON game_participants
    FOR SELECT USING (false);

-- Actions: Allow public read of move history
DROP POLICY IF EXISTS "Allow public read on game actions" ON game_actions;
CREATE POLICY "Allow public read on game actions" ON game_actions
    FOR SELECT USING (true);


-- ============================================================================
-- AUTHORITATIVE RPC FUNCTIONS
-- ============================================================================

-- Helper: Generate cryptographically random room code
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    chars TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; -- Excludes 0, O, 1, I to prevent confusion
    result TEXT := '';
    i INT;
    byte_val INT;
BEGIN
    FOR i IN 1..6 LOOP
        byte_val := get_byte(gen_random_bytes(1), 0);
        result := result || substr(chars, (byte_val % length(chars)) + 1, 1);
    END LOOP;
    RETURN result;
END;
$$;

-- 1. CREATE ROOM
CREATE OR REPLACE FUNCTION create_room(p_player_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_name TEXT;
    v_room_code TEXT;
    v_game games;
    v_session_token TEXT;
    v_attempts INT := 0;
BEGIN
    v_clean_name := trim(p_player_name);
    IF length(v_clean_name) < 2 OR length(v_clean_name) > 20 THEN
        RAISE EXCEPTION 'Player name must be between 2 and 20 characters.';
    END IF;

    -- Generate a unique room code
    LOOP
        v_room_code := generate_room_code();
        EXIT WHEN NOT EXISTS (SELECT 1 FROM games WHERE room_code = v_room_code);
        v_attempts := v_attempts + 1;
        IF v_attempts > 10 THEN
            RAISE EXCEPTION 'Could not generate unique room code. Please try again.';
        END IF;
    END LOOP;

    -- Create game record atomically
    INSERT INTO games (
        room_code,
        status,
        board,
        current_turn,
        player_x_name
    ) VALUES (
        v_room_code,
        'waiting',
        '["","","","","","","","",""]'::jsonb,
        'X',
        v_clean_name
    ) RETURNING * INTO v_game;

    -- Generate high-entropy 64-char participant session token
    v_session_token := encode(gen_random_bytes(32), 'hex');

    INSERT INTO game_participants (
        game_id,
        symbol,
        player_name,
        session_token
    ) VALUES (
        v_game.id,
        'X',
        v_clean_name,
        v_session_token
    );

    RETURN jsonb_build_object(
        'game', to_jsonb(v_game),
        'session_token', v_session_token,
        'symbol', 'X'
    );
END;
$$;

-- 2. JOIN ROOM
CREATE OR REPLACE FUNCTION join_room(p_room_code TEXT, p_player_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_code TEXT;
    v_clean_name TEXT;
    v_game games;
    v_session_token TEXT;
BEGIN
    v_clean_code := upper(trim(p_room_code));
    v_clean_name := trim(p_player_name);

    IF length(v_clean_name) < 2 OR length(v_clean_name) > 20 THEN
        RAISE EXCEPTION 'Player name must be between 2 and 20 characters.';
    END IF;

    -- Acquire row lock to prevent race conditions during join
    SELECT * INTO v_game
    FROM games
    WHERE room_code = v_clean_code
    FOR UPDATE;

    IF v_game.id IS NULL THEN
        RAISE EXCEPTION 'Room % not found.', v_clean_code;
    END IF;

    IF v_game.expires_at < now() THEN
        RAISE EXCEPTION 'Room has expired.';
    END IF;

    IF v_game.status != 'waiting' OR v_game.player_o_name IS NOT NULL THEN
        RAISE EXCEPTION 'Room is already full or game is already in progress.';
    END IF;

    -- Generate high-entropy participant token for O
    v_session_token := encode(gen_random_bytes(32), 'hex');

    INSERT INTO game_participants (
        game_id,
        symbol,
        player_name,
        session_token
    ) VALUES (
        v_game.id,
        'O',
        v_clean_name,
        v_session_token
    );

    -- Update game to in_progress
    UPDATE games
    SET player_o_name = v_clean_name,
        status = 'in_progress',
        updated_at = now()
    WHERE id = v_game.id
    RETURNING * INTO v_game;

    RETURN jsonb_build_object(
        'game', to_jsonb(v_game),
        'session_token', v_session_token,
        'symbol', 'O'
    );
END;
$$;

-- 3. AUTHORITATIVE MAKE MOVE
CREATE OR REPLACE FUNCTION make_move(p_game_id UUID, p_session_token TEXT, p_cell_index INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_participant game_participants;
    v_game games;
    v_board JSONB;
    v_new_board JSONB;
    v_winner TEXT := NULL;
    v_winning_line JSONB := NULL;
    v_new_status TEXT := 'in_progress';
    v_next_turn TEXT;
    v_lines INT[8][3] := ARRAY[
        [0,1,2], [3,4,5], [6,7,8], -- Rows
        [0,3,6], [1,4,7], [2,5,8], -- Columns
        [0,4,8], [2,4,6]           -- Diagonals
    ];
    v_line INT[];
    v_a INT;
    v_b INT;
    v_c INT;
    v_val_a TEXT;
    v_val_b TEXT;
    v_val_c TEXT;
    i INT;
BEGIN
    -- Validate cell index
    IF p_cell_index < 0 OR p_cell_index > 8 THEN
        RAISE EXCEPTION 'Invalid cell index: %. Must be between 0 and 8.', p_cell_index;
    END IF;

    -- Validate participant session token
    SELECT * INTO v_participant
    FROM game_participants
    WHERE game_id = p_game_id AND session_token = p_session_token;

    IF v_participant.id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Invalid participant token.';
    END IF;

    -- Concurrency control: Lock the game row for update
    SELECT * INTO v_game
    FROM games
    WHERE id = p_game_id
    FOR UPDATE;

    IF v_game.id IS NULL THEN
        RAISE EXCEPTION 'Game not found.';
    END IF;

    IF v_game.status != 'in_progress' THEN
        RAISE EXCEPTION 'Cannot make a move when game status is %.', v_game.status;
    END IF;

    IF v_game.current_turn != v_participant.symbol THEN
        RAISE EXCEPTION 'It is not your turn.';
    END IF;

    v_board := v_game.board;
    IF (v_board->>p_cell_index) IS NOT NULL AND (v_board->>p_cell_index) != '' THEN
        RAISE EXCEPTION 'Cell % is already occupied.', p_cell_index;
    END IF;

    -- Update cell with participant symbol
    v_new_board := jsonb_set(v_board, ARRAY[p_cell_index::text], to_jsonb(v_participant.symbol));

    -- Check for winning line
    FOR i IN 1..8 LOOP
        v_a := v_lines[i][1];
        v_b := v_lines[i][2];
        v_c := v_lines[i][3];

        v_val_a := v_new_board->>v_a;
        v_val_b := v_new_board->>v_b;
        v_val_c := v_new_board->>v_c;

        IF v_val_a != '' AND v_val_a = v_val_b AND v_val_b = v_val_c THEN
            v_winner := v_val_a;
            v_winning_line := jsonb_build_array(v_a, v_b, v_c);
            v_new_status := 'finished';
            EXIT;
        END IF;
    END LOOP;

    -- Check for draw
    IF v_winner IS NULL AND (v_game.move_count + 1) >= 9 THEN
        v_winner := 'draw';
        v_new_status := 'finished';
    END IF;

    -- Next turn
    IF v_participant.symbol = 'X' THEN
        v_next_turn := 'O';
    ELSE
        v_next_turn := 'X';
    END IF;

    -- Update game record
    UPDATE games
    SET board = v_new_board,
        status = v_new_status,
        winner = v_winner,
        winning_line = v_winning_line,
        current_turn = v_next_turn,
        move_count = v_game.move_count + 1,
        updated_at = now()
    WHERE id = v_game.id
    RETURNING * INTO v_game;

    -- Record action in audit log
    INSERT INTO game_actions (
        game_id,
        round_number,
        symbol,
        cell_index,
        action_type
    ) VALUES (
        v_game.id,
        v_game.round_number,
        v_participant.symbol,
        p_cell_index,
        'move'
    );

    RETURN to_jsonb(v_game);
END;
$$;

-- 4. REMATCH HANDSHAKE
CREATE OR REPLACE FUNCTION request_rematch(p_game_id UUID, p_session_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_participant game_participants;
    v_game games;
BEGIN
    -- Validate participant session token
    SELECT * INTO v_participant
    FROM game_participants
    WHERE game_id = p_game_id AND session_token = p_session_token;

    IF v_participant.id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Invalid participant token.';
    END IF;

    -- Lock the game row
    SELECT * INTO v_game
    FROM games
    WHERE id = p_game_id
    FOR UPDATE;

    IF v_game.id IS NULL THEN
        RAISE EXCEPTION 'Game not found.';
    END IF;

    IF v_game.status != 'finished' THEN
        RAISE EXCEPTION 'Rematch can only be requested after the game has finished.';
    END IF;

    -- Case 1: First player to request rematch
    IF v_game.rematch_requested_by IS NULL THEN
        UPDATE games
        SET rematch_requested_by = v_participant.symbol,
            updated_at = now()
        WHERE id = v_game.id
        RETURNING * INTO v_game;

        RETURN jsonb_build_object(
            'game', to_jsonb(v_game),
            'status', 'waiting_for_opponent'
        );

    -- Case 2: Same player requested again
    ELSIF v_game.rematch_requested_by = v_participant.symbol THEN
        RETURN jsonb_build_object(
            'game', to_jsonb(v_game),
            'status', 'already_requested'
        );

    -- Case 3: Both players have now agreed! Atomically reset board for new round
    ELSE
        UPDATE games
        SET board = '["","","","","","","","",""]'::jsonb,
            status = 'in_progress',
            winner = NULL,
            winning_line = NULL,
            current_turn = 'X',
            move_count = 0,
            round_number = v_game.round_number + 1,
            rematch_requested_by = NULL,
            updated_at = now()
        WHERE id = v_game.id
        RETURNING * INTO v_game;

        INSERT INTO game_actions (
            game_id,
            round_number,
            symbol,
            action_type
        ) VALUES (
            v_game.id,
            v_game.round_number,
            v_participant.symbol,
            'rematch'
        );

        RETURN jsonb_build_object(
            'game', to_jsonb(v_game),
            'status', 'rematch_accepted'
        );
    END IF;
END;
$$;

-- 5. LEAVE / ABANDON GAME
CREATE OR REPLACE FUNCTION leave_game(p_game_id UUID, p_session_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_participant game_participants;
    v_game games;
BEGIN
    SELECT * INTO v_participant
    FROM game_participants
    WHERE game_id = p_game_id AND session_token = p_session_token;

    IF v_participant.id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized.';
    END IF;

    SELECT * INTO v_game
    FROM games
    WHERE id = p_game_id
    FOR UPDATE;

    IF v_game.status = 'in_progress' THEN
        UPDATE games
        SET status = 'abandoned',
            winner = CASE WHEN v_participant.symbol = 'X' THEN 'O' ELSE 'X' END,
            updated_at = now()
        WHERE id = v_game.id
        RETURNING * INTO v_game;
    END IF;

    RETURN to_jsonb(v_game);
END;
$$;

-- Enable Realtime replication on games table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'games'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE games;
    END IF;
END $$;
