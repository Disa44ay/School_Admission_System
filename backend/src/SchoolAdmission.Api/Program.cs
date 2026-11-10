using Npgsql;
using Scalar.AspNetCore;
using SchoolAdmission.Api;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton(NpgsqlDataSource.Create(AppConfig.ConnectionString(builder.Configuration)));
builder.Services.AddProblemDetails();
// Development defaults to throwing on bad JSON, which the exception handler turns into a 500. Rule 7: always 400.
builder.Services.Configure<RouteHandlerOptions>(o => o.ThrowOnBadRequest = false);
builder.Services.AddOpenApi();
// Any origin: there are no cookies or logins to protect (see ASSUMPTIONS.md).
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

await Schema.EnsureAsync(app.Services.GetRequiredService<NpgsqlDataSource>());
app.Logger.LogInformation("Hold duration: {Seconds} s", AppConfig.HoldDurationSeconds(app.Configuration));

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseCors();

app.MapGet("/health", async (NpgsqlDataSource db, CancellationToken ct) =>
{
    try
    {
        await using var cmd = db.CreateCommand("SELECT 1");
        await cmd.ExecuteScalarAsync(ct);
        return Results.Ok(new { status = "Healthy" });
    }
    catch (NpgsqlException)
    {
        return Results.Json(new { status = "Database unreachable" }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

app.MapClassEndpoints();

app.Run();

public partial class Program; // lets backend.Tests start the app with WebApplicationFactory
