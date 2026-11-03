using Hangfire;
using MicroMobility.Services.Realtime;

namespace MicroMobility.Services.Reservations;

/// <summary>
/// Recurring sweep (every minute) that expires lapsed reservations and frees their vehicles.
/// A plain scoped class, so a test can resolve it and run one pass directly.
/// </summary>
/// <remarks>
/// Idempotent (a second pass finds nothing) and never retried: the next run a minute later is the
/// retry. The interval is a latency knob, not a deadline: a lapsed hold is released within a minute
/// on read paths, and immediately on any write path that touches it.
/// </remarks>
[DisableConcurrentExecution(timeoutInSeconds: 60)]
[AutomaticRetry(Attempts = 0)]
public sealed class ReservationExpirySweepJob
{
    public const string RecurringJobId = "reservation-expiry-sweep";

    private readonly IReservationExpiry _expiry;
    private readonly INotificationNotifier _notifier;
    private readonly ILogger<ReservationExpirySweepJob> _logger;

    public ReservationExpirySweepJob(
        IReservationExpiry expiry, INotificationNotifier notifier, ILogger<ReservationExpirySweepJob> logger)
    {
        _expiry = expiry;
        _notifier = notifier;
        _logger = logger;
    }

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        var expired = await _expiry.ExpireDueAsync(cancellationToken);
        if (expired.Count > 0)
        {
            _logger.LogInformation("Expired {Count} reservation(s).", expired.Count);
        }
        await _notifier.NotifyReservationsExpiredAsync(expired, cancellationToken);
    }
}
