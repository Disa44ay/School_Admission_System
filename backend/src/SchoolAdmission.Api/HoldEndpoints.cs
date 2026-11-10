using System.Text.RegularExpressions;
using Dapper;
using Npgsql;

namespace SchoolAdmission.Api;

public static partial class HoldEndpoints
{
    // ASCII digits only: \d would also accept other scripts' digits.
    [GeneratedRegex("^[0-9]{17}$")]
    private static partial Regex StudentIdPattern();

    private static string? StudentId(HttpRequest req)
    {
        var value = req.Headers["X-Student-Id"].ToString();
        return StudentIdPattern().IsMatch(value) ? value : null;
    }

    private static IResult BadStudentId() =>
        Results.BadRequest(new { error = "X-Student-Id must be a 17-digit number." });

    private static IResult Error(int status, string message) => Results.Json(new { error = message }, statusCode: status);

    private record HoldRow(string StudentId, string Status, bool Expired);

    public static void MapHoldEndpoints(this WebApplication app, int holdDurationSeconds)
    {
        app.MapPost("/classes/{classId}/holds", async (string classId, HttpRequest req, NpgsqlDataSource db) =>
        {
            if (StudentId(req) is not { } studentId) return BadStudentId();

            await using var conn = await db.OpenConnectionAsync();
            await using var tx = await conn.BeginTransactionAsync();

            // Every hold for this class waits here, in any API process: no overbooking.
            var totalSeats = await conn.QuerySingleOrDefaultAsync<int?>(
                "SELECT total_seats FROM classes WHERE id = @classId FOR UPDATE", new { classId }, tx);
            if (totalSeats is null) return Error(404, "Class not found.");

            await conn.ExecuteAsync("""
                UPDATE holds SET status = 'EXPIRED', updated_at = NOW()
                WHERE class_id = @classId AND status = 'HELD' AND expires_at <= NOW()
                """, new { classId }, tx);

            var alreadyActive = await conn.ExecuteScalarAsync<bool>("""
                SELECT EXISTS (SELECT 1 FROM holds
                               WHERE class_id = @classId AND student_id = @studentId AND status IN ('HELD', 'CONFIRMED'))
                """, new { classId, studentId }, tx);
            if (alreadyActive) return Error(409, "You already have an active application in this class.");

            var active = await conn.ExecuteScalarAsync<int>(
                "SELECT count(*)::int FROM holds WHERE class_id = @classId AND status IN ('HELD', 'CONFIRMED')",
                new { classId }, tx);
            if (active >= totalSeats) return Error(409, "No seats available in this class.");

            var holdId = $"h_{Guid.NewGuid():N}";
            try
            {
                var expiresAt = await conn.ExecuteScalarAsync<DateTime>("""
                    INSERT INTO holds (id, class_id, student_id, status, expires_at)
                    VALUES (@holdId, @classId, @studentId, 'HELD', NOW() + make_interval(secs => @seconds))
                    RETURNING expires_at
                    """, new { holdId, classId, studentId, seconds = holdDurationSeconds }, tx);
                await tx.CommitAsync();
                return Results.Created($"/holds/{holdId}",
                    new { holdId, classId, studentId, status = "HELD", expiresAt });
            }
            catch (PostgresException e) when (e.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                // Backstop for rule 3; the check above should already have caught it.
                return Error(409, "You already have an active application in this class.");
            }
        });

        app.MapGet("/holds/{holdId}", async (string holdId, NpgsqlDataSource db) =>
        {
            await using var conn = await db.OpenConnectionAsync();
            await ExpireAsync(conn, "id = @holdId", new { holdId });
            var hold = await conn.QuerySingleOrDefaultAsync<HoldView>(
                "SELECT id AS HoldId, class_id AS ClassId, status, expires_at AS ExpiresAt FROM holds WHERE id = @holdId",
                new { holdId });
            return hold is null ? Error(404, "Hold not found.") : Results.Ok(hold);
        });

        app.MapPost("/holds/{holdId}/confirm", (string holdId, HttpRequest req, NpgsqlDataSource db) =>
            ChangeStatusAsync(holdId, req, db, "CONFIRMED"));

        app.MapDelete("/holds/{holdId}", (string holdId, HttpRequest req, NpgsqlDataSource db) =>
            ChangeStatusAsync(holdId, req, db, "CANCELLED"));

        app.MapGet("/me/holds", async (HttpRequest req, NpgsqlDataSource db) =>
        {
            if (StudentId(req) is not { } studentId) return BadStudentId();
            await using var conn = await db.OpenConnectionAsync();
            await ExpireAsync(conn, "student_id = @studentId", new { studentId });
            var holds = await conn.QueryAsync<MyHoldView>("""
                SELECT h.id AS HoldId, h.class_id AS ClassId, c.name AS ClassName, h.status, h.expires_at AS ExpiresAt
                FROM holds h JOIN classes c ON c.id = h.class_id
                WHERE h.student_id = @studentId
                ORDER BY h.created_at DESC
                """, new { studentId });
            return Results.Ok(holds);
        });
    }

    // Confirm and cancel share the checks: 400 header, 404, 403, then state (409).
    private static async Task<IResult> ChangeStatusAsync(string holdId, HttpRequest req, NpgsqlDataSource db, string target)
    {
        if (StudentId(req) is not { } studentId) return BadStudentId();

        await using var conn = await db.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();
        // Row lock: concurrent confirms/cancels on one hold run one at a time.
        var hold = await conn.QuerySingleOrDefaultAsync<HoldRow>(
            "SELECT student_id AS StudentId, status, expires_at <= NOW() AS Expired FROM holds WHERE id = @holdId FOR UPDATE",
            new { holdId }, tx);
        if (hold is null) return Error(404, "Hold not found.");
        if (hold.StudentId != studentId) return Error(403, "This hold belongs to another student.");

        if (target == "CONFIRMED" && hold.Status == "CONFIRMED")
            return Results.Ok(new { holdId, status = "CONFIRMED" }); // idempotent (rule 5)

        if (hold.Status == "HELD" && hold.Expired)
        {
            await conn.ExecuteAsync(
                "UPDATE holds SET status = 'EXPIRED', updated_at = NOW() WHERE id = @holdId", new { holdId }, tx);
            await tx.CommitAsync();
            return Error(409, "This hold has expired.");
        }
        if (hold.Status != "HELD")
            return Error(409, $"This hold is already {hold.Status.ToLowerInvariant()}.");

        await conn.ExecuteAsync(
            "UPDATE holds SET status = @target, updated_at = NOW() WHERE id = @holdId", new { holdId, target }, tx);
        await tx.CommitAsync();
        return target == "CONFIRMED" ? Results.Ok(new { holdId, status = "CONFIRMED" }) : Results.NoContent();
    }

    private static Task ExpireAsync(NpgsqlConnection conn, string where, object args) =>
        conn.ExecuteAsync(
            $"UPDATE holds SET status = 'EXPIRED', updated_at = NOW() WHERE {where} AND status = 'HELD' AND expires_at <= NOW()",
            args);
}

public record HoldView(string HoldId, string ClassId, string Status, DateTime ExpiresAt);
public record MyHoldView(string HoldId, string ClassId, string ClassName, string Status, DateTime ExpiresAt);
