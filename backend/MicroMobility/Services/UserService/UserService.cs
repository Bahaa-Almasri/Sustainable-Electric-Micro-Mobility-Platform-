using Microsoft.EntityFrameworkCore;
using MicroMobility.Data;
using MicroMobility.DTOs;
using MicroMobility.Exceptions;
using MicroMobility.Helpers;
using MicroMobility.Models;
using MicroMobility.Services.Auth;
using MicroMobility.Services.CurrentUser;
using Npgsql;

namespace MicroMobility.Services.UserService;

public interface IUserService
{
    Task<TokenResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken);
    Task<TokenResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken);
    Task<UserResponse> GetMeAsync(CancellationToken cancellationToken);

    /// <summary>A user's own profile by id; anyone else's is a 403.</summary>
    Task<UserResponse> GetAsync(Guid userId, CancellationToken cancellationToken);
}

public sealed class UserService : IUserService
{
    private const int PasswordMinLength = 8;
    private const int PasswordMaxLength = 500;
    private const int NameMaxLength = 150;        // users.name is varchar(150)
    private const int PhoneMinLength = 7;
    private const int PhoneMaxLength = 30;        // users.phone_number is varchar(30)

    private readonly AppDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITokenService _tokens;

    public UserService(AppDbContext db, ICurrentUser currentUser, IPasswordHasher passwordHasher, ITokenService tokens)
    {
        _db = db;
        _currentUser = currentUser;
        _passwordHasher = passwordHasher;
        _tokens = tokens;
    }

    public async Task<TokenResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken)
    {
        var email = Guard.Email(request.Email);
        var password = request.Password ?? throw new ArgumentException("password is required.", "password");
        if (password.Length < PasswordMinLength)
            throw new ArgumentException($"password must be at least {PasswordMinLength} characters.", "password");
        if (password.Length > PasswordMaxLength)
            throw new ArgumentException($"password must be at most {PasswordMaxLength} characters.", "password");
        var name = Guard.RequiredText(request.Name, "name", maxLength: NameMaxLength);
        var phone = Guard.RequiredText(request.PhoneNumber, "phone_number", PhoneMinLength, PhoneMaxLength);

        if (await _db.Users.AnyAsync(x => x.Email.ToLower() == email, cancellationToken))
        {
            throw new ConflictException("That email is already registered.", ErrorCodes.EmailTaken);
        }

        var user = new User
        {
            Email = email,
            PasswordHash = _passwordHasher.Hash(password),
            Name = name,
            PhoneNumber = phone,
            Status = "active",
            IsActive = true
        };
        _db.Users.Add(user);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Lost a race with a concurrent sign-up for the same address.
            throw new ConflictException("That email is already registered.", ErrorCodes.EmailTaken);
        }

        return CreateTokenResponse(user);
    }

    public async Task<TokenResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        var email = Guard.Email(request.Email);
        if (string.IsNullOrEmpty(request.Password)) throw new ArgumentException("password is required.", "password");

        var user = await _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Email.ToLower() == email, cancellationToken);

        // One message for "no such account" and "wrong password", so sign-in cannot probe for accounts.
        if (user is null || !_passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            throw new AuthenticationFailedException("Invalid email or password");
        }

        return CreateTokenResponse(user);
    }

    public Task<UserResponse> GetMeAsync(CancellationToken cancellationToken) =>
        LoadAsync(_currentUser.RequireUserId(), cancellationToken);

    public Task<UserResponse> GetAsync(Guid userId, CancellationToken cancellationToken)
    {
        if (userId != _currentUser.RequireUserId()) throw new UnauthorizedAccessException("Forbidden");
        return LoadAsync(userId, cancellationToken);
    }

    private async Task<UserResponse> LoadAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new KeyNotFoundException("User not found");
        return UserResponse.FromEntity(user);
    }

    private TokenResponse CreateTokenResponse(User user) =>
        new(_tokens.Issue(user.Id, user.Email).Value, "bearer", user.Id, user.Email);
}
