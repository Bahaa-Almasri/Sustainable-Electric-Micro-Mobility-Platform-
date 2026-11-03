using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using MicroMobility.Services.Auth;

namespace MicroMobility.Testing;

/// <summary>
/// Accounts and sessions that already exist must keep working: stored bcrypt hashes and issued tokens.
/// </summary>
public sealed class AuthCompatibilityTests
{
    private const string Secret = "unit-test-secret-that-is-32-bytes-long!";

    // A stored-format hash ($2b$, cost 12) of "correct horse battery", as existing accounts have.
    private const string ExistingBcryptHash = "$2b$12$Hb/aEpXz0LOrALN7O0pLyeiq3Af/g.pMbD2zGlPg9vUAIeLNZ4GBq";

    private readonly JsonWebTokenHandler _handler = new();

    [Fact]
    public void Password_hash_of_an_existing_account_still_verifies()
    {
        var hasher = new BcryptPasswordHasher();

        hasher.Verify("correct horse battery", ExistingBcryptHash).Should().BeTrue();
        hasher.Verify("wrong password", ExistingBcryptHash).Should().BeFalse();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-a-bcrypt-hash")]
    public void Missing_or_malformed_hashes_fail_closed(string? hash)
    {
        new BcryptPasswordHasher().Verify("anything", hash).Should().BeFalse();
    }

    [Fact]
    public void New_hashes_use_the_same_2b_format_and_cost()
    {
        var hash = new BcryptPasswordHasher().Hash("hunter22hunter22");
        hash.Should().StartWith("$2b$12$");
    }

    [Fact]
    public async Task Previously_issued_session_token_is_accepted()
    {
        var userId = Guid.NewGuid();
        var token = LegacyFormatToken(new { sub = userId.ToString(), email = "rider@example.com", exp = Exp(TimeSpan.FromDays(7)) });

        var result = await _handler.ValidateTokenAsync(token, JwtTokenService.CreateValidationParameters(Secret));

        result.IsValid.Should().BeTrue(result.Exception?.Message);
        result.Claims["sub"].Should().Be(userId.ToString());
    }

    [Fact]
    public async Task Issued_tokens_validate_and_carry_sub_and_email()
    {
        var userId = Guid.NewGuid();
        var service = new JwtTokenService(Options.Create(new JwtOptions { Secret = Secret, ExpireDays = 7 }));

        var token = service.Issue(userId, "rider@example.com");
        var result = await _handler.ValidateTokenAsync(token.Value, JwtTokenService.CreateValidationParameters(Secret));

        result.IsValid.Should().BeTrue();
        result.Claims["sub"].Should().Be(userId.ToString());
        result.Claims["email"].Should().Be("rider@example.com");
        token.ExpiresAt.Should().BeCloseTo(DateTime.UtcNow.AddDays(7), TimeSpan.FromMinutes(1));
    }

    [Fact]
    public async Task Expired_token_is_rejected_with_no_clock_leeway()
    {
        var token = LegacyFormatToken(new { sub = Guid.NewGuid().ToString(), exp = Exp(TimeSpan.FromSeconds(-5)) });

        var result = await _handler.ValidateTokenAsync(token, JwtTokenService.CreateValidationParameters(Secret));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public async Task Token_signed_with_another_secret_is_rejected()
    {
        var token = LegacyFormatToken(new { sub = Guid.NewGuid().ToString(), exp = Exp(TimeSpan.FromHours(1)) },
            secret: "some-other-secret-that-is-32-bytes-long");

        var result = await _handler.ValidateTokenAsync(token, JwtTokenService.CreateValidationParameters(Secret));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public async Task Unsigned_alg_none_token_is_rejected()
    {
        var header = B64(JsonSerializer.SerializeToUtf8Bytes(new { alg = "none", typ = "JWT" }));
        var payload = B64(JsonSerializer.SerializeToUtf8Bytes(new { sub = Guid.NewGuid().ToString(), exp = Exp(TimeSpan.FromHours(1)) }));

        var result = await _handler.ValidateTokenAsync($"{header}.{payload}.", JwtTokenService.CreateValidationParameters(Secret));

        result.IsValid.Should().BeFalse();
    }

    private static long Exp(TimeSpan fromNow) => DateTimeOffset.UtcNow.Add(fromNow).ToUnixTimeSeconds();

    /// <summary>A token in the exact format already issued to users: HS256, header {alg, typ}, claims sub/email/exp.</summary>
    private static string LegacyFormatToken(object payload, string secret = Secret)
    {
        var header = B64(JsonSerializer.SerializeToUtf8Bytes(new { alg = "HS256", typ = "JWT" }));
        var body = B64(JsonSerializer.SerializeToUtf8Bytes(payload));
        var signature = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.ASCII.GetBytes($"{header}.{body}"));
        return $"{header}.{body}.{B64(signature)}";
    }

    private static string B64(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
