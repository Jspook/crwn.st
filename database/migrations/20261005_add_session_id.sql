-- ==========================================================
-- Migration: 20261005_add_session_id.sql
-- Defect-2 fix: Isolation of session for fitting room.
-- ==========================================================

ALTER TABLE FITTING_ROOM
  ADD COLUMN IF NOT EXISTS FTR_SessionID  VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS CUS_ID         VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS FTR_ReleasedAt DATETIME NULL;

CREATE INDEX idx_ftr_room_session ON FITTING_ROOM (FTR_Number, FTR_SessionID);
