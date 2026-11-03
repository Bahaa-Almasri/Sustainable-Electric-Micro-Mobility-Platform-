using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace MicroMobility.Data;

/// <summary>
/// Applies EF migrations, adopting a database that predates them.
/// </summary>
/// <remarks>
/// The Neon database was built from hand-run SQL files before EF existed, so its tables are
/// already there but it has no migrations history. Running InitialSchema against it would fail on
/// the first CREATE TYPE. Instead, when the history table lacks the baseline migration but the
/// schema is clearly present (public.users exists), the baseline is recorded as applied without
/// running it; every later migration then applies normally. A fresh, empty database (tests, a new
/// environment) gets InitialSchema executed for real.
/// </remarks>
public static class DatabaseMigrator
{
    public const string BaselineMigrationId = "20261103000000_InitialSchema";

    public static async Task MigrateAsync(AppDbContext db, ILogger logger, CancellationToken cancellationToken = default)
    {
        var history = db.GetService<IHistoryRepository>();
        await history.CreateIfNotExistsAsync(cancellationToken);

        var applied = (await history.GetAppliedMigrationsAsync(cancellationToken)).Select(x => x.MigrationId).ToHashSet();
        if (!applied.Contains(BaselineMigrationId) && await LegacySchemaExistsAsync(db, cancellationToken))
        {
            var productVersion = typeof(DbContext).Assembly
                .GetCustomAttributes(typeof(System.Reflection.AssemblyInformationalVersionAttribute), false)
                .OfType<System.Reflection.AssemblyInformationalVersionAttribute>()
                .FirstOrDefault()?.InformationalVersion.Split('+')[0] ?? "9.0.0";

            await db.Database.ExecuteSqlRawAsync(
                history.GetInsertScript(new HistoryRow(BaselineMigrationId, productVersion)), cancellationToken);

            logger.LogWarning(
                "Existing schema detected without migration history: recorded {Migration} as applied (baseline) without running it.",
                BaselineMigrationId);
        }

        var pending = (await db.Database.GetPendingMigrationsAsync(cancellationToken)).ToList();
        if (pending.Count > 0)
        {
            logger.LogInformation("Applying {Count} migration(s): {Migrations}", pending.Count, string.Join(", ", pending));
        }

        await db.Database.MigrateAsync(cancellationToken);
    }

    private static async Task<bool> LegacySchemaExistsAsync(AppDbContext db, CancellationToken cancellationToken) =>
        await db.Database
            .SqlQueryRaw<bool>("SELECT to_regclass('public.users') IS NOT NULL AS \"Value\"")
            .SingleAsync(cancellationToken);
}
