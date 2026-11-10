using Npgsql;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not set.");

builder.Services.AddSingleton(NpgsqlDataSource.Create(connectionString));
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
// Any origin: there are no cookies or logins to protect (see ASSUMPTIONS.md).
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

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

app.Run();
