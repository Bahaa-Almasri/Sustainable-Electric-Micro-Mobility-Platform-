namespace MicroMobility.Services.Auth;

public interface IPasswordHasher
{
    string Hash(string password);

    /// <summary>False for a missing or malformed hash instead of throwing.</summary>
    bool Verify(string password, string? hash);
}

/// <summary>
/// bcrypt, cost 12, $2b$ — the format of the hashes already stored in users.password_hash, so
/// existing accounts verify and new hashes are interchangeable with them.
/// </summary>
public sealed class BcryptPasswordHasher : IPasswordHasher
{
    private const int WorkFactor = 12;

    public string Hash(string password) =>
        BCrypt.Net.BCrypt.HashPassword(password, BCrypt.Net.BCrypt.GenerateSalt(WorkFactor, 'b'));

    public bool Verify(string password, string? hash)
    {
        if (string.IsNullOrWhiteSpace(hash)) return false;
        try
        {
            return BCrypt.Net.BCrypt.Verify(password, hash);
        }
        catch (BCrypt.Net.SaltParseException)
        {
            return false;
        }
    }
}
