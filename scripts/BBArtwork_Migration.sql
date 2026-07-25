-- ============================================================
-- BB Artwork Migration Script
-- Renames SubGroup → BBArtwork across all tables & columns
-- Production-safe: idempotent checks, full transaction, rollback on error
-- Run on: IndusNext DB (65.2.64.18,1433)
-- ============================================================

SET NOCOUNT ON;

BEGIN TRY
  BEGIN TRANSACTION BBMigration;

  -- ──────────────────────────────────────────────────────────
  -- 1. Rename table: ArtworkSubGroupMaster → BBArtworkMaster
  -- ──────────────────────────────────────────────────────────
  IF EXISTS     (SELECT 1 FROM sysobjects WHERE name = 'ArtworkSubGroupMaster' AND xtype = 'U')
  AND NOT EXISTS(SELECT 1 FROM sysobjects WHERE name = 'BBArtworkMaster'        AND xtype = 'U')
  BEGIN
    EXEC sp_rename 'ArtworkSubGroupMaster', 'BBArtworkMaster';
    PRINT 'OK: ArtworkSubGroupMaster → BBArtworkMaster';
  END
  ELSE PRINT 'SKIP: ArtworkSubGroupMaster rename (already done or not found)';

  -- ──────────────────────────────────────────────────────────
  -- 2. Rename Primary Key constraint on BBArtworkMaster
  -- ──────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'PK_ArtworkSubGroupMaster')
  BEGIN
    EXEC sp_rename 'PK_ArtworkSubGroupMaster', 'PK_BBArtworkMaster', 'OBJECT';
    PRINT 'OK: PK_ArtworkSubGroupMaster → PK_BBArtworkMaster';
  END

  -- ──────────────────────────────────────────────────────────
  -- 3. Rename columns in BBArtworkMaster
  -- ──────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='BBArtworkMaster' AND COLUMN_NAME='SubGroupID')
  BEGIN
    EXEC sp_rename 'BBArtworkMaster.SubGroupID', 'BBArtworkID', 'COLUMN';
    PRINT 'OK: BBArtworkMaster.SubGroupID → BBArtworkID';
  END

  IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='BBArtworkMaster' AND COLUMN_NAME='SubGroupNo')
  BEGIN
    EXEC sp_rename 'BBArtworkMaster.SubGroupNo', 'BBArtworkNo', 'COLUMN';
    PRINT 'OK: BBArtworkMaster.SubGroupNo → BBArtworkNo';
  END

  IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='BBArtworkMaster' AND COLUMN_NAME='SubGroupName')
  BEGIN
    EXEC sp_rename 'BBArtworkMaster.SubGroupName', 'BBArtworkName', 'COLUMN';
    PRINT 'OK: BBArtworkMaster.SubGroupName → BBArtworkName';
  END

  -- ──────────────────────────────────────────────────────────
  -- 4. Rename table: SubGroupFileDetails → BBArtworkFileDetails
  -- ──────────────────────────────────────────────────────────
  IF EXISTS     (SELECT 1 FROM sysobjects WHERE name = 'SubGroupFileDetails' AND xtype = 'U')
  AND NOT EXISTS(SELECT 1 FROM sysobjects WHERE name = 'BBArtworkFileDetails' AND xtype = 'U')
  BEGIN
    EXEC sp_rename 'SubGroupFileDetails', 'BBArtworkFileDetails';
    PRINT 'OK: SubGroupFileDetails → BBArtworkFileDetails';
  END
  ELSE PRINT 'SKIP: SubGroupFileDetails rename (already done or not found)';

  -- ──────────────────────────────────────────────────────────
  -- 5. Rename Primary Key constraint on BBArtworkFileDetails
  -- ──────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'PK_SubGroupFileDetails')
  BEGIN
    EXEC sp_rename 'PK_SubGroupFileDetails', 'PK_BBArtworkFileDetails', 'OBJECT';
    PRINT 'OK: PK_SubGroupFileDetails → PK_BBArtworkFileDetails';
  END

  -- ──────────────────────────────────────────────────────────
  -- 6. Rename SubGroupID column in BBArtworkFileDetails
  -- ──────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='BBArtworkFileDetails' AND COLUMN_NAME='SubGroupID')
  BEGIN
    EXEC sp_rename 'BBArtworkFileDetails.SubGroupID', 'BBArtworkID', 'COLUMN';
    PRINT 'OK: BBArtworkFileDetails.SubGroupID → BBArtworkID';
  END

  -- ──────────────────────────────────────────────────────────
  -- 7. Update existing BBArtworkNo values: SGM- → BB-
  --    (Optional — keeps existing record numbers consistent)
  -- ──────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM sysobjects WHERE name='BBArtworkMaster' AND xtype='U')
  BEGIN
    UPDATE BBArtworkMaster
    SET BBArtworkNo = REPLACE(BBArtworkNo, 'SGM-', 'BB-')
    WHERE BBArtworkNo LIKE 'SGM-%';
    PRINT 'OK: Existing SGM- numbers updated to BB-';
  END

  COMMIT TRANSACTION BBMigration;
  PRINT '';
  PRINT '✅ BB Artwork migration completed successfully.';
  PRINT '   Tables renamed: ArtworkSubGroupMaster → BBArtworkMaster';
  PRINT '                   SubGroupFileDetails   → BBArtworkFileDetails';
  PRINT '   Columns renamed: SubGroupID → BBArtworkID';
  PRINT '                    SubGroupNo → BBArtworkNo';
  PRINT '                    SubGroupName → BBArtworkName';

END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION BBMigration;
  PRINT '';
  PRINT '❌ Migration FAILED — rolled back.';
  PRINT 'Error: ' + ERROR_MESSAGE();
  PRINT 'Line:  ' + CAST(ERROR_LINE() AS VARCHAR);
  THROW;
END CATCH
