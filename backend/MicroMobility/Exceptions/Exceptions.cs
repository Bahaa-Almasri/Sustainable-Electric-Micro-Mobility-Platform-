namespace MicroMobility.Exceptions;

/// <summary>
/// Stable, machine-readable error codes. Clients branch on these, never on message text — the
/// wording may change or be translated. Sent as the `code` field of a ProblemDetails body.
/// </summary>
public static class ErrorCodes
{
    public const string NotAuthenticated = "NotAuthenticated";
    public const string InvalidToken = "InvalidToken";
    public const string InvalidCredentials = "InvalidCredentials";
    public const string ValidationFailed = "ValidationFailed";
    public const string EmailTaken = "EmailTaken";
    public const string ActiveRideExists = "ActiveRideExists";
    public const string VehicleUnavailable = "VehicleUnavailable";
    public const string VehicleReservedByAnotherUser = "VehicleReservedByAnotherUser";
    public const string RideNotActive = "RideNotActive";
    public const string RateLimited = "RateLimited";
}

/// <summary>409: the request conflicts with the current state (vehicle taken, ride already active…).</summary>
public sealed class ConflictException : Exception
{
    public ConflictException(string message, string code) : base(message) => Code = code;

    public string Code { get; }
}

/// <summary>401 for a failed sign-in. Distinct from UnauthorizedAccessException, which is a 403.</summary>
public sealed class AuthenticationFailedException : Exception
{
    public AuthenticationFailedException(string message) : base(message) { }
}
