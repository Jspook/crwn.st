-- ==========================================================
-- Migration: 20261014_room_schema_and_numbers.sql
-- 1. Remove archived dummy occupancy records (occ_%)
-- 2. Normalize FTR_Number barcodes to canonical room numbers '1'..'10'
-- 3. Drop deprecated occupancy columns & indexes
-- ==========================================================

-- Step 1: Remove dummy occupancy rows (archived in Audit/archive_occ_rows.csv)
DELETE FROM FITTING_ROOM WHERE FTR_OrderID LIKE 'occ_%';

-- Step 2: Normalize barcodes to room numbers 1..10
UPDATE FITTING_ROOM SET FTR_Number = '1' WHERE FTR_Number = '5684848452325';
UPDATE FITTING_ROOM SET FTR_Number = '2' WHERE FTR_Number = '5684848452326';
UPDATE FITTING_ROOM SET FTR_Number = '3' WHERE FTR_Number = '5684848452327';
UPDATE FITTING_ROOM SET FTR_Number = '4' WHERE FTR_Number = '5684848452328';
UPDATE FITTING_ROOM SET FTR_Number = '5' WHERE FTR_Number = '5684848452329';
UPDATE FITTING_ROOM SET FTR_Number = '6' WHERE FTR_Number = '5684848452330';
UPDATE FITTING_ROOM SET FTR_Number = '7' WHERE FTR_Number = '5684848452331';
UPDATE FITTING_ROOM SET FTR_Number = '8' WHERE FTR_Number = '5684848452332';
UPDATE FITTING_ROOM SET FTR_Number = '9' WHERE FTR_Number = '5684848452333';
UPDATE FITTING_ROOM SET FTR_Number = '10' WHERE FTR_Number = '5684848452334';

-- Step 3: Drop session index that references FTR_SessionID
ALTER TABLE FITTING_ROOM DROP INDEX idx_ftr_room_session;

-- Step 4: Drop deprecated occupancy columns
ALTER TABLE FITTING_ROOM
  DROP COLUMN FTR_CustomerPresent,
  DROP COLUMN FTR_SessionID,
  DROP COLUMN FTR_ReleasedAt;

-- Step 5: Add performance index on room number and order time
CREATE INDEX idx_ftr_room_order ON FITTING_ROOM (FTR_Number, FTR_OrderTime);
