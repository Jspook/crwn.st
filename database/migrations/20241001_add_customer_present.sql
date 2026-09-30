-- ==========================================================
-- Migration: 20241001_add_customer_present
-- Defect-2 fix: track actual customer presence in fitting room
--               independent of pending-item delivery status
-- ==========================================================

-- Add FTR_CustomerPresent column (1 = customer inside, 0 = room free)
ALTER TABLE FITTING_ROOM
  ADD COLUMN IF NOT EXISTS FTR_CustomerPresent TINYINT(1) NOT NULL DEFAULT 0;

-- Performance index for fast status lookup
CREATE INDEX IF NOT EXISTS idx_ftr_customer_present ON FITTING_ROOM(FTR_CustomerPresent);
