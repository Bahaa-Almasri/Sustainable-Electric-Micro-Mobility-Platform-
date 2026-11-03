using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MicroMobility.DTOs;
using MicroMobility.Models;
using MicroMobility.Testing.Integration.Infrastructure;

namespace MicroMobility.Testing.Integration;

public sealed class AuthAndErrorContractTests : IntegrationTestBase
{
    public AuthAndErrorContractTests(IntegrationTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task Health_is_anonymous()
    {
        var response = await Client.GetAsync("/health");
        (await ReadJsonAsync(response)).GetProperty("status").GetString().Should().Be("ok");
    }

    [Fact]
    public async Task Missing_token_is_a_401_problem_saying_not_authenticated()
    {
        var problem = await ProblemAsync(await Client.GetAsync("/rides/me"), 401);
        problem.GetProperty("detail").GetString().Should().Be("Not authenticated");
        problem.GetProperty("code").GetString().Should().Be("NotAuthenticated");
    }

    [Fact]
    public async Task Garbage_token_is_a_401_problem_saying_invalid_or_expired()
    {
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "not.a.jwt");
        var problem = await ProblemAsync(await Client.GetAsync("/rides/me"), 401);
        problem.GetProperty("detail").GetString().Should().Be("Invalid or expired token");
    }

    [Fact]
    public async Task Register_then_use_the_token()
    {
        var response = await PostAsync(Client, "/auth/register", new RegisterRequest(
            " New.Rider@Example.com ", "longenough", "  New Rider ", " +96170000000 "));
        var token = await ReadAsync<TokenResponse>(response);

        token.TokenType.Should().Be("bearer");
        token.Email.Should().Be("new.rider@example.com");

        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);
        var me = await ReadAsync<UserResponse>(await Client.GetAsync("/users/me"));
        me.Should().Be(new UserResponse(token.UserId, "new.rider@example.com", "New Rider", "+96170000000", "active"));
    }

    [Fact]
    public async Task Registering_a_taken_email_is_a_409_regardless_of_case()
    {
        await SignedInUserAsync("taken@example.com");

        var problem = await ProblemAsync(await PostAsync(Client, "/auth/register",
            new RegisterRequest("TAKEN@example.com", "longenough", "Someone", "+15555550101")), 409);
        problem.GetProperty("code").GetString().Should().Be("EmailTaken");
    }

    [Theory]
    [InlineData("rider@example.com", "short", "Name", "+15555550101", "password must be at least 8 characters.")]
    [InlineData("not-an-email", "longenough", "Name", "+15555550101", "email is not a valid email address.")]
    [InlineData("rider@example.com", "longenough", "   ", "+15555550101", "name is required.")]
    [InlineData("rider@example.com", "longenough", "Name", "123", "phone_number must be at least 7 characters.")]
    public async Task Invalid_registration_is_a_400_with_a_readable_sentence(
        string email, string password, string name, string phone, string expected)
    {
        var problem = await ProblemAsync(await PostAsync(Client, "/auth/register",
            new RegisterRequest(email, password, name, phone)), 400);
        problem.GetProperty("detail").GetString().Should().Be(expected);
    }

    [Fact]
    public async Task Login_accepts_a_password_hash_stored_before_the_migration()
    {
        // A stored-format hash ($2b$, cost 12) of "correct horse battery", as existing accounts have.
        await WithDbAsync(async db =>
        {
            db.Users.Add(new User
            {
                Email = "legacy@example.com", Name = "Legacy", Status = "active",
                PasswordHash = "$2b$12$Hb/aEpXz0LOrALN7O0pLyeiq3Af/g.pMbD2zGlPg9vUAIeLNZ4GBq"
            });
            await db.SaveChangesAsync();
        });

        var ok = await PostAsync(Client, "/auth/login", new LoginRequest("Legacy@Example.com", "correct horse battery"));
        (await ReadAsync<TokenResponse>(ok)).Email.Should().Be("legacy@example.com");

        var wrong = await ProblemAsync(await PostAsync(Client, "/auth/login", new LoginRequest("legacy@example.com", "nope")), 401);
        wrong.GetProperty("detail").GetString().Should().Be("Invalid email or password");
    }

    [Fact]
    public async Task Unknown_email_gets_the_same_answer_as_a_wrong_password()
    {
        var problem = await ProblemAsync(await PostAsync(Client, "/auth/login", new LoginRequest("ghost@example.com", "whatever")), 401);
        problem.GetProperty("detail").GetString().Should().Be("Invalid email or password");
    }

    [Fact]
    public async Task A_previously_issued_session_token_keeps_working()
    {
        var (user, _) = await SignedInUserAsync();
        var header = B64(JsonSerializer.SerializeToUtf8Bytes(new { alg = "HS256", typ = "JWT" }));
        var payload = B64(JsonSerializer.SerializeToUtf8Bytes(new
        {
            sub = user.Id.ToString(), email = user.Email, exp = DateTimeOffset.UtcNow.AddDays(7).ToUnixTimeSeconds()
        }));
        var signature = B64(HMACSHA256.HashData(
            Encoding.UTF8.GetBytes(MicroMobilityWebApplicationFactory.JwtSecret), Encoding.ASCII.GetBytes($"{header}.{payload}")));

        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", $"{header}.{payload}.{signature}");
        (await ReadAsync<UserResponse>(await Client.GetAsync("/users/me"))).UserId.Should().Be(user.Id);
    }

    [Fact]
    public async Task Reading_another_users_profile_is_a_403()
    {
        var (_, client) = await SignedInUserAsync();
        await ProblemAsync(await client.GetAsync($"/users/{Guid.NewGuid()}"), 403);
    }

    [Fact]
    public async Task Malformed_body_is_a_400_problem_not_a_framework_dump()
    {
        var (_, client) = await SignedInUserAsync();
        var response = await client.PostAsync("/rides/start",
            new StringContent("{\"vehicle_id\": \"not-a-uuid\"}", Encoding.UTF8, "application/json"));

        var problem = await ProblemAsync(response, 400);
        problem.GetProperty("detail").GetString().Should().Be("vehicle_id: has an invalid value");
    }

    [Fact]
    public async Task Missing_required_field_names_the_field()
    {
        var (_, client) = await SignedInUserAsync();
        var problem = await ProblemAsync(await PostAsync(client, "/rides/start", new { start_lat = 1.0, start_lng = 2.0 }), 400);
        problem.GetProperty("detail").GetString().Should().Be("vehicle_id is required.");
    }

    [Fact]
    public async Task Browser_preflight_from_expo_web_is_allowed()
    {
        var request = new HttpRequestMessage(HttpMethod.Options, "/rides/me");
        request.Headers.Add("Origin", "http://localhost:8081");
        request.Headers.Add("Access-Control-Request-Method", "GET");
        request.Headers.Add("Access-Control-Request-Headers", "authorization");

        var response = await Client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        response.Headers.GetValues("Access-Control-Allow-Origin").Should().Equal("http://localhost:8081");
    }

    [Fact]
    public async Task Error_responses_still_carry_cors_headers()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/rides/me");
        request.Headers.Add("Origin", "http://localhost:8081");

        var response = await Client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        response.Headers.GetValues("Access-Control-Allow-Origin").Should().Equal("http://localhost:8081");
    }

    private static string B64(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
