-- ==========================================================
-- Migration: 20261014_fix_skirt_category.sql
-- Audit Remediation: BUG-003 / Task T03
-- Correct skirt items misclassified as 'male' to 'female'
-- Items: p52, p54, p56, p58, p60
-- ==========================================================

UPDATE ITEM
SET ITM_Category = 'female'
WHERE ITM_ID IN ('p52', 'p54', 'p56', 'p58', 'p60')
  AND ITM_Tag = 'skirt';
