CREATE TABLE ai_boxes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    retain_frames BOOLEAN NOT NULL DEFAULT FALSE,
    retention_seconds INTEGER NOT NULL DEFAULT 0,
    last_heartbeat_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ai_boxes_retention_check
        CHECK ((retain_frames = FALSE AND retention_seconds = 0)
            OR (retain_frames = TRUE AND retention_seconds > 0))
);

CREATE TABLE cameras (
    id TEXT PRIMARY KEY,
    ai_box_id TEXT NOT NULL REFERENCES ai_boxes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    source_kind TEXT NOT NULL CHECK (source_kind IN ('usb', 'rtsp')),
    source_uri TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_status TEXT NOT NULL DEFAULT 'offline'
        CHECK (last_status IN ('online', 'offline', 'degraded')),
    last_metrics_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cameras_source_uri_check
        CHECK (source_kind = 'usb' OR source_uri IS NOT NULL)
);

CREATE OR REPLACE FUNCTION enforce_two_cameras_per_ai_box()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM cameras
        WHERE ai_box_id = NEW.ai_box_id
    ) >= 2
    AND NOT EXISTS (
        SELECT 1
        FROM cameras
        WHERE id = NEW.id
        AND ai_box_id = NEW.ai_box_id
    ) THEN
        RAISE EXCEPTION 'An AI Box cannot have more than two cameras: %', NEW.ai_box_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER cameras_two_per_ai_box_trigger
BEFORE INSERT ON cameras
FOR EACH ROW
EXECUTE FUNCTION enforce_two_cameras_per_ai_box();

CREATE TABLE metrics_events (
    id BIGSERIAL PRIMARY KEY,
    ai_box_id TEXT NOT NULL REFERENCES ai_boxes(id) ON DELETE RESTRICT,
    camera_id TEXT NOT NULL REFERENCES cameras(id) ON DELETE RESTRICT,
    captured_at TIMESTAMPTZ NOT NULL,
    people_count INTEGER NOT NULL CHECK (people_count >= 0),
    entries INTEGER NOT NULL CHECK (entries >= 0),
    exits INTEGER NOT NULL CHECK (exits >= 0),
    estimated_occupancy INTEGER NOT NULL CHECK (estimated_occupancy >= 0),
    gender_distribution JSONB NOT NULL,
    mood_distribution JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX metrics_events_camera_time_idx
    ON metrics_events (camera_id, captured_at DESC);

CREATE TABLE displays (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE contents (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (
        type IN ('announcement', 'image', 'video', 'school-info', 'metrics', 'emergency')
    ),
    title TEXT NOT NULL,
    payload JSONB NOT NULL,
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE content_schedules (
    content_id TEXT PRIMARY KEY REFERENCES contents(id) ON DELETE CASCADE,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    days_of_week SMALLINT[] NOT NULL DEFAULT '{}',
    CONSTRAINT content_schedule_range_check CHECK (ends_at > starts_at),
    CONSTRAINT content_schedule_days_check CHECK (
        days_of_week <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::SMALLINT[]
    )
);

CREATE TABLE content_displays (
    content_id TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    display_id TEXT NOT NULL REFERENCES displays(id) ON DELETE CASCADE,
    PRIMARY KEY (content_id, display_id)
);
