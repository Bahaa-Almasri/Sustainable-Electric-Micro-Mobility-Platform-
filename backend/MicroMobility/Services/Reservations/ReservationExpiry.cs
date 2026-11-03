using Microsoft.EntityFrameworkCore;
using MicroMobility.Data;
using MicroMobility.DTOs;
using MicroMobility.Models;
using MicroMobility.Services.Realtime;

namespace MicroMobility.Services.Reservations;

public sealed class ReservationOptions
{
    public const string SectionName = "Reservations";

    public int DefaultTtlMinutes { get; set; } = 15;
    public int MinTtlMinutes { get; set; } = 1;
    public int MaxTtlMinutes { get; set; } = 60;

    /// <summary>Clamps a requested hold time instead of rejecting it.</summary>
    public int NormalizeTtl(int? requested) =>
        Math.Clamp(requested ?? DefaultTtlMinutes, MinTtlMinutes, Math.Max(MinTtlMinutes, MaxTtlMinutes));
}

/// <summary>Columns are named to match the raw query's aliases.</summary>
public sealed class ExpiredReservation
{
    public Guid ReservationId { get; set; }
    public Guid UserId { get; set; }
    public Guid VehicleId { get; set; }
}

public interface IReservationExpiry
{
    /// <summary>
    /// Expires every active reservation past its expiry and releases the vehicles they held, in one
    /// atomic statement. Idempotent: a second call finds nothing. Returns what it expired so the
    /// caller can notify — after its own transaction commits.
    /// </summary>
    Task<IReadOnlyList<ExpiredReservation>> ExpireDueAsync(CancellationToken cancellationToken);
}

public sealed class ReservationExpiry : IReservationExpiry
{
    private readonly AppDbContext _db;

    public ReservationExpiry(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<ExpiredReservation>> ExpireDueAsync(CancellationToken cancellationToken)
    {
        // Raw-SQL parameters get EF's default DateTime mapping (timestamptz), so the app's UTC clock is
        // sent as such and converted to the column's `timestamp without time zone` (UTC) explicitly.
        // The app clock, not the database's now(): reservations are written with the app clock too.
        var now = DateTime.UtcNow;

        // Data-modifying CTEs run to completion even though the outer SELECT reads only one of
        // them, so "expire" and "release" happen together or not at all.
        return await _db.Database.SqlQuery<ExpiredReservation>($"""
            WITH expired AS (
                UPDATE public.reservations
                SET status = 'expired'
                WHERE status = 'active' AND expires_at <= ({now}::timestamptz AT TIME ZONE 'UTC')
                RETURNING reservation_id, user_id, vehicle_id
            ),
            released AS (
                UPDATE public.vehicles v
                SET availability_status = 'available'
                WHERE v.vehicle_id IN (SELECT DISTINCT vehicle_id FROM expired)
                  AND v.availability_status = 'reserved'
                RETURNING v.vehicle_id
            )
            SELECT reservation_id AS "ReservationId", user_id AS "UserId", vehicle_id AS "VehicleId"
            FROM expired
            """).ToListAsync(cancellationToken);
    }
}

/// <summary>Called by read paths that show vehicle availability or reservations.</summary>
public interface IReservationFreshness
{
    Task EnsureFreshAsync(CancellationToken cancellationToken);
}

/// <summary>
/// Used when Hangfire is off (tests, a minimal deployment): nothing else expires reservations, so
/// reads do it themselves, exactly as the Python API did on every request.
/// </summary>
public sealed class InlineReservationFreshness : IReservationFreshness
{
    private readonly IReservationExpiry _expiry;
    private readonly INotificationNotifier _notifier;

    public InlineReservationFreshness(IReservationExpiry expiry, INotificationNotifier notifier)
    {
        _expiry = expiry;
        _notifier = notifier;
    }

    public async Task EnsureFreshAsync(CancellationToken cancellationToken)
    {
        var expired = await _expiry.ExpireDueAsync(cancellationToken);
        await _notifier.NotifyReservationsExpiredAsync(expired, cancellationToken);
    }
}

/// <summary>
/// Used when Hangfire runs <see cref="ReservationExpirySweepJob"/> every minute: reads skip the
/// write. Write paths (reserve, start ride, cancel) still expire inline inside their transaction,
/// so a decision is never made on a reservation that has lapsed.
/// </summary>
public sealed class ScheduledReservationFreshness : IReservationFreshness
{
    public Task EnsureFreshAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

public static class ReservationNotifications
{
    public static async Task NotifyReservationsExpiredAsync(
        this INotificationNotifier notifier, IEnumerable<ExpiredReservation> expired, CancellationToken cancellationToken)
    {
        foreach (var item in expired)
        {
            await notifier.NotifyAsync(item.UserId, NotificationEvents.ReservationExpired,
                new ReservationNotificationPayload(item.ReservationId, item.VehicleId, ReservationStatus.Expired, null),
                cancellationToken);
        }
    }
}
