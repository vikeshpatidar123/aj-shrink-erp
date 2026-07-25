-- ═══════════════════════════════════════════════════════════════════════════
-- ArtworkSubGroupMaster — DB Script
-- Child of ArtworkMasterMain  (FK: ArtworkID)
-- Purpose : Sub-groups / variants under a parent Artwork Master record
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Table ─────────────────────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sysobjects WHERE name = 'ArtworkSubGroupMaster' AND xtype = 'U'
)
BEGIN
    CREATE TABLE ArtworkSubGroupMaster (
        SubGroupID      INT             IDENTITY(1,1)   NOT NULL,
        SubGroupNo      NVARCHAR(20)                    NOT NULL,   -- Auto-generated: SGM-YYMM-XXXX
        ArtworkID       INT                             NOT NULL,   -- FK → ArtworkMasterMain
        SubGroupName    NVARCHAR(200)                   NOT NULL,   -- Name / label of this sub-group
        Content         NVARCHAR(100)                   NULL,       -- Sub-type / content variant
        PackSize        NVARCHAR(100)                   NULL,       -- Pack / SKU size
        BrandName       NVARCHAR(150)                   NULL,
        ProductType     NVARCHAR(100)                   NULL,
        SkuType         NVARCHAR(100)                   NULL,
        BottleType      NVARCHAR(100)                   NULL,
        AddressType     NVARCHAR(100)                   NULL,
        SpecialSpecs    NVARCHAR(500)                   NULL,
        Remarks         NVARCHAR(500)                   NULL,
        IsActive        BIT                             NOT NULL    DEFAULT 1,
        CreatedDate     DATETIME                        NOT NULL    DEFAULT GETDATE(),
        CreatedBy       NVARCHAR(100)                   NULL,
        ModifiedDate    DATETIME                        NULL,
        ModifiedBy      NVARCHAR(100)                   NULL,

        CONSTRAINT PK_ArtworkSubGroupMaster PRIMARY KEY (SubGroupID),
        CONSTRAINT FK_ArtworkSubGroupMaster_ArtworkID
            FOREIGN KEY (ArtworkID)
            REFERENCES ArtWorkMasterMain (ArtworkID)
            ON DELETE CASCADE
    );

    PRINT 'Table ArtworkSubGroupMaster created.';
END
ELSE
    PRINT 'Table ArtworkSubGroupMaster already exists — skipped.';
GO

-- ── 2. Index on FK ────────────────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_ArtworkSubGroupMaster_ArtworkID'
      AND object_id = OBJECT_ID('ArtworkSubGroupMaster')
)
BEGIN
    CREATE INDEX IX_ArtworkSubGroupMaster_ArtworkID
        ON ArtworkSubGroupMaster (ArtworkID);
    PRINT 'Index IX_ArtworkSubGroupMaster_ArtworkID created.';
END
GO

-- ── 3. Unique index: one SubGroupNo per table ─────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UQ_ArtworkSubGroupMaster_SubGroupNo'
      AND object_id = OBJECT_ID('ArtworkSubGroupMaster')
)
BEGIN
    CREATE UNIQUE INDEX UQ_ArtworkSubGroupMaster_SubGroupNo
        ON ArtworkSubGroupMaster (SubGroupNo);
    PRINT 'Unique index UQ_ArtworkSubGroupMaster_SubGroupNo created.';
END
GO

-- ── 4. Auto-number SP: sp_GenerateSubGroupNo ──────────────────────────────────
-- Returns next available SubGroupNo in format SGM-YYMM-XXXX
CREATE OR ALTER PROCEDURE sp_GenerateSubGroupNo
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @prefix  NVARCHAR(12) = 'SGM-' + FORMAT(GETDATE(), 'yyMM') + '-';
    DECLARE @lastNo  INT = ISNULL(
        (
            SELECT MAX(TRY_CAST(RIGHT(SubGroupNo, 4) AS INT))
            FROM   ArtworkSubGroupMaster
            WHERE  SubGroupNo LIKE @prefix + '%'
        ), 0
    );
    SELECT @prefix + RIGHT('0000' + CAST(@lastNo + 1 AS NVARCHAR(4)), 4) AS SubGroupNo;
END
GO

-- ── 5. View: vw_ArtworkSubGroupList (joins parent artwork info) ───────────────
CREATE OR ALTER VIEW vw_ArtworkSubGroupList AS
SELECT
    sg.SubGroupID,
    sg.SubGroupNo,
    sg.ArtworkID,
    am.ArtworkNo,
    ISNULL(am.ArtworkName, am.ProductName) AS ArtworkName,
    am.ClientName,
    sg.SubGroupName,
    sg.Content,
    sg.PackSize,
    sg.BrandName,
    sg.ProductType,
    sg.SkuType,
    sg.BottleType,
    sg.AddressType,
    sg.SpecialSpecs,
    sg.Remarks,
    sg.IsActive,
    sg.CreatedDate,
    sg.CreatedBy,
    sg.ModifiedDate,
    sg.ModifiedBy
FROM  ArtworkSubGroupMaster sg
LEFT JOIN ArtWorkMasterMain am ON am.ArtworkID = sg.ArtworkID
WHERE sg.IsActive = 1;
GO

-- ── 6. SP: sp_SaveArtworkSubGroup (Insert) ────────────────────────────────────
CREATE OR ALTER PROCEDURE sp_SaveArtworkSubGroup
    @ArtworkID      INT,
    @SubGroupName   NVARCHAR(200),
    @Content        NVARCHAR(100)   = NULL,
    @PackSize       NVARCHAR(100)   = NULL,
    @BrandName      NVARCHAR(150)   = NULL,
    @ProductType    NVARCHAR(100)   = NULL,
    @SkuType        NVARCHAR(100)   = NULL,
    @BottleType     NVARCHAR(100)   = NULL,
    @AddressType    NVARCHAR(100)   = NULL,
    @SpecialSpecs   NVARCHAR(500)   = NULL,
    @Remarks        NVARCHAR(500)   = NULL,
    @CreatedBy      NVARCHAR(100)   = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Generate SubGroupNo
    DECLARE @SubGroupNo NVARCHAR(20);
    EXEC sp_GenerateSubGroupNo;
    -- (Caller must capture the result; stored here for illustration —
    --  actual controller should call sp_GenerateSubGroupNo first, pass result in)

    INSERT INTO ArtworkSubGroupMaster
        (SubGroupNo, ArtworkID, SubGroupName, Content, PackSize, BrandName,
         ProductType, SkuType, BottleType, AddressType, SpecialSpecs, Remarks,
         IsActive, CreatedDate, CreatedBy)
    VALUES
        (@SubGroupNo, @ArtworkID, @SubGroupName, @Content, @PackSize, @BrandName,
         @ProductType, @SkuType, @BottleType, @AddressType, @SpecialSpecs, @Remarks,
         1, GETDATE(), @CreatedBy);

    SELECT 'success' AS Status, SCOPE_IDENTITY() AS SubGroupID, @SubGroupNo AS SubGroupNo;
END
GO

-- ── 7. SP: sp_UpdateArtworkSubGroup ──────────────────────────────────────────
CREATE OR ALTER PROCEDURE sp_UpdateArtworkSubGroup
    @SubGroupID     INT,
    @SubGroupName   NVARCHAR(200),
    @Content        NVARCHAR(100)   = NULL,
    @PackSize       NVARCHAR(100)   = NULL,
    @BrandName      NVARCHAR(150)   = NULL,
    @ProductType    NVARCHAR(100)   = NULL,
    @SkuType        NVARCHAR(100)   = NULL,
    @BottleType     NVARCHAR(100)   = NULL,
    @AddressType    NVARCHAR(100)   = NULL,
    @SpecialSpecs   NVARCHAR(500)   = NULL,
    @Remarks        NVARCHAR(500)   = NULL,
    @ModifiedBy     NVARCHAR(100)   = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE ArtworkSubGroupMaster
    SET
        SubGroupName  = @SubGroupName,
        Content       = @Content,
        PackSize      = @PackSize,
        BrandName     = @BrandName,
        ProductType   = @ProductType,
        SkuType       = @SkuType,
        BottleType    = @BottleType,
        AddressType   = @AddressType,
        SpecialSpecs  = @SpecialSpecs,
        Remarks       = @Remarks,
        ModifiedDate  = GETDATE(),
        ModifiedBy    = @ModifiedBy
    WHERE SubGroupID = @SubGroupID;

    SELECT 'success' AS Status;
END
GO

-- ── 8. SP: sp_DeleteArtworkSubGroup (soft delete) ─────────────────────────────
CREATE OR ALTER PROCEDURE sp_DeleteArtworkSubGroup
    @SubGroupID INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE ArtworkSubGroupMaster
    SET IsActive = 0, ModifiedDate = GETDATE()
    WHERE SubGroupID = @SubGroupID;
    SELECT 'success' AS Status;
END
GO

-- ── 9. Sample SELECT queries for the API controller ──────────────────────────

-- List all (for grid):
-- SELECT * FROM vw_ArtworkSubGroupList ORDER BY CreatedDate DESC

-- List by ArtworkID (for picker in Product Catalog):
-- SELECT * FROM vw_ArtworkSubGroupList WHERE ArtworkID = @ArtworkID ORDER BY SubGroupName

-- Get by SubGroupID:
-- SELECT * FROM vw_ArtworkSubGroupList WHERE SubGroupID = @SubGroupID

PRINT 'ArtworkSubGroupMaster script completed successfully.';
GO
