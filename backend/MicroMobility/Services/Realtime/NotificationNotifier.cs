using Microsoft.AspNetCore.SignalR;
using MicroMobility.Hubs;

namespace MicroMobility.Services.Realtime;

public interface INotificationNotifier
{
    /// <summary>Best-effort push to every live connection of one user. Never throws.</summary>
    Task NotifyAsync(Guid userId, string eventName, object payload, CancellationToken cancellationToken = default);
}

public sealed class NotificationNotifier : INotificationNotifier
{
    private readonly IHubContext<NotificationHub> _hub;
    private readonly ILogger<NotificationNotifier> _logger;

    public NotificationNotifier(IHubContext<NotificationHub> hub, ILogger<NotificationNotifier> logger)
    {
        _hub = hub;
        _logger = logger;
    }

    public async Task NotifyAsync(Guid userId, string eventName, object payload, CancellationToken cancellationToken = default)
    {
        try
        {
            // With no live connection for this user this is a harmless no-op.
            await _hub.Clients.User(userId.ToString()).SendAsync(eventName, payload, cancellationToken);
        }
        catch (Exception exception)
        {
            // Realtime is best-effort: clients still catch up on their next refresh. A hub hiccup
            // must never fail the request that caused the event.
            _logger.LogWarning(exception, "Failed to deliver realtime notification {EventName}.", eventName);
        }
    }
}
