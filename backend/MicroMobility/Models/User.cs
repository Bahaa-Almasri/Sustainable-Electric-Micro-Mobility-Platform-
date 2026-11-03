namespace MicroMobility.Models;

public sealed class User
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? AuthProvider { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>bcrypt hash ($2b$). Null for accounts created before password sign-in existed.</summary>
    public string? PasswordHash { get; set; }

    /// <summary>Free-text account status; registration writes "active".</summary>
    public string? Status { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<Ride> Rides { get; set; } = new();
    public List<Reservation> Reservations { get; set; } = new();
}
