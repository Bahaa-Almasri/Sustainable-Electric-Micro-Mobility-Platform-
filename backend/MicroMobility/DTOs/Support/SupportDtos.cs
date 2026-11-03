using MicroMobility.Models;

namespace MicroMobility.DTOs;

/// <summary>`subject` is stored as the ticket title. `category` defaults to "other".</summary>
public sealed record SupportTicketCreateRequest(string? Subject, string? Description, TicketCategory? Category);

/// <summary>`subject` repeats `title` — the app reads it under that name.</summary>
public sealed record SupportTicketResponse(
    Guid TicketId,
    Guid UserId,
    Guid? RideId,
    TicketCategory Category,
    TicketPriority Priority,
    TicketStatus Status,
    string Title,
    string Subject,
    string Description,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    DateTime? ResolvedAt)
{
    public static SupportTicketResponse FromEntity(SupportTicket t) =>
        new(t.Id, t.UserId, t.RideId, t.Category, t.Priority, t.Status, t.Title, t.Title, t.Description,
            t.CreatedAt, t.UpdatedAt, t.ResolvedAt);
}

public sealed record OkResponse(bool Ok);
