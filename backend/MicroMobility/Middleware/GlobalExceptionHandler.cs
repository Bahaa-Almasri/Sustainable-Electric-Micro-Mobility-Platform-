using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using MicroMobility.Exceptions;

namespace MicroMobility.Middleware;

/// <summary>
/// The single place exceptions become HTTP responses. Services throw; controllers never catch.
/// Messages below 500 are written for people and shown to them; a 500 never leaks details.
/// </summary>
public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) => _logger = logger;

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        // The caller went away; there is nobody to answer.
        if (exception is OperationCanceledException && httpContext.RequestAborted.IsCancellationRequested)
        {
            return true;
        }

        var (statusCode, title, code) = exception switch
        {
            ArgumentException when IsOwnCode(exception) => (StatusCodes.Status400BadRequest, "Bad request", ErrorCodes.ValidationFailed),
            AuthenticationFailedException => (StatusCodes.Status401Unauthorized, "Unauthorized", ErrorCodes.InvalidCredentials),
            UnauthorizedAccessException => (StatusCodes.Status403Forbidden, "Forbidden", null),
            KeyNotFoundException => (StatusCodes.Status404NotFound, "Not found", null),
            ConflictException conflict => (StatusCodes.Status409Conflict, "Conflict", conflict.Code),
            _ => (StatusCodes.Status500InternalServerError, "An unexpected error occurred", (string?)null)
        };

        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Instance = httpContext.Request.Path
        };

        if (statusCode == StatusCodes.Status500InternalServerError)
        {
            _logger.LogError(exception, "Unhandled exception on {Method} {Path}. TraceId: {TraceId}",
                httpContext.Request.Method, httpContext.Request.Path, httpContext.TraceIdentifier);
            problemDetails.Detail = "Internal server error";
            problemDetails.Extensions["trace_id"] = httpContext.TraceIdentifier;
        }
        else
        {
            _logger.LogInformation("Handled {Status} on {Method} {Path}: {Message}",
                statusCode, httpContext.Request.Method, httpContext.Request.Path, exception.Message);
            problemDetails.Detail = exception is ArgumentException argument
                ? StripParamName(argument)
                : exception.Message;
            if (code is not null) problemDetails.Extensions["code"] = code;
        }

        httpContext.Response.StatusCode = statusCode;
        await httpContext.Response.WriteAsJsonAsync(problemDetails, (System.Text.Json.JsonSerializerOptions?)null,
            "application/problem+json", cancellationToken);
        return true;
    }

    /// <summary>
    /// Only an ArgumentException this app threw is a 400 with user-facing copy. Libraries throw
    /// ArgumentException too (Npgsql rejecting a parameter, say), and those are bugs: their
    /// messages are diagnostics, so they fall through to an opaque 500.
    /// </summary>
    private static bool IsOwnCode(Exception exception)
    {
        var thrower = exception.TargetSite?.DeclaringType;
        while (thrower?.DeclaringType is not null) thrower = thrower.DeclaringType;   // async state machines
        return thrower?.Namespace?.StartsWith("MicroMobility", StringComparison.Ordinal) == true;
    }

    /// <summary>ArgumentException appends " (Parameter 'x')" to Message; that suffix is not user copy.</summary>
    private static string StripParamName(ArgumentException exception)
    {
        var message = exception.Message;
        var suffix = exception.ParamName is null ? null : $" (Parameter '{exception.ParamName}')";
        return suffix is not null && message.EndsWith(suffix, StringComparison.Ordinal)
            ? message[..^suffix.Length]
            : message;
    }
}
