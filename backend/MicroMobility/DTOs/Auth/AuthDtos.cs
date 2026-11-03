using MicroMobility.Models;

namespace MicroMobility.DTOs;

// Request records use nullable members so a missing field reaches the service, which answers with
// a sentence ("password is required.") instead of a framework binding message.

public sealed record RegisterRequest(string? Email, string? Password, string? Name, string? PhoneNumber);

public sealed record LoginRequest(string? Email, string? Password);

public sealed record TokenResponse(string AccessToken, string TokenType, Guid UserId, string? Email);

public sealed record UserResponse(Guid UserId, string? Email, string? Name, string? PhoneNumber, string? Status)
{
    public static UserResponse FromEntity(User user) =>
        new(user.Id, user.Email, user.Name, user.PhoneNumber, user.Status);
}
