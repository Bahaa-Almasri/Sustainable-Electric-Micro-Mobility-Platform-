using Microsoft.EntityFrameworkCore;
using MicroMobility.Data;
using MicroMobility.DTOs;
using MicroMobility.Helpers;
using MicroMobility.Models;
using MicroMobility.Services.CurrentUser;

namespace MicroMobility.Services.SupportService;

public interface ISupportService
{
    /// <summary>The caller's tickets, newest first.</summary>
    Task<IReadOnlyList<SupportTicketResponse>> ListMineAsync(CancellationToken cancellationToken);

    Task CreateAsync(SupportTicketCreateRequest request, CancellationToken cancellationToken);
}

public sealed class SupportService : ISupportService
{
    private const int SubjectMaxLength = 200;     // support_tickets.title is varchar(200)
    private const int DescriptionMaxLength = 5000;

    private readonly AppDbContext _db;
    private readonly ICurrentUser _currentUser;

    public SupportService(AppDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<SupportTicketResponse>> ListMineAsync(CancellationToken cancellationToken)
    {
        var userId = _currentUser.RequireUserId();
        var tickets = await _db.SupportTickets.AsNoTracking()
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(cancellationToken);
        return tickets.Select(SupportTicketResponse.FromEntity).ToList();
    }

    public async Task CreateAsync(SupportTicketCreateRequest request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.RequireUserId();
        var subject = Guard.RequiredText(request.Subject, "subject", maxLength: SubjectMaxLength);
        var description = Guard.RequiredText(request.Description, "description", maxLength: DescriptionMaxLength);

        _db.SupportTickets.Add(new SupportTicket
        {
            UserId = userId,
            Title = subject,
            Description = description,
            Category = request.Category ?? TicketCategory.Other,
            Priority = TicketPriority.Medium,
            Status = TicketStatus.Open
        });
        await _db.SaveChangesAsync(cancellationToken);
    }
}
