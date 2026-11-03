using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.IdentityModel.JsonWebTokens;

namespace MicroMobility.Hubs;

/// <summary>
/// Per-user notification stream at /hubs/notifications. No client-callable methods: the server
/// pushes events (see NotificationEvents) and the client refreshes.
///
/// SECURITY: messages go out with Clients.User(userId), and <see cref="SubUserIdProvider"/> resolves
/// a connection's user from the verified token's `sub`. A client can only receive its own events.
/// </summary>
[Authorize]
public sealed class NotificationHub : Hub
{
}

/// <summary>Maps a hub connection to the `sub` (user id) claim of its access token.</summary>
public sealed class SubUserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection) =>
        connection.User?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
}
