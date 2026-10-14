-- ==========================================================
-- Rollback Migration: 20261014_room_schema_and_numbers_rollback.sql
-- Restores columns, indexes, and barcode representations
-- ==========================================================

-- Step 1: Re-add columns
ALTER TABLE FITTING_ROOM
  ADD COLUMN FTR_CustomerPresent TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN FTR_SessionID       VARCHAR(64) NULL,
  ADD COLUMN FTR_ReleasedAt      DATETIME NULL;

-- Step 2: Drop room-order index and re-create idx_ftr_room_session
DROP INDEX idx_ftr_room_order ON FITTING_ROOM;
CREATE INDEX idx_ftr_room_session ON FITTING_ROOM (FTR_Number, FTR_SessionID);

-- Step 3: Restore barcodes from room numbers 1..10
UPDATE FITTING_ROOM SET FTR_Number = '5684848452325' WHERE FTR_Number = '1';
UPDATE FITTING_ROOM SET FTR_Number = '5684848452326' WHERE FTR_Number = '2';
UPDATE FITTING_ROOM SET FTR_Number = '5684848452327' WHERE FTR_Number = '3';
UPDATE FITTING_ROOM SET FTR_Number = '5684848452328' WHERE FTR_Number = '4';
UPDATE FITTING_ROOM SET FTR_Number = '5684848452329' WHERE FTR_Number = '5';
UPDATE FITTING_ROOM SET FTR_Number = '5684848452330' WHERE FTR_Number = '6';
UPDATE FITTING_ROOM SET FTR_Number = '5684848452331' WHERE FTR_Number = '7';
UPDATE FITTING_ROOM SET FTR_Number = '5684848452332' WHERE FTR_Number = '8';
UPDATE FITTING_ROOM SET FTR_Number = '5684848452333' WHERE FTR_Number = '9';
UPDATE FITTING_ROOM SET FTR_Number = '5684848452334' WHERE FTR_Number = '10';
