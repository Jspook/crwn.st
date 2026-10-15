-- Additive migration. REVIEW ONLY: apply first to an isolated MySQL test DB.
-- Do not run against a shared DB; back up first and verify prior migrations are applied.
-- Existing FITTING_ROOM rows retain NULL FTR_SessionID (historical, not current feed).
CREATE TABLE FITTING_ROOM_SESSION (
  FTR_SessionID VARCHAR(50) NOT NULL PRIMARY KEY,
  FTR_RoomNumber VARCHAR(20) NOT NULL,
  CUS_ID VARCHAR(50) NOT NULL,
  FTR_StartedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FTR_LastSeenAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FTR_EndedAt DATETIME NULL,
  FTR_EndReason VARCHAR(20) NULL,
  CONSTRAINT fk_ftr_session_customer FOREIGN KEY (CUS_ID) REFERENCES CUSTOMER(CUS_ID),
  INDEX idx_ftr_session_room (FTR_RoomNumber, FTR_EndedAt)
) ENGINE=InnoDB;

CREATE TABLE FITTING_ROOM_SLOT (
  FTR_RoomNumber VARCHAR(20) NOT NULL PRIMARY KEY,
  FTR_ActiveSessionID VARCHAR(50) NULL,
  CONSTRAINT fk_ftr_slot_session FOREIGN KEY (FTR_ActiveSessionID) REFERENCES FITTING_ROOM_SESSION(FTR_SessionID)
) ENGINE=InnoDB;

ALTER TABLE FITTING_ROOM
  ADD COLUMN FTR_SessionID VARCHAR(50) NULL,
  ADD COLUMN FTR_CancelledAt DATETIME NULL,
  ADD CONSTRAINT fk_ftr_order_session FOREIGN KEY (FTR_SessionID) REFERENCES FITTING_ROOM_SESSION(FTR_SessionID),
  ADD INDEX idx_ftr_session_status (FTR_SessionID, FTR_CancelledAt, FTR_FinishTime);
