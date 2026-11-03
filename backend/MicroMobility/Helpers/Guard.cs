using System.Text.RegularExpressions;

namespace MicroMobility.Helpers;

/// <summary>
/// Input checks for services. Each failure is an ArgumentException whose message is shown to the
/// user as-is, so it names the field as the client sends it (snake_case) and reads as a sentence.
/// </summary>
public static partial class Guard
{
    public static T Required<T>(T? value, string field) where T : struct =>
        value ?? throw new ArgumentException($"{field} is required.", field);

    public static string RequiredText(string? value, string field, int minLength = 1, int maxLength = int.MaxValue)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed)) throw new ArgumentException($"{field} is required.", field);
        if (trimmed.Length < minLength)
            throw new ArgumentException($"{field} must be at least {minLength} characters.", field);
        if (trimmed.Length > maxLength)
            throw new ArgumentException($"{field} must be at most {maxLength} characters.", field);
        return trimmed;
    }

    /// <summary>Validates and normalizes (trimmed, lower-case) an email address.</summary>
    public static string Email(string? value, string field = "email")
    {
        var email = RequiredText(value, field, maxLength: 255).ToLowerInvariant();
        if (!EmailPattern().IsMatch(email)) throw new ArgumentException($"{field} is not a valid email address.", field);
        return email;
    }

    // Deliberately simple: one @, no spaces, a dot in the domain. Deliverability is the mailbox's job.
    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailPattern();
}
