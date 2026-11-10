using Dapper;
using Npgsql;

namespace SchoolAdmission.Api;

public record CreateClassRequest(string? Name, int TotalSeats);

public record ClassSeats(string Id, string Name, int TotalSeats, int HeldSeats, int ConfirmedSeats)
{
    public int AvailableSeats => TotalSeats - HeldSeats - ConfirmedSeats;
}

public static class ClassEndpoints
{
    // A HELD row stops counting the moment expires_at passes, before the sweeper marks it EXPIRED.
    private const string SeatsSql = """
        SELECT c.id, c.name, c.total_seats AS TotalSeats,
               (count(h.id) FILTER (WHERE h.status = 'HELD' AND h.expires_at > NOW()))::int AS HeldSeats,
               (count(h.id) FILTER (WHERE h.status = 'CONFIRMED'))::int AS ConfirmedSeats
        FROM classes c
        LEFT JOIN holds h ON h.class_id = c.id
        """;

    public static void MapClassEndpoints(this WebApplication app)
    {
        app.MapPost("/classes", async (CreateClassRequest? req, NpgsqlDataSource db) =>
        {
            var name = req?.Name?.Trim();
            if (string.IsNullOrEmpty(name))
                return Results.BadRequest(new { error = "Class name is required." });
            if (name.Length > 200)
                return Results.BadRequest(new { error = "Class name must be at most 200 characters." });
            if (req!.TotalSeats <= 0)
                return Results.BadRequest(new { error = "totalSeats must be greater than 0." });

            var id = $"c_{Guid.NewGuid():N}";
            await using var conn = await db.OpenConnectionAsync();
            await conn.ExecuteAsync(
                "INSERT INTO classes (id, name, total_seats) VALUES (@id, @name, @seats)",
                new { id, name, seats = req.TotalSeats });
            return Results.Created($"/classes/{id}", new { id, name, totalSeats = req.TotalSeats });
        });

        app.MapGet("/classes", async (NpgsqlDataSource db) =>
        {
            await using var conn = await db.OpenConnectionAsync();
            var rows = await conn.QueryAsync<ClassSeats>(SeatsSql + " GROUP BY c.id ORDER BY c.created_at, c.id");
            return Results.Ok(rows);
        });

        app.MapGet("/classes/{classId}", async (string classId, NpgsqlDataSource db) =>
        {
            await using var conn = await db.OpenConnectionAsync();
            var row = await conn.QuerySingleOrDefaultAsync<ClassSeats>(
                SeatsSql + " WHERE c.id = @classId GROUP BY c.id", new { classId });
            return row is null ? Results.NotFound(new { error = "Class not found." }) : Results.Ok(row);
        });
    }
}
