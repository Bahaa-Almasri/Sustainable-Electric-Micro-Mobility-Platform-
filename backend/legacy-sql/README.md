# Legacy SQL migrations (historical)

These hand-run scripts built the Neon schema before the backend moved to .NET. They are kept for
reference only — **do not run them**.

The schema is now owned by EF Core migrations in `MicroMobility/Data/Migrations/`. The first one,
`InitialSchema`, describes the database these scripts produced; on a database that already has
the tables, the app records it as applied without running it (see `Data/DatabaseMigrator.cs`).
